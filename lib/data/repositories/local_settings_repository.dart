import 'dart:convert';
import 'package:drift/drift.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../../core/constants/app_constants.dart';
import '../../core/services/secure_storage_service.dart';
import '../../core/utils/password_hasher.dart';
import '../../domain/repositories/settings_repository.dart';
import '../local/dao/category_dao.dart';
import '../local/dao/product_dao.dart';
import '../local/dao/transaction_dao.dart';
import '../local/dao/user_dao.dart';
import '../local/database/app_database.dart';

class LocalSettingsRepository implements SettingsRepository {
  final SharedPreferences _prefs;
  final SecureStorageService _secure;
  final LocalUserDao _userDao;
  final LocalProductDao _productDao;
  final LocalCategoryDao _categoryDao;
  final LocalTransactionDao _txDao;

  LocalSettingsRepository(
    this._prefs,
    this._secure,
    this._userDao,
    this._productDao,
    this._categoryDao,
    this._txDao,
  );

  @override
  Future<AppSettings> getSettings() async {
    final dsStr = _prefs.getString(AppConstants.keyDataSource) ?? 'local';
    final theme = _prefs.getString(AppConstants.keyThemeMode) ?? 'light';
    // Supabase credentials are stored in encrypted storage.
    final url = _secure.get(AppConstants.keySupabaseUrl);
    final key = _secure.get(AppConstants.keySupabaseAnonKey);
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
    // Credentials go to encrypted storage, not SharedPreferences.
    if (settings.supabaseUrl != null) {
      await _secure.set(AppConstants.keySupabaseUrl, settings.supabaseUrl!);
    }
    if (settings.supabaseAnonKey != null) {
      await _secure.set(AppConstants.keySupabaseAnonKey, settings.supabaseAnonKey!);
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
      'version': 2,
      'users': users
          .map((u) => {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'role': u.role,
                // password_hash intentionally omitted — restored users must
                // have their password reset by an administrator.
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
                'unit': p.unit,
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
    const uuid = Uuid();

    final users = (data['users'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    for (final u in users) {
      // Backups from v1 may include a legacy SHA-256 hash; v2+ omit it.
      // Users without a stored hash receive a sentinel value that blocks
      // login until an administrator sets a new password.
      final storedHash = (u['passwordHash'] as String?) ??
          (u['password_hash'] as String?) ??
          hashPassword(uuid.v4()); // random bcrypt = effectively locked
      await _userDao.upsert(UsersTableCompanion.insert(
        id: u['id'] as String,
        username: u['username'] as String,
        email: u['email'] as String,
        role: u['role'] as String,
        passwordHash: storedHash,
        createdAt: DateTime.parse(u['createdAt'] as String),
      ));
    }

    final categories =
        (data['categories'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    for (final c in categories) {
      await _categoryDao.upsert(CategoriesTableCompanion.insert(
        id: c['id'] as String,
        name: c['name'] as String,
        description: Value(c['description'] as String?),
        createdAt: DateTime.parse(c['createdAt'] as String),
      ));
    }

    final products =
        (data['products'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    for (final p in products) {
      await _productDao.upsert(ProductsTableCompanion.insert(
        id: p['id'] as String,
        name: p['name'] as String,
        description: Value(p['description'] as String?),
        categoryId: p['categoryId'] as String,
        price: (p['price'] as num).toDouble(),
        quantity: p['quantity'] as int,
        lowStockThreshold: Value(p['lowStockThreshold'] as int? ?? 10),
        sku: Value(p['sku'] as String?),
        unit: Value(p['unit'] as String?),
        createdAt: DateTime.parse(p['createdAt'] as String),
        updatedAt: DateTime.parse(p['updatedAt'] as String),
      ));
    }

    final transactions =
        (data['transactions'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    for (final t in transactions) {
      await _txDao.insertOrIgnore(TransactionsTableCompanion.insert(
        id: t['id'] as String,
        productId: t['productId'] as String,
        type: t['type'] as String,
        quantity: t['quantity'] as int,
        notes: Value(t['notes'] as String?),
        userId: t['userId'] as String,
        createdAt: DateTime.parse(t['createdAt'] as String),
      ));
    }
  }
}
