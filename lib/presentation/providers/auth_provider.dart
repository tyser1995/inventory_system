import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/user.dart';
import 'core_providers.dart';

class AuthNotifier extends AsyncNotifier<AppUser?> {
  @override
  Future<AppUser?> build() async {
    final repo = ref.watch(authRepositoryProvider);
    return repo.getCurrentUser();
  }

  Future<void> login(String usernameOrEmail, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      return repo.login(usernameOrEmail, password);
    });
  }

  Future<void> logout() async {
    final repo = ref.read(authRepositoryProvider);
    await repo.logout();
    state = const AsyncData(null);
  }

  AppUser? get currentUser => state.valueOrNull;

  bool hasRole(String role) {
    final user = currentUser;
    if (user == null) return false;
    return switch (role) {
      'super_admin' => user.isSuperAdmin,
      'admin' => user.isAdmin,
      _ => false, // unknown role never grants access
    };
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AppUser?>(AuthNotifier.new);
