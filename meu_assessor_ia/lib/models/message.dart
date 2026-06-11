import 'package:uuid/uuid.dart';

enum MessageRole { user, assistant }

class Message {
  final String id;
  final String assistantId;
  final MessageRole role;
  final String content;
  final DateTime timestamp;
  final bool isLoading;

  Message({
    String? id,
    required this.assistantId,
    required this.role,
    required this.content,
    DateTime? timestamp,
    this.isLoading = false,
  })  : id = id ?? const Uuid().v4(),
        timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toMap() => {
        'id': id,
        'assistant_id': assistantId,
        'role': role.name,
        'content': content,
        'timestamp': timestamp.millisecondsSinceEpoch,
      };

  factory Message.fromMap(Map<String, dynamic> map) => Message(
        id: map['id'],
        assistantId: map['assistant_id'],
        role: MessageRole.values.byName(map['role']),
        content: map['content'],
        timestamp: DateTime.fromMillisecondsSinceEpoch(map['timestamp']),
      );
}
