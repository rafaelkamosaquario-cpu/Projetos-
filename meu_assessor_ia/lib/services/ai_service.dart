import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/constants.dart';
import '../models/message.dart';

class AiService {
  static Future<String> sendMessage({
    required String systemPrompt,
    required List<Message> history,
    required String userMessage,
  }) async {
    final contents = <Map<String, dynamic>>[];

    // Build conversation history (max last 20 messages for context)
    final recentHistory = history.length > 20
        ? history.sublist(history.length - 20)
        : history;

    for (final msg in recentHistory) {
      contents.add({
        'role': msg.role == MessageRole.user ? 'user' : 'model',
        'parts': [
          {'text': msg.content}
        ],
      });
    }

    // Add current message
    contents.add({
      'role': 'user',
      'parts': [
        {'text': userMessage}
      ],
    });

    final body = jsonEncode({
      'system_instruction': {
        'parts': [
          {'text': systemPrompt}
        ]
      },
      'contents': contents,
      'generationConfig': {
        'temperature': 0.8,
        'maxOutputTokens': 1024,
      },
      'safetySettings': [
        {
          'category': 'HARM_CATEGORY_HARASSMENT',
          'threshold': 'BLOCK_NONE',
        },
        {
          'category': 'HARM_CATEGORY_HATE_SPEECH',
          'threshold': 'BLOCK_NONE',
        },
      ],
    });

    final response = await http.post(
      Uri.parse(
          '${AppConstants.geminiBaseUrl}?key=${AppConstants.geminiApiKey}'),
      headers: {'Content-Type': 'application/json'},
      body: body,
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['candidates'][0]['content']['parts'][0]['text'] as String;
    } else {
      final error = jsonDecode(response.body);
      throw Exception(
          'Erro na API: ${error['error']['message'] ?? response.body}');
    }
  }

  static Future<String> summarizeText(String text) async {
    const prompt = '''Você é um assistente especializado em criar resumos claros e objetivos.
Crie um resumo bem estruturado do texto abaixo, destacando os pontos principais.
Use tópicos e formatação markdown. Responda em português brasileiro.''';

    final response = await http.post(
      Uri.parse(
          '${AppConstants.geminiBaseUrl}?key=${AppConstants.geminiApiKey}'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'contents': [
          {
            'parts': [
              {'text': '$prompt\n\nTEXTO:\n$text'}
            ]
          }
        ],
        'generationConfig': {
          'temperature': 0.3,
          'maxOutputTokens': 2048,
        },
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['candidates'][0]['content']['parts'][0]['text'] as String;
    }
    throw Exception('Erro ao resumir texto');
  }

  static Future<String> createText({
    required String category,
    required String topic,
    required String details,
  }) async {
    final prompt =
        '''Você é um escritor profissional especializado em $category.
Crie um texto de alta qualidade sobre o tema: "$topic".
Detalhes adicionais: $details
Use formatação markdown. Responda em português brasileiro.''';

    final response = await http.post(
      Uri.parse(
          '${AppConstants.geminiBaseUrl}?key=${AppConstants.geminiApiKey}'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'contents': [
          {
            'parts': [
              {'text': prompt}
            ]
          }
        ],
        'generationConfig': {
          'temperature': 0.9,
          'maxOutputTokens': 2048,
        },
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['candidates'][0]['content']['parts'][0]['text'] as String;
    }
    throw Exception('Erro ao criar texto');
  }
}
