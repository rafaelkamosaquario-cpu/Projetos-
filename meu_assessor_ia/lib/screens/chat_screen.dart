import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../config/theme.dart';
import '../models/assistant.dart';
import '../providers/chat_provider.dart';
import '../providers/financial_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/message_bubble.dart';

class ChatScreen extends StatefulWidget {
  final Assistant assistant;

  const ChatScreen({super.key, required this.assistant});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _speechToText = SpeechToText();
  bool _isListening = false;
  bool _speechAvailable = false;

  @override
  void initState() {
    super.initState();
    _initSpeech();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatProvider>().loadMessages(widget.assistant.id);
    });
  }

  Future<void> _initSpeech() async {
    _speechAvailable = await _speechToText.initialize();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollCtrl.hasClients) {
      _scrollCtrl.animateTo(
        _scrollCtrl.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _sendMessage() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;

    final settings = context.read<SettingsProvider>();
    if (!settings.canSendMessage()) {
      _showLimitDialog();
      return;
    }

    _textCtrl.clear();
    await settings.incrementMessageCount();

    final transaction = await context.read<ChatProvider>().sendMessage(
          assistant: widget.assistant,
          text: text,
        );

    if (transaction != null && mounted) {
      await context.read<FinancialProvider>().addTransaction(transaction);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${transaction.type.name == 'income' ? '📈 Receita' : '📉 Gasto'} registrado: R\$ ${transaction.value.toStringAsFixed(2)}',
            ),
            backgroundColor: transaction.type.name == 'income'
                ? AppTheme.success
                : AppTheme.error,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }

    Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
  }

  void _showLimitDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Limite diário atingido',
            style: TextStyle(color: AppTheme.textPrimary)),
        content: const Text(
          'Você atingiu o limite de 15 mensagens gratuitas hoje.\nFaça upgrade para Premium e tenha mensagens ilimitadas!',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Agora não'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Ver Premium'),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleListening() async {
    if (_isListening) {
      await _speechToText.stop();
      setState(() => _isListening = false);
    } else {
      setState(() => _isListening = true);
      await _speechToText.listen(
        onResult: (result) {
          if (result.finalResult) {
            _textCtrl.text = result.recognizedWords;
            setState(() => _isListening = false);
          }
        },
        localeId: 'pt_BR',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.surface,
        title: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: widget.assistant.color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(widget.assistant.emoji,
                    style: const TextStyle(fontSize: 20)),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.assistant.name,
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Text(
                  'Online',
                  style: TextStyle(
                    color: AppTheme.success,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppTheme.textSecondary),
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (_) => AlertDialog(
                  backgroundColor: AppTheme.surface,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20)),
                  title: const Text('Limpar conversa',
                      style: TextStyle(color: AppTheme.textPrimary)),
                  content: const Text('Deseja apagar todo o histórico?',
                      style: TextStyle(color: AppTheme.textSecondary)),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancelar')),
                    ElevatedButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Apagar')),
                  ],
                ),
              );
              if (confirm == true && mounted) {
                await context
                    .read<ChatProvider>()
                    .clearChat(widget.assistant.id);
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Consumer<ChatProvider>(
              builder: (context, chat, _) {
                final messages = chat.getMessages(widget.assistant.id);

                if (messages.isEmpty) {
                  return _EmptyChat(assistant: widget.assistant);
                }

                return ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 16),
                  itemCount: messages.length,
                  itemBuilder: (_, i) => MessageBubble(
                    message: messages[i],
                    assistantColor: widget.assistant.color,
                  ),
                );
              },
            ),
          ),
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildInput() {
    return Consumer<SettingsProvider>(
      builder: (context, settings, _) => Container(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 12,
          bottom: MediaQuery.of(context).viewInsets.bottom + 12,
        ),
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          border: Border(
            top: BorderSide(color: AppTheme.surfaceLight),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!settings.isPremium)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${settings.remainingMessages} mensagens restantes hoje',
                  style: TextStyle(
                    color: settings.remainingMessages <= 3
                        ? AppTheme.warning
                        : AppTheme.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ),
            Row(
              children: [
                if (_speechAvailable)
                  GestureDetector(
                    onTap: _toggleListening,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: _isListening
                            ? AppTheme.error.withOpacity(0.2)
                            : AppTheme.surfaceLight,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        _isListening ? Icons.mic : Icons.mic_outlined,
                        color: _isListening
                            ? AppTheme.error
                            : AppTheme.textSecondary,
                        size: 22,
                      ),
                    ),
                  ),
                if (_speechAvailable) const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    style: const TextStyle(
                        color: AppTheme.textPrimary, fontSize: 15),
                    maxLines: null,
                    keyboardType: TextInputType.multiline,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: _isListening
                          ? 'Ouvindo...'
                          : 'Digite sua mensagem...',
                      hintStyle: TextStyle(
                        color: _isListening
                            ? AppTheme.error
                            : AppTheme.textSecondary,
                      ),
                      suffixIcon: Consumer<ChatProvider>(
                        builder: (_, chat, __) => GestureDetector(
                          onTap: chat.isLoading(widget.assistant.id)
                              ? null
                              : _sendMessage,
                          child: Container(
                            margin: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: chat.isLoading(widget.assistant.id)
                                    ? [
                                        AppTheme.textSecondary,
                                        AppTheme.textSecondary
                                      ]
                                    : [AppTheme.primary, AppTheme.accent],
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.send_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
                        ),
                      ),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  final Assistant assistant;

  const _EmptyChat({required this.assistant});

  @override
  Widget build(BuildContext context) {
    final suggestions = _getSuggestions(assistant.id);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: assistant.color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Center(
                child: Text(assistant.emoji,
                    style: const TextStyle(fontSize: 40)),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              assistant.name,
              style: const TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              assistant.description,
              style: const TextStyle(
                  color: AppTheme.textSecondary, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ...suggestions.map((s) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GestureDetector(
                    onTap: () {
                      // Fill text field
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: assistant.color.withOpacity(0.2),
                        ),
                      ),
                      child: Text(
                        s,
                        style: const TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                )),
          ],
        ),
      ),
    );
  }

  List<String> _getSuggestions(String id) {
    switch (id) {
      case 'financial':
        return [
          '💰 "Gastei R\$ 50 no mercado"',
          '📈 "Recebi R\$ 2.000 de salário"',
          '📊 "Mostre meus gastos do mês"',
        ];
      case 'amiga':
        return [
          '💬 "Estou me sentindo ansioso hoje"',
          '🌟 "Me dê uma dica para o dia"',
          '😊 "Quero conversar um pouco"',
        ];
      case 'professora':
        return [
          '📚 "Explique fotossíntese"',
          '🔢 "Como calcular juros compostos?"',
          '📖 "Me ajude a estudar inglês"',
        ];
      case 'assessora':
        return [
          '📋 "Como organizar minha semana?"',
          '🎯 "Crie um plano de metas para mim"',
          '⚡ "Dicas para ser mais produtivo"',
        ];
      case 'treinador':
        return [
          '🏋️ "Crie um treino para iniciantes"',
          '🥗 "Dicas de alimentação saudável"',
          '💪 "Como ganhar músculo rápido?"',
        ];
      case 'chef':
        return [
          '🍕 "Receita fácil com frango"',
          '🍰 "Sobremesa para impressionar"',
          '🥘 "O que posso fazer com arroz e feijão?"',
        ];
      default:
        return [];
    }
  }
}
