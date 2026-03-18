class AppUser {
  final String id;
  final String username;
  final String email;
  final String role; // super_admin, admin, staff
  final String passwordHash;
  final DateTime createdAt;

  /// When non-null, overrides the role-based permission defaults for this user.
  /// Stored as a list of [AppPermission] names (e.g. ['viewProducts', 'manageProducts']).
  final List<String>? customPermissions;

  const AppUser({
    required this.id,
    required this.username,
    required this.email,
    required this.role,
    required this.passwordHash,
    required this.createdAt,
    this.customPermissions,
  });

  bool get isSuperAdmin => role == 'super_admin';
  bool get isAdmin => role == 'admin' || isSuperAdmin;

  /// True when this user has custom permissions that differ from role defaults.
  bool get hasCustomPermissions => customPermissions != null;

  AppUser copyWith({
    String? id,
    String? username,
    String? email,
    String? role,
    String? passwordHash,
    DateTime? createdAt,
    List<String>? customPermissions,
    bool clearCustomPermissions = false,
  }) {
    return AppUser(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      role: role ?? this.role,
      passwordHash: passwordHash ?? this.passwordHash,
      createdAt: createdAt ?? this.createdAt,
      customPermissions:
          clearCustomPermissions ? null : (customPermissions ?? this.customPermissions),
    );
  }
}
