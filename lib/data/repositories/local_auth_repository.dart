import 'dart:convert';
import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../core/constants/app_constants.dart';
import '../../core/errors/app_error.dart';
import '../../core/services/secure_storage_service.dart';
import '../../core/utils/password_hasher.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../local/dao/user_dao.dart';
import '../local/database/app_database.dart';

class LocalAuthRepository implements AuthRepository {
  final LocalUserDao _dao;
  final SecureStorageService _secure;
  static const _uuid = Uuid();

  LocalAuthRepository(this._dao, this._secure);

  @override
  Future<AppUser> login(String usernameOrEmail, String password) async {
    final user = await _dao.getByUsernameOrEmail(usernameOrEmail);
    // Unified error prevents username enumeration.
    if (user == null || !verifyPassword(password, user.passwordHash)) {
      throw const AuthError('Invalid credentials');
    }
    // Seamlessly upgrade legacy SHA-256 hashes to bcrypt on a successful login.
    if (needsUpgrade(user.passwordHash)) {
      await _dao.upsert(UsersTableCompanion.insert(
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        passwordHash: hashPassword(password),
        createdAt: user.createdAt,
        customPermissions: Value(
          user.customPermissions != null ? jsonEncode(user.customPermissions) : null,
        ),
      ));
    }
    await _secure.set(AppConstants.keyCurrentUserId, user.id);
    return user;
  }

  @override
  Future<void> logout() async {
    await _secure.remove(AppConstants.keyCurrentUserId);
  }

  @override
  Future<AppUser?> getCurrentUser() async {
    final id = _secure.get(AppConstants.keyCurrentUserId);
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
    final hash = hashPassword(password);
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
      passwordHash: newPassword != null ? hashPassword(newPassword) : user.passwordHash,
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
