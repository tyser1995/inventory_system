import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/constants/permissions.dart';
import '../../../domain/entities/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../../providers/permission_provider.dart';
import '../../widgets/common/confirm_dialog.dart';

final _usersProvider = FutureProvider<List<AppUser>>((ref) async {
  return ref.watch(authRepositoryProvider).getUsers();
});

// ─── Permission groups for the dialog ────────────────────────────────────────

const _permissionGroups = [
  ('Dashboard', [AppPermission.viewDashboard]),
  ('Products', [AppPermission.viewProducts, AppPermission.manageProducts]),
  ('Categories', [AppPermission.viewCategories, AppPermission.manageCategories]),
  ('Transactions', [AppPermission.viewTransactions, AppPermission.manageTransactions]),
  ('Reports', [AppPermission.viewReports]),
  ('Purchase Orders', [AppPermission.viewPurchaseOrders, AppPermission.managePurchaseOrders]),
  ('Warehouses', [AppPermission.viewWarehouses, AppPermission.manageWarehouses]),
  ('Sales Orders', [AppPermission.viewSalesOrders, AppPermission.manageSalesOrders]),
  ('Users', [AppPermission.viewUsers, AppPermission.manageUsers]),
  ('Settings', [AppPermission.viewSettings, AppPermission.systemSettings]),
];

// ─── Screen ───────────────────────────────────────────────────────────────────

class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});

  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> {
  String _search = '';
  String? _roleFilter;

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(authProvider).valueOrNull;
    final perms = ref.watch(permissionProvider.notifier);
    final canManageUsers = perms.can(AppPermission.manageUsers);
    final usersAsync = ref.watch(_usersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('User Management'),
        actions: [
          if (canManageUsers)
            FilledButton.icon(
              icon: const Icon(Icons.person_add_outlined),
              label: const Text('Add User'),
              onPressed: () => _showForm(context, ref, null, currentUser),
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: Column(
        children: [
          // ── Search + filter bar ─────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search users…',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      isDense: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          vertical: 10, horizontal: 12),
                    ),
                    onChanged: (v) => setState(() => _search = v.toLowerCase()),
                  ),
                ),
                const SizedBox(width: 12),
                // Role filter chips
                _RoleFilterChip(
                  label: 'All',
                  selected: _roleFilter == null,
                  onTap: () => setState(() => _roleFilter = null),
                ),
                const SizedBox(width: 6),
                _RoleFilterChip(
                  label: 'Super Admin',
                  role: AppConstants.roleSuperAdmin,
                  selected: _roleFilter == AppConstants.roleSuperAdmin,
                  onTap: () => setState(() =>
                      _roleFilter = _roleFilter == AppConstants.roleSuperAdmin
                          ? null
                          : AppConstants.roleSuperAdmin),
                ),
                const SizedBox(width: 6),
                _RoleFilterChip(
                  label: 'Admin',
                  role: AppConstants.roleAdmin,
                  selected: _roleFilter == AppConstants.roleAdmin,
                  onTap: () => setState(() =>
                      _roleFilter = _roleFilter == AppConstants.roleAdmin
                          ? null
                          : AppConstants.roleAdmin),
                ),
                const SizedBox(width: 6),
                _RoleFilterChip(
                  label: 'Staff',
                  role: AppConstants.roleStaff,
                  selected: _roleFilter == AppConstants.roleStaff,
                  onTap: () => setState(() =>
                      _roleFilter = _roleFilter == AppConstants.roleStaff
                          ? null
                          : AppConstants.roleStaff),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),

          // ── User list ────────────────────────────────────────────────
          Expanded(
            child: usersAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (users) {
                final filtered = users.where((u) {
                  if (_roleFilter != null && u.role != _roleFilter) return false;
                  if (_search.isNotEmpty) {
                    return u.username.toLowerCase().contains(_search) ||
                        u.email.toLowerCase().contains(_search);
                  }
                  return true;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.people_outline,
                            size: 48,
                            color: Theme.of(context).colorScheme.outline),
                        const SizedBox(height: 12),
                        Text('No users found',
                            style: Theme.of(context)
                                .textTheme
                                .bodyLarge
                                ?.copyWith(
                                    color:
                                        Theme.of(context).colorScheme.outline)),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final u = filtered[i];
                    final isCurrentUser = u.id == currentUser?.id;
                    return _UserCard(
                      user: u,
                      isCurrentUser: isCurrentUser,
                      canManage: canManageUsers,
                      onEdit: () => _showForm(context, ref, u, currentUser),
                      onDelete: () async {
                        final ok = await showConfirmDialog(
                          context,
                          title: 'Delete User',
                          content:
                              'Delete user "${u.username}"? This cannot be undone.',
                          confirmColor: Colors.red,
                        );
                        if (ok) {
                          await ref
                              .read(authRepositoryProvider)
                              .deleteUser(u.id);
                          ref.invalidate(_usersProvider);
                        }
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showForm(
      BuildContext context, WidgetRef ref, AppUser? existing, AppUser? currentUser) {
    final usernameCtrl = TextEditingController(text: existing?.username);
    final emailCtrl = TextEditingController(text: existing?.email);
    final passwordCtrl = TextEditingController();
    String selectedRole = existing?.role ?? AppConstants.roleStaff;
    final formKey = GlobalKey<FormState>();

    final canAssignSuperAdmin = currentUser != null &&
        userHasPermission(currentUser, AppPermission.systemSettings);
    final availableRoles = canAssignSuperAdmin
        ? [AppConstants.roleSuperAdmin, AppConstants.roleAdmin, AppConstants.roleStaff]
        : [AppConstants.roleAdmin, AppConstants.roleStaff];

    Set<AppPermission>? customPerms = existing?.customPermissions != null
        ? existing!.customPermissions!
            .map((n) => AppPermission.values.firstWhere(
                  (p) => p.name == n,
                  orElse: () => AppPermission.viewDashboard,
                ))
            .toSet()
        : null;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final effectivePerms = customPerms ?? defaultPermissionsForRole(selectedRole);
          final isCustom = customPerms != null;
          final colorScheme = Theme.of(ctx).colorScheme;

          return Dialog(
            insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Scaffold(
                backgroundColor: colorScheme.surface,
                appBar: AppBar(
                  backgroundColor: colorScheme.surface,
                  automaticallyImplyLeading: false,
                  title: Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: _roleColor(selectedRole, colorScheme),
                        child: Text(
                          existing?.username.isNotEmpty == true
                              ? existing!.username[0].toUpperCase()
                              : '?',
                          style: TextStyle(
                              color: _roleOnColor(selectedRole, colorScheme),
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(existing == null ? 'New User' : 'Edit User'),
                    ],
                  ),
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                body: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 0),
                  child: Form(
                    key: formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 8),

                        // ── Account info ──────────────────────────────
                        _SectionLabel('Account', colorScheme),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: usernameCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Username *',
                            prefixIcon: Icon(Icons.person_outline),
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) =>
                              v == null || v.isEmpty ? 'Required' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: emailCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Email *',
                            prefixIcon: Icon(Icons.email_outlined),
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) =>
                              v == null || v.isEmpty ? 'Required' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: passwordCtrl,
                          decoration: InputDecoration(
                            labelText: existing == null
                                ? 'Password *'
                                : 'New Password (leave blank to keep)',
                            prefixIcon: const Icon(Icons.lock_outline),
                            border: const OutlineInputBorder(),
                          ),
                          obscureText: true,
                          validator: (v) {
                            if (existing == null &&
                                (v == null || v.isEmpty)) return 'Required';
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: selectedRole,
                          decoration: const InputDecoration(
                            labelText: 'Role',
                            prefixIcon: Icon(Icons.badge_outlined),
                            border: OutlineInputBorder(),
                          ),
                          items: availableRoles
                              .map((r) => DropdownMenuItem(
                                    value: r,
                                    child: Text(_roleLabel(r)),
                                  ))
                              .toList(),
                          onChanged: (v) => setDialogState(() {
                            selectedRole = v!;
                            customPerms = null;
                          }),
                        ),
                        const SizedBox(height: 20),

                        // ── Permissions ───────────────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _SectionLabel('Permissions', colorScheme),
                            if (isCustom)
                              TextButton.icon(
                                icon: const Icon(Icons.refresh, size: 16),
                                label: const Text('Reset to defaults'),
                                style: TextButton.styleFrom(
                                    visualDensity: VisualDensity.compact),
                                onPressed: () =>
                                    setDialogState(() => customPerms = null),
                              ),
                          ],
                        ),
                        if (!isCustom)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline,
                                    size: 14,
                                    color: colorScheme.outline),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    'Using role defaults — toggle any permission to override',
                                    style: Theme.of(ctx)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(color: colorScheme.outline),
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              children: [
                                Icon(Icons.tune,
                                    size: 14,
                                    color: colorScheme.primary),
                                const SizedBox(width: 6),
                                Text(
                                  'Custom permissions active',
                                  style: Theme.of(ctx)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: colorScheme.primary),
                                ),
                              ],
                            ),
                          ),

                        // Permission groups
                        ...(_permissionGroups.map((group) {
                          final (groupLabel, perms) = group;
                          return _PermissionGroup(
                            label: groupLabel,
                            permissions: perms,
                            effectivePerms: effectivePerms,
                            colorScheme: colorScheme,
                            onToggle: (perm, val) {
                              setDialogState(() {
                                customPerms ??= Set.from(
                                    defaultPermissionsForRole(selectedRole));
                                if (val) {
                                  customPerms!.add(perm);
                                } else {
                                  customPerms!.remove(perm);
                                }
                              });
                            },
                          );
                        })),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
                bottomNavigationBar: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: FilledButton(
                          onPressed: () async {
                            if (!formKey.currentState!.validate()) return;
                            final repo = ref.read(authRepositoryProvider);
                            final customPermList =
                                customPerms?.map((p) => p.name).toList();
                            if (existing == null) {
                              await repo.createUser(
                                username: usernameCtrl.text.trim(),
                                email: emailCtrl.text.trim(),
                                password: passwordCtrl.text,
                                role: selectedRole,
                                customPermissions: customPermList,
                              );
                            } else {
                              await repo.updateUser(
                                existing.copyWith(
                                  username: usernameCtrl.text.trim(),
                                  email: emailCtrl.text.trim(),
                                  role: selectedRole,
                                  customPermissions: customPermList,
                                  clearCustomPermissions: customPermList == null,
                                ),
                                newPassword: passwordCtrl.text.isEmpty
                                    ? null
                                    : passwordCtrl.text,
                              );
                            }
                            ref.invalidate(_usersProvider);
                            if (ctx.mounted) Navigator.pop(ctx);
                          },
                          child: Text(existing == null ? 'Create User' : 'Save Changes'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─── User card ────────────────────────────────────────────────────────────────

class _UserCard extends StatelessWidget {
  final AppUser user;
  final bool isCurrentUser;
  final bool canManage;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _UserCard({
    required this.user,
    required this.isCurrentUser,
    required this.canManage,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final avatarBg = _roleColor(user.role, colorScheme);
    final avatarFg = _roleOnColor(user.role, colorScheme);
    final initials = user.username.isNotEmpty
        ? user.username[0].toUpperCase()
        : '?';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 24,
              backgroundColor: avatarBg,
              child: Text(
                initials,
                style: TextStyle(
                  color: avatarFg,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
            const SizedBox(width: 16),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        user.username,
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      if (isCurrentUser) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'You',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: colorScheme.onPrimaryContainer,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(width: 8),
                      _RoleChip(user.role),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.email_outlined,
                          size: 13, color: colorScheme.outline),
                      const SizedBox(width: 4),
                      Text(
                        user.email,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Icons.calendar_today_outlined,
                          size: 13, color: colorScheme.outline),
                      const SizedBox(width: 4),
                      Text(
                        'Joined ${user.createdAt.toString().substring(0, 10)}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.outline),
                      ),
                      if (user.customPermissions != null) ...[
                        const SizedBox(width: 12),
                        Icon(Icons.tune,
                            size: 13, color: colorScheme.primary),
                        const SizedBox(width: 4),
                        Text(
                          'Custom permissions',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: colorScheme.primary),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            // Actions
            if (canManage) ...[
              IconButton(
                icon: Icon(Icons.edit_outlined,
                    color: colorScheme.primary, size: 20),
                tooltip: 'Edit',
                onPressed: onEdit,
              ),
              if (!isCurrentUser)
                IconButton(
                  icon: Icon(Icons.delete_outline,
                      color: colorScheme.error, size: 20),
                  tooltip: 'Delete',
                  onPressed: onDelete,
                ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Permission group widget ──────────────────────────────────────────────────

class _PermissionGroup extends StatelessWidget {
  final String label;
  final List<AppPermission> permissions;
  final Set<AppPermission> effectivePerms;
  final ColorScheme colorScheme;
  final void Function(AppPermission, bool) onToggle;

  const _PermissionGroup({
    required this.label,
    required this.permissions,
    required this.effectivePerms,
    required this.colorScheme,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: colorScheme.outline,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const Divider(height: 1),
          ...permissions.map((perm) {
            final checked = effectivePerms.contains(perm);
            return CheckboxListTile(
              dense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12),
              title: Text(
                _permissionLabel(perm),
                style: const TextStyle(fontSize: 13),
              ),
              value: checked,
              activeColor: colorScheme.primary,
              checkColor: colorScheme.onPrimary,
              onChanged: (v) => onToggle(perm, v == true),
            );
          }),
        ],
      ),
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  final ColorScheme colorScheme;
  const _SectionLabel(this.text, this.colorScheme);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: colorScheme.primary,
        letterSpacing: 1.0,
      ),
    );
  }
}

class _RoleFilterChip extends StatelessWidget {
  final String label;
  final String? role;
  final bool selected;
  final VoidCallback onTap;

  const _RoleFilterChip({
    required this.label,
    this.role,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final bg = role != null
        ? _roleColor(role!, colorScheme)
        : colorScheme.surfaceContainerHighest;
    final fg = role != null
        ? _roleOnColor(role!, colorScheme)
        : colorScheme.onSurfaceVariant;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? bg : Colors.transparent,
          border: Border.all(
            color: selected ? bg : colorScheme.outlineVariant,
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: selected ? fg : colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

class _RoleChip extends StatelessWidget {
  final String role;
  const _RoleChip(this.role);

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _roleColor(role, colorScheme),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        _roleLabel(role),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: _roleOnColor(role, colorScheme),
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

// ─── Role color helpers (theme-aware) ────────────────────────────────────────

Color _roleColor(String role, ColorScheme cs) {
  return switch (role) {
    'super_admin' => cs.primaryContainer,
    'admin' => cs.secondaryContainer,
    _ => cs.tertiaryContainer,
  };
}

Color _roleOnColor(String role, ColorScheme cs) {
  return switch (role) {
    'super_admin' => cs.onPrimaryContainer,
    'admin' => cs.onSecondaryContainer,
    _ => cs.onTertiaryContainer,
  };
}

String _roleLabel(String role) {
  return switch (role) {
    'super_admin' => 'Super Admin',
    'admin' => 'Admin',
    _ => 'Staff',
  };
}

String _permissionLabel(AppPermission p) {
  const labels = {
    AppPermission.viewDashboard: 'View Dashboard',
    AppPermission.viewProducts: 'View Products',
    AppPermission.manageProducts: 'Manage (create / edit / delete)',
    AppPermission.viewCategories: 'View Categories',
    AppPermission.manageCategories: 'Manage Categories',
    AppPermission.viewTransactions: 'View Transactions',
    AppPermission.manageTransactions: 'Record Stock In / Out',
    AppPermission.viewUsers: 'View Users',
    AppPermission.manageUsers: 'Manage Users',
    AppPermission.viewSettings: 'View Settings',
    AppPermission.systemSettings: 'System Settings (backup, data source)',
    AppPermission.viewReports: 'View Reports & Analytics',
    AppPermission.viewPurchaseOrders: 'View Purchase Orders',
    AppPermission.managePurchaseOrders: 'Manage Purchase Orders',
    AppPermission.viewWarehouses: 'View Warehouses',
    AppPermission.manageWarehouses: 'Manage Warehouses',
    AppPermission.viewSalesOrders: 'View Sales Orders',
    AppPermission.manageSalesOrders: 'Manage Sales Orders',
  };
  return labels[p] ?? p.name;
}
