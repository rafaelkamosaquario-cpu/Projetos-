class AppConstants {
  // Coloque sua chave da API Gemini aqui
  // Obtenha gratuitamente em: https://aistudio.google.com/apikey
  static const String geminiApiKey = 'SUA_CHAVE_GEMINI_AQUI';
  static const String geminiBaseUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  static const String appName = 'Meu Assessor IA';
  static const String appVersion = '1.0.0';

  // Limites versão gratuita
  static const int freeMessagesPerDay = 15;
  static const int freePdfSummariesPerDay = 3;
  static const int freeTextCreationsPerDay = 5;
}
