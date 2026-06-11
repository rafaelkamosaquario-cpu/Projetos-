"""
FrotaBot - Backend principal
Gerencia alertas, checklists e controle documental via WhatsApp
"""

import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from database import db, Veiculo, Motorista, Manutencao, Documento, ChecklistLog
from whatsapp import enviar_mensagem, enviar_alerta_gestor

app = Flask(__name__)
CORS(app)

database_url = os.getenv("DATABASE_URL", "sqlite:///frotabot.db")
# Remove sslmode from URL — será configurado via engine options
if "?sslmode=" in database_url:
    database_url = database_url.split("?sslmode=")[0]

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

if database_url.startswith("postgresql"):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "connect_args": {"sslmode": "require"},
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

db.init_app(app)

with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        print(f"[WARN] db.create_all() falhou: {e}")

scheduler = BackgroundScheduler()


# ─────────────────────────────────────────
# PING – healthcheck
# ─────────────────────────────────────────

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "bot": "FrotaBot rodando!"})


@app.route("/debug-db", methods=["GET"])
def debug_db():
    """Diagnóstico da conexão com banco de dados."""
    import sqlalchemy
    url_raw = os.getenv("DATABASE_URL", "sqlite:///frotabot.db")
    url_usado = database_url  # após strip do sslmode
    try:
        with db.engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        db.create_all()
        return jsonify({"status": "ok", "db": "conectado e tabelas criadas", "url_tipo": url_usado.split(":")[0]})
    except Exception as e:
        return jsonify({"status": "erro", "erro": str(e), "url_tipo": url_usado.split(":")[0], "url_raw_inicio": url_raw[:40]})


@app.route("/setup-teste", methods=["GET"])
def setup_teste():
    Motorista.query.delete()
    db.session.commit()
    m = Motorista(
        nome="Rafael (Teste)",
        whatsapp="5542998582489",
        veiculo_placa="ABC-1234",
        ativo=True
    )
    db.session.add(m)
    db.session.commit()
    return jsonify({"status": "ok", "msg": "Motorista de teste criado!", "numero": "5542998582489"})


@app.route("/cadastrar-do-webhook", methods=["GET"])
def cadastrar_do_webhook():
    """Cadastra motorista usando o número exato que chegou no último webhook."""
    numero = _ultimo_webhook.get("phone", "")
    if not numero:
        return jsonify({"erro": "Nenhum webhook recebido ainda. Envie uma mensagem primeiro."})
    Motorista.query.delete()
    db.session.commit()
    m = Motorista(
        nome="Rafael (Teste)",
        whatsapp=numero,
        veiculo_placa="ABC-1234",
        ativo=True
    )
    db.session.add(m)
    db.session.commit()
    return jsonify({"status": "ok", "msg": "Motorista cadastrado com o número do webhook!", "numero_cadastrado": numero})


# ─────────────────────────────────────────
# WEBHOOK – recebe mensagens do WhatsApp
# ─────────────────────────────────────────

_ultimo_webhook = {}

@app.route("/ultimo-webhook", methods=["GET"])
def ultimo_webhook():
    return jsonify(_ultimo_webhook)


@app.route("/testar-envio", methods=["GET"])
def testar_envio():
    """Testa envio direto via Z-API e retorna resposta completa para debug."""
    import requests as req
    numero = _ultimo_webhook.get("phone") or "5542998582489"
    instance = os.getenv("ZAPI_INSTANCE", "")
    token = os.getenv("ZAPI_TOKEN", "")
    client_token = os.getenv("ZAPI_CLIENT_TOKEN", "")
    url = f"https://api.z-api.io/instances/{instance}/token/{token}/send-text"
    headers = {"Client-Token": client_token} if client_token else {}
    payload = {"phone": numero, "message": "🤖 Teste FrotaBot - funcionando!"}
    try:
        r = req.post(url, json=payload, headers=headers, timeout=10)
        try:
            resp_body = r.json()
        except Exception:
            resp_body = r.text
        return jsonify({
            "status_code": r.status_code,
            "resposta_zapi": resp_body,
            "numero_usado": numero,
            "client_token_ok": bool(client_token)
        })
    except Exception as e:
        return jsonify({"erro": str(e)})


@app.route("/webhook", methods=["POST"])
def webhook():
    global _ultimo_webhook
    data = request.json or {}
    _ultimo_webhook = data  # salva para debug

    # Z-API usa "phone" e "text.message"
    if data.get("fromMe"):
        return jsonify({"status": "ignorado"})

    numero = data.get("phone") or data.get("from", "")
    text_obj = data.get("text") or {}
    if isinstance(text_obj, dict):
        mensagem = text_obj.get("message", "").strip().lower()
    else:
        mensagem = data.get("body", "").strip().lower()

    motorista = Motorista.query.filter_by(whatsapp=numero).first()
    if not motorista:
        return jsonify({"status": "ignorado", "numero_recebido": numero, "motoristas": [m.whatsapp for m in Motorista.query.all()]})

    # Resposta ao checklist diário
    if mensagem in ["ok", "sim", "tudo certo", "ok tudo certo"]:
        log = ChecklistLog.query.filter_by(
            motorista_id=motorista.id,
            data=datetime.today().date(),
            respondido=False
        ).first()
        if log:
            log.respondido = True
            log.resposta = mensagem
            log.horario_resposta = datetime.now()
            db.session.commit()
        enviar_mensagem(numero, f"✅ Checklist registrado! Bom trabalho, {motorista.nome}.")
        return jsonify({"status": "ok", "enviado": True})

    # Resposta de agendamento de manutenção
    if "agendar" in mensagem or "sim, pode agendar" in mensagem:
        manutencao = Manutencao.query.filter_by(
            veiculo_id=motorista.veiculo_atual_id,
            agendada=False
        ).order_by(Manutencao.vencimento.asc()).first()
        if manutencao:
            manutencao.agendada = True
            db.session.commit()
            _notificar_equipe_manutencao(manutencao)
            enviar_mensagem(numero, f"📅 Manutenção agendada! Logística e manutenção já foram avisados.")

    return jsonify({"status": "ok"})


# ─────────────────────────────────────────
# JOBS AGENDADOS
# ─────────────────────────────────────────

def job_checklist_diario():
    """Envia checklist para todos os motoristas ativos às 07:00."""
    with app.app_context():
        motoristas = Motorista.query.filter_by(ativo=True).all()
        for m in motoristas:
            enviar_mensagem(
                m.whatsapp,
                f"🚛 *FrotaBot* – Bom dia, {m.nome}!\n\n"
                f"Checklist do veículo *{m.veiculo_placa}*:\n"
                f"• Pneus OK?\n• Freios OK?\n• Luzes OK?\n• Combustível OK?\n\n"
                f"Responda *OK* para confirmar."
            )
            log = ChecklistLog(
                motorista_id=m.id,
                data=datetime.today().date(),
                respondido=False
            )
            db.session.add(log)
        db.session.commit()


def job_cobrar_checklist():
    """Cobra motoristas que não responderam o checklist após 20 minutos."""
    with app.app_context():
        limite = datetime.now() - timedelta(minutes=20)
        logs_pendentes = ChecklistLog.query.filter(
            ChecklistLog.respondido == False,
            ChecklistLog.data == datetime.today().date(),
            ChecklistLog.criado_em <= limite
        ).all()
        for log in logs_pendentes:
            m = Motorista.query.get(log.motorista_id)
            enviar_mensagem(m.whatsapp, f"⚠️ {m.nome}, ainda não recebi seu checklist. Responda *OK* para confirmar.")
            if log.tentativas >= 1:
                enviar_alerta_gestor(
                    f"🚨 *Alerta:* {m.nome} não respondeu o checklist de hoje. "
                    f"Veículo: {m.veiculo_placa}"
                )
            log.tentativas += 1
            db.session.commit()


def job_alertas_manutencao():
    """Verifica manutenções próximas do vencimento e envia alertas."""
    with app.app_context():
        hoje = datetime.today().date()
        manutencoes = Manutencao.query.filter(
            Manutencao.agendada == False,
            Manutencao.concluida == False
        ).all()
        for m in manutencoes:
            dias = (m.vencimento - hoje).days
            if dias in [7, 3, 1]:
                veiculo = Veiculo.query.get(m.veiculo_id)
                enviar_alerta_gestor(
                    f"🔧 *Manutenção próxima:*\n"
                    f"Veículo: {veiculo.placa}\n"
                    f"Tipo: {m.tipo}\n"
                    f"Vence em: *{dias} dia(s)*\n"
                    f"Responda *AGENDAR* para confirmar."
                )


def job_alertas_documentos():
    """Verifica documentos próximos do vencimento."""
    with app.app_context():
        hoje = datetime.today().date()
        docs = Documento.query.filter(Documento.renovado == False).all()
        for d in docs:
            dias = (d.vencimento - hoje).days
            if dias in [30, 15, 7, 1]:
                enviar_alerta_gestor(
                    f"📄 *Documento vencendo:*\n"
                    f"Tipo: {d.tipo}\n"
                    f"Referente a: {d.referencia}\n"
                    f"Vence em: *{dias} dia(s)*\n"
                    f"Providencie a renovação."
                )


def _notificar_equipe_manutencao(manutencao):
    """Notifica manutenção e logística sobre agendamento."""
    veiculo = Veiculo.query.get(manutencao.veiculo_id)
    msg = (
        f"🔧 *Manutenção Agendada*\n"
        f"Veículo: {veiculo.placa}\n"
        f"Tipo: {manutencao.tipo}\n"
        f"Data: {manutencao.vencimento.strftime('%d/%m/%Y')}"
    )
    numero_manutencao = os.getenv("WHATSAPP_MANUTENCAO")
    numero_logistica = os.getenv("WHATSAPP_LOGISTICA")
    if numero_manutencao:
        enviar_mensagem(numero_manutencao, msg)
    if numero_logistica:
        enviar_mensagem(numero_logistica, msg)


# ─────────────────────────────────────────
# ROTAS DA API
# ─────────────────────────────────────────

@app.route("/api/veiculos", methods=["GET", "POST"])
def veiculos():
    if request.method == "POST":
        data = request.json
        v = Veiculo(placa=data["placa"].upper(), modelo=data.get("modelo", ""), ano=data.get("ano"))
        db.session.add(v)
        db.session.commit()
        return jsonify({"id": v.id, "placa": v.placa, "modelo": v.modelo}), 201
    return jsonify([
        {"id": v.id, "placa": v.placa, "modelo": v.modelo, "ano": v.ano, "ativo": v.ativo}
        for v in Veiculo.query.filter_by(ativo=True).order_by(Veiculo.placa).all()
    ])


@app.route("/api/motoristas", methods=["GET", "POST"])
def motoristas():
    if request.method == "POST":
        data = request.json
        whats = data["whatsapp"].replace("(","").replace(")","").replace("-","").replace(" ","")
        if not whats.startswith("55"):
            whats = "55" + whats
        m = Motorista(nome=data["nome"], whatsapp=whats, veiculo_placa=data.get("veiculo_placa"), ativo=True)
        db.session.add(m)
        db.session.commit()
        return jsonify({"id": m.id, "nome": m.nome, "whatsapp": m.whatsapp}), 201
    result = []
    for m in Motorista.query.filter_by(ativo=True).order_by(Motorista.nome).all():
        hoje = datetime.today().date()
        log = ChecklistLog.query.filter_by(motorista_id=m.id, data=hoje).first()
        checklist_status = "respondido" if (log and log.respondido) else ("pendente" if log else "nao_enviado")
        result.append({
            "id": m.id, "nome": m.nome, "whatsapp": m.whatsapp,
            "veiculo_placa": m.veiculo_placa, "checklist_hoje": checklist_status
        })
    return jsonify(result)


@app.route("/api/motoristas/<int:mid>", methods=["DELETE"])
def deletar_motorista(mid):
    m = Motorista.query.get_or_404(mid)
    m.ativo = False
    db.session.commit()
    return jsonify({"status": "ok"})


@app.route("/api/veiculos/<int:vid>", methods=["DELETE"])
def deletar_veiculo(vid):
    v = Veiculo.query.get_or_404(vid)
    v.ativo = False
    db.session.commit()
    return jsonify({"status": "ok"})


@app.route("/api/manutencoes", methods=["GET", "POST"])
def manutencoes():
    if request.method == "POST":
        data = request.json
        veiculo_id = data.get("veiculo_id")
        if not veiculo_id and data.get("veiculo_placa"):
            v = Veiculo.query.filter_by(placa=data["veiculo_placa"].upper()).first()
            if v:
                veiculo_id = v.id
        if not veiculo_id:
            return jsonify({"erro": "Veículo não encontrado"}), 400
        m = Manutencao(
            veiculo_id=veiculo_id,
            tipo=data["tipo"],
            vencimento=datetime.strptime(data["vencimento"], "%Y-%m-%d").date()
        )
        db.session.add(m)
        db.session.commit()
        return jsonify({"id": m.id, "tipo": m.tipo}), 201
    hoje = datetime.today().date()
    result = []
    for m in Manutencao.query.filter_by(concluida=False).order_by(Manutencao.vencimento).all():
        v = Veiculo.query.get(m.veiculo_id)
        dias = (m.vencimento - hoje).days
        result.append({
            "id": m.id, "tipo": m.tipo,
            "vencimento": str(m.vencimento), "dias_restantes": dias,
            "veiculo_placa": v.placa if v else "—",
            "agendada": m.agendada
        })
    return jsonify(result)


@app.route("/api/documentos", methods=["GET", "POST"])
def documentos():
    if request.method == "POST":
        data = request.json
        d = Documento(
            tipo=data["tipo"],
            referencia=data["referencia"],
            vencimento=datetime.strptime(data["vencimento"], "%Y-%m-%d").date()
        )
        db.session.add(d)
        db.session.commit()
        return jsonify({"id": d.id, "tipo": d.tipo}), 201
    hoje = datetime.today().date()
    result = []
    for d in Documento.query.filter_by(renovado=False).order_by(Documento.vencimento).all():
        dias = (d.vencimento - hoje).days
        result.append({
            "id": d.id, "tipo": d.tipo, "referencia": d.referencia,
            "vencimento": str(d.vencimento), "dias_restantes": dias
        })
    return jsonify(result)


@app.route("/api/relatorio", methods=["GET"])
def relatorio():
    hoje = datetime.today().date()
    checklists_hoje = ChecklistLog.query.filter_by(data=hoje).all()
    respondidos = sum(1 for c in checklists_hoje if c.respondido)
    pendentes = len(checklists_hoje) - respondidos
    manutencoes_proximas = Manutencao.query.filter(
        Manutencao.concluida == False,
        Manutencao.vencimento <= hoje + timedelta(days=7)
    ).count()
    docs_proximos = Documento.query.filter(
        Documento.renovado == False,
        Documento.vencimento <= hoje + timedelta(days=30)
    ).count()
    total_motoristas = Motorista.query.filter_by(ativo=True).count()
    total_veiculos = Veiculo.query.filter_by(ativo=True).count()
    return jsonify({
        "data": str(hoje),
        "total_motoristas": total_motoristas,
        "total_veiculos": total_veiculos,
        "checklists": {"respondidos": respondidos, "pendentes": pendentes, "total": len(checklists_hoje)},
        "manutencoes_proximas_7dias": manutencoes_proximas,
        "documentos_proximos_30dias": docs_proximos
    })


# ─────────────────────────────────────────
# INICIALIZAÇÃO
# ─────────────────────────────────────────

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    scheduler.add_job(job_checklist_diario, "cron", hour=7, minute=0)
    scheduler.add_job(job_cobrar_checklist, "cron", hour=7, minute=20)
    scheduler.add_job(job_cobrar_checklist, "cron", hour=7, minute=40)
    scheduler.add_job(job_alertas_manutencao, "cron", hour=8, minute=0)
    scheduler.add_job(job_alertas_documentos, "cron", hour=8, minute=30)
    scheduler.start()

    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
