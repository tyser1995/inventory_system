import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'app.dart';
import 'core/services/secure_storage_service.dart';
import 'core/utils/password_hasher.dart';
import 'data/local/dao/user_dao.dart';
import 'data/local/database/app_database.dart';
import 'presentation/providers/core_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final prefs = await SharedPreferences.getInstance();
  final secure = await SecureStorageService.init();
  final db = AppDatabase();

  // Seed a default super_admin if the admin account doesn't exist yet.
  // Checks by username so this is safe across schema migrations.
  final userDao = LocalUserDao(db);
  final existing = await userDao.getByUsernameOrEmail('admin');
  if (existing == null) {
    await _seedDefaultUser(userDao);
  }

  runApp(
    ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        sharedPreferencesProvider.overrideWithValue(prefs),
        secureStorageProvider.overrideWithValue(secure),
      ],
      child: const InventoryApp(),
    ),
  );
}

/// Creates admin / admin as the first super_admin account using bcrypt.
Future<void> _seedDefaultUser(LocalUserDao dao) async {
  final companion = UsersTableCompanion.insert(
    id: const Uuid().v4(),
    username: 'admin',
    email: 'admin@inventory.local',
    role: 'super_admin',
    passwordHash: hashPassword('admin'),
    createdAt: DateTime.now(),
  );
  await dao.upsert(companion);
}
