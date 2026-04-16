import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/constants/permissions.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/permission_provider.dart';

// ─── Nav item definition ──────────────────────────────────────────────────────

class _NavItem {
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String route;
  final AppPermission? requiredPermission;

  const _NavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    required this.route,
    this.requiredPermission,
  });
}

const _allNavItems = [
  _NavItem(
    label: 'Dashboard',
    icon: Icons.dashboard_outlined,
    selectedIcon: Icons.dashboard,
    route: '/dashboard',
  ),
  _NavItem(
    label: 'Products',
    icon: Icons.inventory_2_outlined,
    selectedIcon: Icons.inventory_2,
    route: '/products',
    requiredPermission: AppPermission.viewProducts,
  ),
  _NavItem(
    label: 'Categories',
    icon: Icons.category_outlined,
    selectedIcon: Icons.category,
    route: '/categories',
    requiredPermission: AppPermission.viewCategories,
  ),
  _NavItem(
    label: 'Transactions',
    icon: Icons.swap_horiz_outlined,
    selectedIcon: Icons.swap_horiz,
    route: '/transactions',
    requiredPermission: AppPermission.viewTransactions,
  ),
  _NavItem(
    label: 'Reports',
    icon: Icons.bar_chart_outlined,
    selectedIcon: Icons.bar_chart,
    route: '/reports',
    requiredPermission: AppPermission.viewReports,
  ),
  _NavItem(
    label: 'Purchase Orders',
    icon: Icons.receipt_long_outlined,
    selectedIcon: Icons.receipt_long,
    route: '/purchase-orders',
    requiredPermission: AppPermission.viewPurchaseOrders,
  ),
  _NavItem(
    label: 'Sales Orders',
    icon: Icons.shopping_cart_outlined,
    selectedIcon: Icons.shopping_cart,
    route: '/sales-orders',
    requiredPermission: AppPermission.viewSalesOrders,
  ),
  _NavItem(
    label: 'Warehouses',
    icon: Icons.warehouse_outlined,
    selectedIcon: Icons.warehouse,
    route: '/warehouses',
    requiredPermission: AppPermission.viewWarehouses,
  ),
  _NavItem(
    label: 'Users',
    icon: Icons.people_outline,
    selectedIcon: Icons.people,
    route: '/users',
    requiredPermission: AppPermission.viewUsers,
  ),
  _NavItem(
    label: 'Settings',
    icon: Icons.settings_outlined,
    selectedIcon: Icons.settings,
    route: '/settings',
    requiredPermission: AppPermission.viewSettings,
  ),
];

// ─── Shell ────────────────────────────────────────────────────────────────────

class AppShell extends ConsumerWidget {
  final Widget child;
  final String currentLocation;

  const AppShell({super.key, required this.child, required this.currentLocation});

  bool _isAllowed(WidgetRef ref, _NavItem item) {
    if (item.requiredPermission == null) return true;
    return ref.watch(permissionProvider.notifier).can(item.requiredPermission!);
  }

  void _navigate(BuildContext context, WidgetRef ref, _NavItem item) {
    if (_isAllowed(ref, item)) {
      context.go(item.route);
    } else {
      context.go('/unauthorized');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final isWide = MediaQuery.of(context).size.width >= 768;

    if (isWide) {
      return Scaffold(
        body: Row(
          children: [
            _SideNav(
              navItems: _allNavItems,
              currentLocation: currentLocation,
              username: user?.username ?? '',
              role: user?.role ?? '',
              isAllowed: (item) => _isAllowed(ref, item),
              onNavigate: (item) => _navigate(context, ref, item),
              onLogout: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              },
            ),
            const VerticalDivider(width: 1),
            Expanded(child: child),
          ],
        ),
      );
    }

    // Mobile
    final bottomItems = _allNavItems.take(5).toList();
    final selectedIdx = () {
      final idx = bottomItems.indexWhere((i) => currentLocation.startsWith(i.route));
      return idx < 0 ? 0 : idx;
    }();

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(Icons.inventory, size: 20, color: AppColors.primary),
            const SizedBox(width: 8),
            const Text('Inventory'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_outlined),
            tooltip: 'Logout',
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: NavigationBar(
          selectedIndex: selectedIdx,
          onDestinationSelected: (i) => _navigate(context, ref, bottomItems[i]),
          destinations: bottomItems.map((item) {
            final allowed = _isAllowed(ref, item);
            return NavigationDestination(
              icon: _NavIcon(icon: item.icon, locked: !allowed, selected: false),
              selectedIcon: _NavIcon(icon: item.selectedIcon, locked: !allowed, selected: true),
              label: item.label,
              enabled: allowed,
            );
          }).toList(),
        ),
      ),
    );
  }
}

// ─── Side Navigation ──────────────────────────────────────────────────────────

class _SideNav extends StatelessWidget {
  final List<_NavItem> navItems;
  final String currentLocation;
  final String username;
  final String role;
  final bool Function(_NavItem) isAllowed;
  final void Function(_NavItem) onNavigate;
  final VoidCallback onLogout;

  const _SideNav({
    required this.navItems,
    required this.currentLocation,
    required this.username,
    required this.role,
    required this.isAllowed,
    required this.onNavigate,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Material(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF1E293B)
            : Colors.white,
        child: Column(
          children: [
            // Brand
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.inventory, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Inventory',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            const SizedBox(height: 8),

            // Nav items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                children: navItems.map((item) {
                  final selected = currentLocation.startsWith(item.route);
                  final allowed = isAllowed(item);
                  return _NavTile(
                    item: item,
                    selected: selected,
                    allowed: allowed,
                    onTap: () => onNavigate(item),
                  );
                }).toList(),
              ),
            ),

            // User + logout
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  _Avatar(username: username),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          username,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        _RoleBadge(role: role),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.logout_outlined, size: 18, color: AppColors.textSecondary),
                    tooltip: 'Logout',
                    onPressed: onLogout,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Nav tile ─────────────────────────────────────────────────────────────────

class _NavTile extends StatelessWidget {
  final _NavItem item;
  final bool selected;
  final bool allowed;
  final VoidCallback onTap;

  const _NavTile({
    required this.item,
    required this.selected,
    required this.allowed,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color iconColor;
    final Color textColor;
    final Color? bgColor;

    if (selected) {
      iconColor = AppColors.primary;
      textColor = AppColors.primary;
      bgColor = AppColors.primary.withValues(alpha: 0.10);
    } else if (!allowed) {
      iconColor = AppColors.textSecondary.withValues(alpha: 0.4);
      textColor = AppColors.textSecondary.withValues(alpha: 0.4);
      bgColor = null;
    } else {
      iconColor = AppColors.textSecondary;
      textColor = AppColors.textSecondary;
      bgColor = null;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: bgColor ?? Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Icon(
                      selected ? item.selectedIcon : item.icon,
                      size: 20,
                      color: iconColor,
                    ),
                    if (!allowed)
                      Positioned(
                        right: -4,
                        bottom: -4,
                        child: Container(
                          padding: const EdgeInsets.all(1),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surfaceContainerHighest,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.lock, size: 8, color: AppColors.textSecondary),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.label,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                      color: textColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Helper widgets ───────────────────────────────────────────────────────────

class _NavIcon extends StatelessWidget {
  final IconData icon;
  final bool locked;
  final bool selected;

  const _NavIcon({required this.icon, required this.locked, required this.selected});

  @override
  Widget build(BuildContext context) {
    final color = locked
        ? AppColors.textSecondary.withValues(alpha: 0.4)
        : null;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon, color: color),
        if (locked)
          Positioned(
            right: -4,
            bottom: -4,
            child: Container(
              padding: const EdgeInsets.all(1),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.lock, size: 10, color: AppColors.textSecondary),
            ),
          ),
      ],
    );
  }
}

class _Avatar extends StatelessWidget {
  final String username;
  const _Avatar({required this.username});

  @override
  Widget build(BuildContext context) {
    final color = AppColors.avatarColor(username);
    return CircleAvatar(
      radius: 16,
      backgroundColor: color.withValues(alpha: 0.18),
      child: Text(
        username.isNotEmpty ? username[0].toUpperCase() : '?',
        style: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  final String role;
  const _RoleBadge({required this.role});

  Color _color() {
    switch (role) {
      case 'super_admin':
        return const Color(0xFF8B5CF6);
      case 'admin':
        return AppColors.primary;
      default:
        return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        role.replaceAll('_', ' '),
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
