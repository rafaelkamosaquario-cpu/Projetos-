import os
import requests

ZAPI_INSTANCE = os.getenv("ZAPI_INSTANCE")
ZAPI_TOKEN = os.getenv("ZAPI_TOKEN")
WHATSAPP_GESTOR = os.getenv("WHATSAPP_GESTOR")


def enviar_mensagem(numero: str, mensagem: str) -> bool:
    """Envia mensagem de texto via Z-API."""
    url = f"https://api.z-api.io/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/send-text"
    payload = {"phone": numero, "message": mensagem}
    try:
        r = requests.post(url, json=payload, timeout=10)
        return r.status_code == 200
    except requests.RequestException:
        return False


def enviar_alerta_gestor(mensagem: str) -> bool:
    """Envia alerta direto para o número do gestor."""
    if not WHATSAPP_GESTOR:
        return False
    return enviar_mensagem(WHATSAPP_GESTOR, mensagem)
