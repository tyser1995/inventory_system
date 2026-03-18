import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../../core/constants/app_constants.dart';
import '../../core/errors/app_error.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../local/dao/user_dao.dart';
import '../local/database/app_database.dart';

String _hashPassword(String password) =>
    sha256.convert(utf8.encode(password)).toString();

class LocalAuthRepository implements AuthRepository {
  final LocalUserDao _dao;
  final SharedPreferences _prefs;
  static const _uuid = Uuid();

  LocalAuthRepository(this._dao, this._prefs);

  @override
  Future<AppUser> login(String usernameOrEmail, String password) async {
    final user = await _dao.getByUsernameOrEmail(usernameOrEmail);
    if (user == null) throw const AuthError('User not found');
    if (user.passwordHash != _hashPassword(password)) {
      throw const AuthError('Invalid password');
    }
    await _prefs.setString(AppConstants.keyCurrentUserId, user.id);
    await _prefs.setString(AppConstants.keyCurrentUserRole, user.role);
    return user;
  }

  @override
  Future<void> logout() async {
    await _prefs.remove(AppConstants.keyCurrentUserId);
    await _prefs.remove(AppConstants.keyCurrentUserRole);
  }

  @override
  Future<AppUser?> getCurrentUser() async {
    final id = _prefs.getString(AppConstants.keyCurrentUserId);
    if (id == null) return null;
    return _dao.getById(id);
  }

  @override
  Future<AppUser> createUser({
    required String username,
    required String email,
    required String password,
    required String role,
    List<String>? customPermissions,
  }) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final hash = _hashPassword(password);
    final companion = UsersTableCompanion.insert(
      id: id,
      username: username,
      email: email,
      role: role,
      passwordHash: hash,
      createdAt: now,
      customPermissions: Value(
        customPermissions != null ? jsonEncode(customPermissions) : null,
      ),
    );
    await _dao.upsert(companion);
    return AppUser(
      id: id,
      username: username,
      email: email,
      role: role,
      passwordHash: hash,
      createdAt: now,
      customPermissions: customPermissions,
    );
  }

  @override
  Future<List<AppUser>> getUsers() => _dao.getAll();

  @override
  Future<void> updateUser(AppUser user, {String? newPassword}) async {
    final companion = UsersTableCompanion.insert(
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      passwordHash: newPassword != null ? _hashPassword(newPassword) : user.passwordHash,
      createdAt: user.createdAt,
      customPermissions: Value(
        user.customPermissions != null ? jsonEncode(user.customPermissions) : null,
      ),
    );
    await _dao.upsert(companion);
  }

  @override
  Future<void> deleteUser(String id) => _dao.delete(id);
}
