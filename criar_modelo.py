"""Gera uma planilha de exemplo (modelo_contatos.xlsx) com as colunas
aceitas pelo disparador.py."""

import pandas as pd

LINHAS = [
    {
        "telefone": "11999999999",
        "nome": "Maria",
        "mensagem": "Olá {nome}, tudo bem? Temos uma novidade para você!",
        "imagem": "https://exemplo.com/imagem.jpg",
        "legenda": "Confira nossa promoção!",
    },
    {
        "telefone": "21988887777",
        "nome": "João",
        "mensagem": "",
        "imagem": "",
        "legenda": "",
    },
]


def main():
    df = pd.DataFrame(LINHAS)
    df.to_excel("modelo_contatos.xlsx", index=False)
    print("Arquivo 'modelo_contatos.xlsx' criado com sucesso.")


if __name__ == "__main__":
    main()
