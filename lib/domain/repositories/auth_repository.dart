import '../entities/user.dart';

abstract class AuthRepository {
  Future<AppUser> login(String usernameOrEmail, String password);
  Future<void> logout();
  Future<AppUser?> getCurrentUser();
  Future<AppUser> createUser({
    required String username,
    required String email,
    required String password,
    required String role,
    List<String>? customPermissions,
  });
  Future<List<AppUser>> getUsers();
  Future<void> updateUser(AppUser user, {String? newPassword});
  Future<void> deleteUser(String id);
}
