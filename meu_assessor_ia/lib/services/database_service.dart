import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/message.dart';
import '../models/transaction.dart';

class DatabaseService {
  static Database? _db;

  static Future<Database> get database async {
    _db ??= await _initDb();
    return _db!;
  }

  static Future<Database> _initDb() async {
    final path = join(await getDatabasesPath(), 'assessor_ia.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            assistant_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            value REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            date INTEGER NOT NULL
          )
        ''');
      },
    );
  }

  // Messages
  static Future<void> insertMessage(Message msg) async {
    final db = await database;
    await db.insert('messages', msg.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Future<List<Message>> getMessages(String assistantId,
      {int limit = 50}) async {
    final db = await database;
    final maps = await db.query(
      'messages',
      where: 'assistant_id = ?',
      whereArgs: [assistantId],
      orderBy: 'timestamp DESC',
      limit: limit,
    );
    return maps.map(Message.fromMap).toList().reversed.toList();
  }

  static Future<void> clearMessages(String assistantId) async {
    final db = await database;
    await db.delete('messages',
        where: 'assistant_id = ?', whereArgs: [assistantId]);
  }

  // Transactions
  static Future<void> insertTransaction(FinancialTransaction t) async {
    final db = await database;
    await db.insert('transactions', t.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Future<List<FinancialTransaction>> getTransactions({
    DateTime? from,
    DateTime? to,
  }) async {
    final db = await database;
    String? where;
    List<dynamic>? args;
    if (from != null && to != null) {
      where = 'date >= ? AND date <= ?';
      args = [from.millisecondsSinceEpoch, to.millisecondsSinceEpoch];
    }
    final maps = await db.query(
      'transactions',
      where: where,
      whereArgs: args,
      orderBy: 'date DESC',
    );
    return maps.map(FinancialTransaction.fromMap).toList();
  }

  static Future<void> deleteTransaction(String id) async {
    final db = await database;
    await db.delete('transactions', where: 'id = ?', whereArgs: [id]);
  }
}
