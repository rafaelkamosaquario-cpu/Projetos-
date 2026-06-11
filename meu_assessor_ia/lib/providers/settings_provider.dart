import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsProvider extends ChangeNotifier {
  bool _isPremium = false;
  int _dailyMessages = 0;
  String _lastMessageDate = '';

  bool get isPremium => _isPremium;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _isPremium = prefs.getBool('is_premium') ?? false;
    _dailyMessages = prefs.getInt('daily_messages') ?? 0;
    _lastMessageDate = prefs.getString('last_message_date') ?? '';
    _resetIfNewDay();
    notifyListeners();
  }

  void _resetIfNewDay() {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    if (_lastMessageDate != today) {
      _dailyMessages = 0;
      _lastMessageDate = today;
    }
  }

  bool canSendMessage() => _isPremium || _dailyMessages < 15;

  Future<void> incrementMessageCount() async {
    _dailyMessages++;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('daily_messages', _dailyMessages);
    await prefs.setString(
        'last_message_date',
        DateTime.now().toIso8601String().substring(0, 10));
    notifyListeners();
  }

  Future<void> setPremium(bool value) async {
    _isPremium = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_premium', value);
    notifyListeners();
  }

  int get remainingMessages => _isPremium ? 999 : (15 - _dailyMessages);
}
