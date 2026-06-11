import 'package:uuid/uuid.dart';

enum TransactionType { expense, income }

class FinancialTransaction {
  final String id;
  final TransactionType type;
  final double value;
  final String category;
  final String description;
  final DateTime date;

  FinancialTransaction({
    String? id,
    required this.type,
    required this.value,
    required this.category,
    required this.description,
    DateTime? date,
  })  : id = id ?? const Uuid().v4(),
        date = date ?? DateTime.now();

  Map<String, dynamic> toMap() => {
        'id': id,
        'type': type.name,
        'value': value,
        'category': category,
        'description': description,
        'date': date.millisecondsSinceEpoch,
      };

  factory FinancialTransaction.fromMap(Map<String, dynamic> map) =>
      FinancialTransaction(
        id: map['id'],
        type: TransactionType.values.byName(map['type']),
        value: map['value'],
        category: map['category'],
        description: map['description'],
        date: DateTime.fromMillisecondsSinceEpoch(map['date']),
      );
}

const List<String> expenseCategories = [
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Moradia',
  'Vestuário',
  'Outros',
];

const List<String> incomeCategories = [
  'Salário',
  'Freelance',
  'Investimento',
  'Presente',
  'Outros',
];
