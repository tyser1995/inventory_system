import 'dart:convert';
import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/user.dart';

extension UserMapper on UsersTableData {
  AppUser toEntity() {
    List<String>? perms;
    if (customPermissions != null) {
      perms = List<String>.from(jsonDecode(customPermissions!) as List);
    }
    return AppUser(
      id: id,
      username: username,
      email: email,
      role: role,
      passwordHash: passwordHash,
      createdAt: createdAt,
      customPermissions: perms,
    );
  }
}

class LocalUserDao {
  final AppDatabase _db;
  LocalUserDao(this._db);

  Future<AppUser?> getByUsernameOrEmail(String value) async {
    final row = await (_db.select(_db.usersTable)
          ..where((t) => t.username.equals(value) | t.email.equals(value)))
        .getSingleOrNull();
    return row?.toEntity();
  }

  Future<AppUser?> getById(String id) async {
    final row = await (_db.select(_db.usersTable)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();
    return row?.toEntity();
  }

  Future<List<AppUser>> getAll() async {
    final rows = await _db.select(_db.usersTable).get();
    return rows.map((r) => r.toEntity()).toList();
  }

  Future<void> upsert(UsersTableCompanion companion) async {
    await _db.into(_db.usersTable).insertOnConflictUpdate(companion);
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.usersTable)..where((t) => t.id.equals(id))).go();
  }

  Future<int> count() async {
    final countExpr = _db.usersTable.id.count();
    final q = _db.selectOnly(_db.usersTable)..addColumns([countExpr]);
    final row = await q.getSingle();
    return row.read(countExpr) ?? 0;
  }
}
