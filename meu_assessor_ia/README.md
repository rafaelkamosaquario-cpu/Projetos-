# Meu Assessor IA

App Flutter com múltiplos assistentes de IA, controle financeiro por voz e ferramentas de produtividade.

## Funcionalidades

- 6 assistentes com personalidades (Financeiro, Amiga, Professora, Assessora, Treinador, Chef)
- Controle de gastos por voz/texto com IA
- Dashboard financeiro com gráficos
- Resumo de PDF e textos com IA
- Criador de redações e textos
- Tradutor inteligente
- Gerador de e-mails profissionais
- Sistema Premium / Freemium

## Configuração

1. Obtenha sua chave Gemini grátis em: https://aistudio.google.com/apikey
2. Coloque a chave em `lib/config/constants.dart`:
   ```dart
   static const String geminiApiKey = 'SUA_CHAVE_AQUI';
   ```

## Como rodar

```bash
flutter pub get
flutter run
```

## Tech Stack

- Flutter 3.x
- Google Gemini API (gratuita)
- sqflite (banco local)
- Provider (gerenciamento de estado)
- speech_to_text (voz)
- fl_chart (gráficos)
