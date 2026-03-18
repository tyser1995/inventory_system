import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/permissions.dart';
import '../../domain/entities/user.dart';
import 'auth_provider.dart';

/// Exposes permission-checking helpers for the current user.
class PermissionNotifier extends Notifier<AppUser?> {
  @override
  AppUser? build() => ref.watch(authProvider).valueOrNull;

  /// Returns true if the current user has [permission].
  bool can(AppPermission permission) {
    final user = state;
    if (user == null) return false;
    return userHasPermission(user, permission);
  }

  /// Returns true if the current user has ALL of [permissions].
  bool canAll(List<AppPermission> permissions) =>
      permissions.every(can);

  /// Returns true if the current user has ANY of [permissions].
  bool canAny(List<AppPermission> permissions) =>
      permissions.any(can);
}

final permissionProvider =
    NotifierProvider<PermissionNotifier, AppUser?>(PermissionNotifier.new);
