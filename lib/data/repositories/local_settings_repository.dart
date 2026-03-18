import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';
import '../../domain/repositories/settings_repository.dart';
import '../local/dao/category_dao.dart';
import '../local/dao/product_dao.dart';
import '../local/dao/transaction_dao.dart';
import '../local/dao/user_dao.dart';

class LocalSettingsRepository implements SettingsRepository {
  final SharedPreferences _prefs;
  final LocalUserDao _userDao;
  final LocalProductDao _productDao;
  final LocalCategoryDao _categoryDao;
  final LocalTransactionDao _txDao;

  LocalSettingsRepository(
    this._prefs,
    this._userDao,
    this._productDao,
    this._categoryDao,
    this._txDao,
  );

  @override
  Future<AppSettings> getSettings() async {
    final dsStr = _prefs.getString(AppConstants.keyDataSource) ?? 'local';
    final theme = _prefs.getString(AppConstants.keyThemeMode) ?? 'system';
    final url = _prefs.getString(AppConstants.keySupabaseUrl);
    final key = _prefs.getString(AppConstants.keySupabaseAnonKey);
    final backupsJson = _prefs.getString(AppConstants.keyScheduledBackups);
    final backups = backupsJson != null
        ? List<String>.from(jsonDecode(backupsJson) as List)
        : <String>[];
    return AppSettings(
      dataSource: dsStr == 'supabase' ? DataSource.supabase : DataSource.local,
      themeMode: theme,
      supabaseUrl: url,
      supabaseAnonKey: key,
      scheduledBackupTimes: backups,
    );
  }

  @override
  Future<void> saveSettings(AppSettings settings) async {
    await _prefs.setString(
        AppConstants.keyDataSource,
        settings.dataSource == DataSource.supabase ? 'supabase' : 'local');
    await _prefs.setString(AppConstants.keyThemeMode, settings.themeMode);
    if (settings.supabaseUrl != null) {
      await _prefs.setString(AppConstants.keySupabaseUrl, settings.supabaseUrl!);
    }
    if (settings.supabaseAnonKey != null) {
      await _prefs.setString(AppConstants.keySupabaseAnonKey, settings.supabaseAnonKey!);
    }
    await _prefs.setString(
        AppConstants.keyScheduledBackups, jsonEncode(settings.scheduledBackupTimes));
  }

  @override
  Future<Map<String, dynamic>> exportBackup() async {
    final users = await _userDao.getAll();
    final categories = await _categoryDao.getAll();
    final products = await _productDao.getProducts(pageSize: 100000);
    final transactions = await _txDao.getAll();

    return {
      'exported_at': DateTime.now().toIso8601String(),
      'version': 1,
      'users': users
          .map((u) => {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'role': u.role,
                'passwordHash': u.passwordHash,
                'createdAt': u.createdAt.toIso8601String(),
              })
          .toList(),
      'categories': categories
          .map((c) => {
                'id': c.id,
                'name': c.name,
                'description': c.description,
                'createdAt': c.createdAt.toIso8601String(),
              })
          .toList(),
      'products': products.items
          .map((p) => {
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'categoryId': p.categoryId,
                'price': p.price,
                'quantity': p.quantity,
                'lowStockThreshold': p.lowStockThreshold,
                'sku': p.sku,
                'createdAt': p.createdAt.toIso8601String(),
                'updatedAt': p.updatedAt.toIso8601String(),
              })
          .toList(),
      'transactions': transactions
          .map((t) => {
                'id': t.id,
                'productId': t.productId,
                'type': t.type.name,
                'quantity': t.quantity,
                'notes': t.notes,
                'userId': t.userId,
                'createdAt': t.createdAt.toIso8601String(),
              })
          .toList(),
    };
  }

  @override
  Future<void> importBackup(Map<String, dynamic> data) async {
    // Import is handled by higher-level service that calls individual DAOs
    // This stub allows the interface to be satisfied; full logic is in BackupService
    throw UnimplementedError('Use BackupService.restoreFromJson()');
  }
}
