# Disparador de WhatsApp em Massa (Z-API + Excel)

Script em Python para enviar mensagens de **texto e imagem** pelo WhatsApp para uma lista de
números carregada de uma planilha Excel, usando a [Z-API](https://www.z-api.io/).

## Pré-requisitos

- Python 3.9+
- Uma instância ativa na Z-API com o WhatsApp conectado (QR Code escaneado no painel)
- `Instance ID` e `Token` da sua instância (e, se tiver ativado, o `Client-Token` da conta)

## Instalação

```bash
pip install -r requirements.txt
```

## Configuração

1. Copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
2. Preencha `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` e (se aplicável) `ZAPI_CLIENT_TOKEN` com os
   dados do painel da Z-API. **Nunca** suba o arquivo `.env` para o Git (ele já está no
   `.gitignore`).

## Planilha de contatos

Gere um modelo de exemplo:

```bash
python criar_modelo.py
```

Isso cria `modelo_contatos.xlsx` com as colunas reconhecidas pelo script:

| coluna     | obrigatório | descrição                                                                 |
|------------|-------------|----------------------------------------------------------------------------|
| `telefone` | sim         | Número com DDD (com ou sem `55`). Ex: `11999999999`                       |
| `nome`     | não         | Usado para personalizar `{nome}` na mensagem/legenda                      |
| `mensagem` | não         | Texto a enviar para esse contato (se vazio, usa `--mensagem` da linha de comando) |
| `imagem`   | não         | URL pública ou caminho local de uma imagem (se vazio, usa `--imagem`)     |
| `legenda`  | não         | Legenda da imagem (se vazio, usa `--legenda`)                             |

Os nomes das colunas não diferenciam maiúsculas/minúsculas e aceitam variações
(`numero`/`phone`, `message`/`texto`, `image`/`foto`, `caption`, etc.).

## Uso

Simule antes de enviar de verdade (não chama a API):

```bash
python disparador.py --excel contatos.xlsx --dry-run
```

Enviar mensagem de texto padrão para todos (planilha pode não ter coluna `mensagem`):

```bash
python disparador.py --excel contatos.xlsx --mensagem "Olá {nome}, segue uma novidade!"
```

Enviar texto + imagem padrão para todos:

```bash
python disparador.py --excel contatos.xlsx \
  --mensagem "Olá {nome}!" \
  --imagem "./promo.jpg" \
  --legenda "Confira nossa promoção"
```

Controlar o intervalo entre os envios (recomendado para reduzir risco de bloqueio):

```bash
python disparador.py --excel contatos.xlsx --delay-min 5 --delay-max 12
```

Cada contato pode ter sua própria mensagem/imagem/legenda diretamente na planilha,
que sempre tem prioridade sobre os parâmetros `--mensagem`/`--imagem`/`--legenda`.

## Resultado dos envios

Ao final, é gerado um log em `resultados/log_AAAAMMDD_HHMMSS.csv` com o status de cada
envio (`OK`, `ERRO ...`, `SIMULADO`, `PULADO`) e o motivo de eventuais falhas.

## Avisos importantes

- Use um intervalo razoável entre mensagens (`--delay-min`/`--delay-max`). Envios muito
  rápidos e em grande volume podem levar o WhatsApp a **bloquear o número**.
- Envie apenas para contatos que **deram consentimento** para recebê-las (LGPD e
  Política de Uso do WhatsApp Business).
- Teste sempre com `--dry-run` e com poucos números antes de disparar para a lista completa.
