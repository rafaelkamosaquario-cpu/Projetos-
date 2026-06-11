"""
FrotaBot - Backend principal
Gerencia alertas, checklists e controle documental via WhatsApp
"""

import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
from database import db, Veiculo, Motorista, Manutencao, Documento, ChecklistLog
from whatsapp import enviar_mensagem, enviar_alerta_gestor

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///frotabot.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

with app.app_context():
    db.create_all()

scheduler = BackgroundScheduler()


# ─────────────────────────────────────────
# PING – healthcheck
# ─────────────────────────────────────────

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "bot": "FrotaBot rodando!"})


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


# ─────────────────────────────────────────
# WEBHOOK – recebe mensagens do WhatsApp
# ─────────────────────────────────────────

_ultimo_webhook = {}

@app.route("/ultimo-webhook", methods=["GET"])
def ultimo_webhook():
    return jsonify(_ultimo_webhook)


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
        return jsonify({"status": "ok"})

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
        v = Veiculo(placa=data["placa"], modelo=data["modelo"], ano=data["ano"])
        db.session.add(v)
        db.session.commit()
        return jsonify({"id": v.id, "placa": v.placa}), 201
    return jsonify([{"id": v.id, "placa": v.placa, "modelo": v.modelo} for v in Veiculo.query.all()])


@app.route("/api/motoristas", methods=["GET", "POST"])
def motoristas():
    if request.method == "POST":
        data = request.json
        m = Motorista(nome=data["nome"], whatsapp=data["whatsapp"], veiculo_placa=data.get("veiculo_placa"))
        db.session.add(m)
        db.session.commit()
        return jsonify({"id": m.id, "nome": m.nome}), 201
    return jsonify([{"id": m.id, "nome": m.nome, "whatsapp": m.whatsapp} for m in Motorista.query.all()])


@app.route("/api/manutencoes", methods=["POST"])
def cadastrar_manutencao():
    data = request.json
    m = Manutencao(
        veiculo_id=data["veiculo_id"],
        tipo=data["tipo"],
        vencimento=datetime.strptime(data["vencimento"], "%Y-%m-%d").date()
    )
    db.session.add(m)
    db.session.commit()
    return jsonify({"id": m.id, "tipo": m.tipo}), 201


@app.route("/api/documentos", methods=["POST"])
def cadastrar_documento():
    data = request.json
    d = Documento(
        tipo=data["tipo"],
        referencia=data["referencia"],
        vencimento=datetime.strptime(data["vencimento"], "%Y-%m-%d").date()
    )
    db.session.add(d)
    db.session.commit()
    return jsonify({"id": d.id, "tipo": d.tipo}), 201


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
    return jsonify({
        "data": str(hoje),
        "checklists": {"respondidos": respondidos, "pendentes": pendentes},
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
