"""Disparo em massa de mensagens de WhatsApp (texto e imagem) via Z-API,
a partir de uma lista de contatos em uma planilha Excel.

Uso:
    python disparador.py --excel contatos.xlsx
    python disparador.py --excel contatos.xlsx --mensagem "Olá!" --imagem promo.jpg
    python disparador.py --excel contatos.xlsx --dry-run
"""

import argparse
import base64
import os
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

ZAPI_INSTANCE_ID = os.getenv("ZAPI_INSTANCE_ID")
ZAPI_TOKEN = os.getenv("ZAPI_TOKEN")
ZAPI_CLIENT_TOKEN = os.getenv("ZAPI_CLIENT_TOKEN")

BASE_URL = f"https://api.z-api.io/instances/{ZAPI_INSTANCE_ID}/token/{ZAPI_TOKEN}"

COLUNAS_ACEITAS = {
    "telefone": ["telefone", "numero", "número", "phone", "celular"],
    "nome": ["nome", "name"],
    "mensagem": ["mensagem", "message", "texto"],
    "imagem": ["imagem", "image", "foto"],
    "legenda": ["legenda", "caption"],
}


def localizar_coluna(colunas, aliases):
    mapa = {str(c).strip().lower(): c for c in colunas}
    for alias in aliases:
        if alias in mapa:
            return mapa[alias]
    return None


def valor_valido(v):
    if v is None:
        return False
    try:
        if pd.isna(v):
            return False
    except (TypeError, ValueError):
        pass
    return str(v).strip() != ""


def formatar_telefone(valor):
    digitos = re.sub(r"\D", "", str(valor))
    if not digitos:
        return None
    digitos = digitos.lstrip("0")
    # Número brasileiro sem código do país (DDD + número) -> adiciona 55
    if len(digitos) in (10, 11):
        digitos = "55" + digitos
    return digitos


def carregar_imagem(caminho_ou_url):
    if not valor_valido(caminho_ou_url):
        return None
    caminho_ou_url = str(caminho_ou_url).strip()
    if caminho_ou_url.startswith("http://") or caminho_ou_url.startswith("https://"):
        return caminho_ou_url
    caminho = Path(caminho_ou_url)
    if not caminho.is_file():
        raise FileNotFoundError(f"imagem não encontrada: {caminho_ou_url}")
    ext = caminho.suffix.lstrip(".").lower() or "jpeg"
    with open(caminho, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/{ext};base64,{b64}"


def enviar_texto(session, telefone, mensagem):
    return session.post(f"{BASE_URL}/send-text", json={"phone": telefone, "message": mensagem})


def enviar_imagem(session, telefone, imagem, legenda=""):
    payload = {"phone": telefone, "image": imagem}
    if legenda:
        payload["caption"] = legenda
    return session.post(f"{BASE_URL}/send-image", json=payload)


def montar_argumentos():
    parser = argparse.ArgumentParser(
        description="Disparo em massa de mensagens WhatsApp via Z-API a partir de uma planilha Excel."
    )
    parser.add_argument("--excel", default="contatos.xlsx", help="Caminho da planilha Excel com os contatos")
    parser.add_argument(
        "--mensagem", default=None, help="Mensagem de texto padrão (use {nome} para personalizar)"
    )
    parser.add_argument(
        "--imagem", default=None, help="Caminho local ou URL de imagem padrão a enviar para todos"
    )
    parser.add_argument("--legenda", default="", help="Legenda padrão da imagem")
    parser.add_argument("--delay-min", type=float, default=3.0, help="Atraso mínimo (s) entre envios")
    parser.add_argument("--delay-max", type=float, default=8.0, help="Atraso máximo (s) entre envios")
    parser.add_argument(
        "--dry-run", action="store_true", help="Simula o envio sem chamar a API (não envia nada de fato)"
    )
    return parser.parse_args()


def main():
    args = montar_argumentos()

    if not args.dry_run and not (ZAPI_INSTANCE_ID and ZAPI_TOKEN):
        sys.exit(
            "Defina ZAPI_INSTANCE_ID e ZAPI_TOKEN no arquivo .env antes de continuar "
            "(veja .env.example)."
        )

    if not Path(args.excel).is_file():
        sys.exit(f"Planilha não encontrada: {args.excel}")

    df = pd.read_excel(args.excel)

    col_telefone = localizar_coluna(df.columns, COLUNAS_ACEITAS["telefone"])
    if not col_telefone:
        sys.exit("A planilha precisa de uma coluna de telefone (ex: 'telefone').")
    col_nome = localizar_coluna(df.columns, COLUNAS_ACEITAS["nome"])
    col_mensagem = localizar_coluna(df.columns, COLUNAS_ACEITAS["mensagem"])
    col_imagem = localizar_coluna(df.columns, COLUNAS_ACEITAS["imagem"])
    col_legenda = localizar_coluna(df.columns, COLUNAS_ACEITAS["legenda"])

    session = requests.Session()
    if ZAPI_CLIENT_TOKEN:
        session.headers.update({"Client-Token": ZAPI_CLIENT_TOKEN})

    Path("resultados").mkdir(exist_ok=True)
    log_path = Path("resultados") / f"log_{datetime.now():%Y%m%d_%H%M%S}.csv"
    resultados = []

    total = len(df)
    for i, row in df.iterrows():
        telefone_bruto = row[col_telefone]
        telefone = formatar_telefone(telefone_bruto)
        nome = str(row[col_nome]).strip() if col_nome and valor_valido(row[col_nome]) else ""

        if not telefone:
            resultados.append(
                {
                    "telefone": telefone_bruto,
                    "nome": nome,
                    "status_texto": "PULADO",
                    "status_imagem": "PULADO",
                    "erro": "telefone inválido",
                }
            )
            print(f"[{i + 1}/{total}] Telefone inválido, pulando: {telefone_bruto}")
            continue

        mensagem = (
            row[col_mensagem] if col_mensagem and valor_valido(row[col_mensagem]) else args.mensagem
        )
        if valor_valido(mensagem):
            mensagem = str(mensagem).replace("{nome}", nome)

        imagem_origem = (
            row[col_imagem] if col_imagem and valor_valido(row[col_imagem]) else args.imagem
        )
        legenda = (
            row[col_legenda] if col_legenda and valor_valido(row[col_legenda]) else args.legenda
        )
        legenda = str(legenda).replace("{nome}", nome) if valor_valido(legenda) else ""

        status_texto = status_imagem = ""
        erros = []

        print(f"[{i + 1}/{total}] Enviando para {telefone} ({nome or 'sem nome'})...")

        if valor_valido(mensagem):
            if args.dry_run:
                status_texto = "SIMULADO"
            else:
                try:
                    resp = enviar_texto(session, telefone, str(mensagem))
                    status_texto = "OK" if resp.ok else f"ERRO {resp.status_code}"
                    if not resp.ok:
                        erros.append(f"texto: {resp.text[:200]}")
                except requests.RequestException as e:
                    status_texto = "ERRO"
                    erros.append(f"texto: {e}")
        else:
            status_texto = "SEM_MENSAGEM"

        if valor_valido(imagem_origem):
            try:
                imagem = carregar_imagem(imagem_origem)
                if args.dry_run:
                    status_imagem = "SIMULADO"
                else:
                    resp = enviar_imagem(session, telefone, imagem, legenda)
                    status_imagem = "OK" if resp.ok else f"ERRO {resp.status_code}"
                    if not resp.ok:
                        erros.append(f"imagem: {resp.text[:200]}")
            except Exception as e:
                status_imagem = "ERRO"
                erros.append(f"imagem: {e}")
        else:
            status_imagem = "SEM_IMAGEM"

        resultados.append(
            {
                "telefone": telefone,
                "nome": nome,
                "status_texto": status_texto,
                "status_imagem": status_imagem,
                "erro": " | ".join(erros),
            }
        )

        if i < total - 1:
            time.sleep(random.uniform(args.delay_min, args.delay_max))

    pd.DataFrame(resultados).to_csv(log_path, index=False, encoding="utf-8-sig")
    print(f"\nConcluído. Log salvo em {log_path}")


if __name__ == "__main__":
    main()
