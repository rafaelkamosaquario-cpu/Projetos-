import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/assistant.dart';
import '../models/message.dart';
import '../models/transaction.dart';
import '../services/ai_service.dart';
import '../services/database_service.dart';

class ChatProvider extends ChangeNotifier {
  final Map<String, List<Message>> _messages = {};
  final Map<String, bool> _loading = {};
  String _currentAssistantId = 'amiga';

  String get currentAssistantId => _currentAssistantId;

  List<Message> getMessages(String assistantId) =>
      _messages[assistantId] ?? [];

  bool isLoading(String assistantId) => _loading[assistantId] ?? false;

  void setAssistant(String id) {
    _currentAssistantId = id;
    notifyListeners();
  }

  Future<void> loadMessages(String assistantId) async {
    final msgs = await DatabaseService.getMessages(assistantId);
    _messages[assistantId] = msgs;
    notifyListeners();
  }

  Future<FinancialTransaction?> sendMessage({
    required Assistant assistant,
    required String text,
  }) async {
    _messages[assistant.id] ??= [];

    final userMsg = Message(
      assistantId: assistant.id,
      role: MessageRole.user,
      content: text,
    );
    _messages[assistant.id]!.add(userMsg);
    await DatabaseService.insertMessage(userMsg);

    final loadingMsg = Message(
      assistantId: assistant.id,
      role: MessageRole.assistant,
      content: '',
      isLoading: true,
    );
    _messages[assistant.id]!.add(loadingMsg);
    _loading[assistant.id] = true;
    notifyListeners();

    FinancialTransaction? transaction;
    try {
      final history = _messages[assistant.id]!
          .where((m) => !m.isLoading)
          .toList();

      final response = await AiService.sendMessage(
        systemPrompt: assistant.systemPrompt,
        history: history.sublist(0, history.length - 1),
        userMessage: text,
      );

      // Check if financial assistant returned a transaction
      if (assistant.id == 'financial') {
        transaction = _extractTransaction(response, assistant.id);
      }

      _messages[assistant.id]!.remove(loadingMsg);
      final assistantMsg = Message(
        assistantId: assistant.id,
        role: MessageRole.assistant,
        content: response,
      );
      _messages[assistant.id]!.add(assistantMsg);
      await DatabaseService.insertMessage(assistantMsg);
    } catch (e) {
      _messages[assistant.id]!.remove(loadingMsg);
      final errorMsg = Message(
        assistantId: assistant.id,
        role: MessageRole.assistant,
        content: 'Desculpe, ocorreu um erro. Verifique sua conexão e tente novamente.',
      );
      _messages[assistant.id]!.add(errorMsg);
    }

    _loading[assistant.id] = false;
    notifyListeners();
    return transaction;
  }

  FinancialTransaction? _extractTransaction(
      String response, String assistantId) {
    try {
      final jsonRegex = RegExp(r'\{[^{}]*"action"\s*:\s*"register"[^{}]*\}');
      final match = jsonRegex.firstMatch(response);
      if (match == null) return null;

      final json = jsonDecode(match.group(0)!);
      return FinancialTransaction(
        type: json['type'] == 'income'
            ? TransactionType.income
            : TransactionType.expense,
        value: (json['value'] as num).toDouble(),
        category: json['category'] ?? 'Outros',
        description: json['description'] ?? '',
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> clearChat(String assistantId) async {
    await DatabaseService.clearMessages(assistantId);
    _messages[assistantId] = [];
    notifyListeners();
  }
}
