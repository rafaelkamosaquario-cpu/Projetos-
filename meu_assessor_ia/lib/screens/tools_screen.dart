import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../config/theme.dart';
import '../services/ai_service.dart';

class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 24, 20, 20),
                child: Text(
                  'Ferramentas IA',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _ToolCard(
                    emoji: '📄',
                    title: 'Resumo de PDF / Texto',
                    description:
                        'Envie um arquivo ou texto e receba um resumo inteligente',
                    color: const Color(0xFF2196F3),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const _PdfSummaryScreen()),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _ToolCard(
                    emoji: '✍️',
                    title: 'Criador de Textos',
                    description:
                        'Redações, cartas, textos profissionais e criativos',
                    color: const Color(0xFF9C27B0),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const _TextCreatorScreen()),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _ToolCard(
                    emoji: '🌐',
                    title: 'Tradutor Inteligente',
                    description: 'Traduza textos para qualquer idioma com IA',
                    color: const Color(0xFF4CAF50),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const _TranslatorScreen()),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _ToolCard(
                    emoji: '📧',
                    title: 'Gerador de E-mails',
                    description: 'E-mails profissionais em segundos',
                    color: const Color(0xFFFF9800),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const _EmailGeneratorScreen()),
                    ),
                  ),
                  const SizedBox(height: 80),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToolCard extends StatelessWidget {
  final String emoji;
  final String title;
  final String description;
  final Color color;
  final VoidCallback onTap;

  const _ToolCard({
    required this.emoji,
    required this.title,
    required this.description,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: Text(emoji, style: const TextStyle(fontSize: 28)),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios,
                color: color, size: 16),
          ],
        ),
      ),
    );
  }
}

// PDF Summary Screen
class _PdfSummaryScreen extends StatefulWidget {
  const _PdfSummaryScreen();

  @override
  State<_PdfSummaryScreen> createState() => _PdfSummaryScreenState();
}

class _PdfSummaryScreenState extends State<_PdfSummaryScreen> {
  final _textCtrl = TextEditingController();
  String? _result;
  bool _loading = false;

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['txt'],
    );
    if (result != null && result.files.single.bytes != null) {
      setState(() {
        _textCtrl.text = String.fromCharCodes(result.files.single.bytes!);
      });
    }
  }

  Future<void> _summarize() async {
    if (_textCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final summary = await AiService.summarizeText(_textCtrl.text.trim());
      setState(() => _result = summary);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Resumo com IA'),
        backgroundColor: AppTheme.surface,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: const Text(
                    'Cole seu texto ou carregue um arquivo .txt',
                    style: TextStyle(
                        color: AppTheme.textSecondary, fontSize: 14),
                  ),
                ),
                TextButton.icon(
                  onPressed: _pickFile,
                  icon: const Icon(Icons.upload_file, size: 18),
                  label: const Text('Arquivo'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _textCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              maxLines: 10,
              decoration: const InputDecoration(
                hintText: 'Cole aqui o texto a ser resumido...',
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _summarize,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.summarize),
                label:
                    Text(_loading ? 'Resumindo...' : 'Gerar Resumo com IA'),
              ),
            ),
            if (_result != null) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: MarkdownBody(
                  data: _result!,
                  styleSheet: MarkdownStyleSheet(
                    p: const TextStyle(
                        color: AppTheme.textPrimary, fontSize: 14, height: 1.5),
                    h1: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold),
                    h2: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.bold),
                    listBullet:
                        const TextStyle(color: AppTheme.textPrimary),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// Text Creator Screen
class _TextCreatorScreen extends StatefulWidget {
  const _TextCreatorScreen();

  @override
  State<_TextCreatorScreen> createState() => _TextCreatorScreenState();
}

class _TextCreatorScreenState extends State<_TextCreatorScreen> {
  final _topicCtrl = TextEditingController();
  final _detailsCtrl = TextEditingController();
  String _category = 'Redação escolar';
  String? _result;
  bool _loading = false;

  final _categories = [
    'Redação escolar',
    'Texto argumentativo',
    'Carta/Mensagem',
    'Conteúdo criativo',
    'E-mail profissional',
    'Projeto/Proposta',
  ];

  Future<void> _create() async {
    if (_topicCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final text = await AiService.createText(
        category: _category,
        topic: _topicCtrl.text.trim(),
        details: _detailsCtrl.text.trim(),
      );
      setState(() => _result = text);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Criador de Textos'),
        backgroundColor: AppTheme.surface,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              value: _category,
              dropdownColor: AppTheme.surface,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Tipo de texto',
                labelStyle: TextStyle(color: AppTheme.textSecondary),
              ),
              items: _categories
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                  .toList(),
              onChanged: (v) => setState(() => _category = v!),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _topicCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Tema / Assunto',
                labelStyle: TextStyle(color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _detailsCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Detalhes adicionais (opcional)',
                labelStyle: TextStyle(color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _create,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.auto_awesome),
                label: Text(_loading ? 'Criando...' : 'Criar com IA'),
              ),
            ),
            if (_result != null) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: MarkdownBody(
                  data: _result!,
                  styleSheet: MarkdownStyleSheet(
                    p: const TextStyle(
                        color: AppTheme.textPrimary, fontSize: 14, height: 1.5),
                    h1: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold),
                    listBullet:
                        const TextStyle(color: AppTheme.textPrimary),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// Translator Screen
class _TranslatorScreen extends StatefulWidget {
  const _TranslatorScreen();

  @override
  State<_TranslatorScreen> createState() => _TranslatorScreenState();
}

class _TranslatorScreenState extends State<_TranslatorScreen> {
  final _textCtrl = TextEditingController();
  String _targetLang = 'Inglês';
  String? _result;
  bool _loading = false;

  final _languages = [
    'Inglês', 'Espanhol', 'Francês', 'Alemão', 'Italiano',
    'Japonês', 'Chinês', 'Árabe', 'Russo', 'Português',
  ];

  Future<void> _translate() async {
    if (_textCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final text = await AiService.createText(
        category: 'tradução profissional',
        topic: 'Traduza o seguinte texto para $_targetLang',
        details: _textCtrl.text.trim(),
      );
      setState(() => _result = text);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
          title: const Text('Tradutor'), backgroundColor: AppTheme.surface),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            DropdownButtonFormField<String>(
              value: _targetLang,
              dropdownColor: AppTheme.surface,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Traduzir para',
                labelStyle: TextStyle(color: AppTheme.textSecondary),
              ),
              items: _languages
                  .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                  .toList(),
              onChanged: (v) => setState(() => _targetLang = v!),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _textCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              maxLines: 6,
              decoration: const InputDecoration(
                  hintText: 'Digite o texto a traduzir...'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _translate,
                child: Text(_loading ? 'Traduzindo...' : 'Traduzir'),
              ),
            ),
            if (_result != null) ...[
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(_result!,
                    style: const TextStyle(
                        color: AppTheme.textPrimary, height: 1.5)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// Email Generator Screen
class _EmailGeneratorScreen extends StatefulWidget {
  const _EmailGeneratorScreen();

  @override
  State<_EmailGeneratorScreen> createState() => _EmailGeneratorScreenState();
}

class _EmailGeneratorScreenState extends State<_EmailGeneratorScreen> {
  final _subjectCtrl = TextEditingController();
  final _detailsCtrl = TextEditingController();
  String _tone = 'Formal';
  String? _result;
  bool _loading = false;

  Future<void> _generate() async {
    if (_subjectCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final text = await AiService.createText(
        category: 'E-mail profissional com tom $_tone',
        topic: _subjectCtrl.text.trim(),
        details: _detailsCtrl.text.trim(),
      );
      setState(() => _result = text);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
          title: const Text('E-mails com IA'),
          backgroundColor: AppTheme.surface),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            DropdownButtonFormField<String>(
              value: _tone,
              dropdownColor: AppTheme.surface,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Tom do e-mail',
                labelStyle: TextStyle(color: AppTheme.textSecondary),
              ),
              items: ['Formal', 'Casual', 'Persuasivo', 'Urgente']
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (v) => setState(() => _tone = v!),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _subjectCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Assunto / Objetivo',
                labelStyle: TextStyle(color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _detailsCtrl,
              style: const TextStyle(color: AppTheme.textPrimary),
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Detalhes do e-mail',
                labelStyle: TextStyle(color: AppTheme.textSecondary),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _generate,
                icon: const Icon(Icons.email),
                label: Text(_loading ? 'Gerando...' : 'Gerar E-mail'),
              ),
            ),
            if (_result != null) ...[
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(_result!,
                    style: const TextStyle(
                        color: AppTheme.textPrimary, height: 1.5)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
