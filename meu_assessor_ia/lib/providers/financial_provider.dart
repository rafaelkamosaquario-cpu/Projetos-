import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import '../models/transaction.dart';
import '../services/database_service.dart';

class FinancialProvider extends ChangeNotifier {
  List<FinancialTransaction> _transactions = [];
  DateTime _selectedMonth = DateTime.now();

  List<FinancialTransaction> get transactions => _transactions;
  DateTime get selectedMonth => _selectedMonth;

  double get totalIncome => _transactions
      .where((t) => t.type == TransactionType.income)
      .fold(0, (sum, t) => sum + t.value);

  double get totalExpense => _transactions
      .where((t) => t.type == TransactionType.expense)
      .fold(0, (sum, t) => sum + t.value);

  double get balance => totalIncome - totalExpense;

  Map<String, double> get expenseByCategory {
    final map = <String, double>{};
    for (final t in _transactions.where(
        (t) => t.type == TransactionType.expense)) {
      map[t.category] = (map[t.category] ?? 0) + t.value;
    }
    return map;
  }

  String get formattedMonth =>
      DateFormat('MMMM yyyy', 'pt_BR').format(_selectedMonth);

  Future<void> loadTransactions() async {
    final start = DateTime(_selectedMonth.year, _selectedMonth.month, 1);
    final end = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0, 23, 59, 59);
    _transactions = await DatabaseService.getTransactions(from: start, to: end);
    notifyListeners();
  }

  Future<void> addTransaction(FinancialTransaction t) async {
    await DatabaseService.insertTransaction(t);
    await loadTransactions();
  }

  Future<void> deleteTransaction(String id) async {
    await DatabaseService.deleteTransaction(id);
    await loadTransactions();
  }

  void changeMonth(int delta) {
    _selectedMonth = DateTime(
      _selectedMonth.year,
      _selectedMonth.month + delta,
    );
    loadTransactions();
  }
}
