import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/utils/password_hasher.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';

class SupabaseAuthRepository implements AuthRepository {
  final SupabaseClient _client;

  SupabaseAuthRepository(this._client);

  AppUser _mapRow(Map<String, dynamic> row) => AppUser(
        id: row['id'] as String,
        username: row['username'] as String,
        email: row['email'] as String,
        role: row['role'] as String,
        passwordHash: row['password_hash'] as String,
        createdAt: DateTime.parse(row['created_at'] as String),
        customPermissions: row['custom_permissions'] != null
            ? List<String>.from(row['custom_permissions'] as List)
            : null,
      );

  @override
  Future<AppUser> login(String usernameOrEmail, String password) async {
    // Fetch the user first — bcrypt verification must happen locally since
    // the hash cannot be computed inside a SQL query.
    final result = await _client
        .from('users')
        .select()
        .or('username.eq.$usernameOrEmail,email.eq.$usernameOrEmail')
        .maybeSingle();

    // Unified error to prevent username enumeration.
    if (result == null ||
        !verifyPassword(password, result['password_hash'] as String)) {
      throw Exception('Invalid credentials');
    }

    // Upgrade legacy SHA-256 hashes to bcrypt in the remote table.
    if (needsUpgrade(result['password_hash'] as String)) {
      await _client
          .from('users')
          .update({'password_hash': hashPassword(password)}).eq(
              'id', result['id'] as String);
    }

    return _mapRow(result);
  }

  @override
  Future<void> logout() async {
    // Stateless — no server-side session to clear for this custom auth model.
  }

  @override
  Future<AppUser?> getCurrentUser() async =>
      null; // Session is persisted locally via SecureStorageService.

  @override
  Future<AppUser> createUser({
    required String username,
    required String email,
    required String password,
    required String role,
    List<String>? customPermissions,
  }) async {
    final row = await _client.from('users').insert({
      'username': username,
      'email': email,
      'role': role,
      'password_hash': hashPassword(password),
      'custom_permissions': customPermissions,
      'created_at': DateTime.now().toIso8601String(),
    }).select().single();
    return _mapRow(row);
  }

  @override
  Future<List<AppUser>> getUsers() async {
    final rows = await _client.from('users').select();
    return rows.map(_mapRow).toList();
  }

  @override
  Future<void> updateUser(AppUser user, {String? newPassword}) async {
    await _client.from('users').update({
      'username': user.username,
      'email': user.email,
      'role': user.role,
      'custom_permissions': user.customPermissions,
      if (newPassword != null) 'password_hash': hashPassword(newPassword),
    }).eq('id', user.id);
  }

  @override
  Future<void> deleteUser(String id) async {
    await _client.from('users').delete().eq('id', id);
  }
}
