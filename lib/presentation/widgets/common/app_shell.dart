import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/permissions.dart';
import '../../providers/auth_provider.dart';
import '../../providers/permission_provider.dart';

// ─── Nav item definition ──────────────────────────────────────────────────────

class _NavItem {
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String route;

  /// The permission required to navigate to this route.
  /// null means any authenticated user can access it.
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

  int _selectedIndex(List<_NavItem> items) {
    final idx = items.indexWhere((i) => currentLocation.startsWith(i.route));
    return idx < 0 ? 0 : idx;
  }

  bool _isAllowed(WidgetRef ref, _NavItem item) {
    if (item.requiredPermission == null) return true;
    return ref.watch(permissionProvider.notifier).can(item.requiredPermission!);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final selectedIdx = _selectedIndex(_allNavItems);
    final isWide = MediaQuery.of(context).size.width >= 720;

    if (isWide) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              extended: MediaQuery.of(context).size.width >= 1024,
              selectedIndex: selectedIdx,
              onDestinationSelected: (i) {
                final item = _allNavItems[i];
                if (_isAllowed(ref, item)) {
                  context.go(item.route);
                } else {
                  context.go('/unauthorized');
                }
              },
              leading: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Icon(
                  Icons.inventory,
                  color: Theme.of(context).colorScheme.primary,
                  size: 32,
                ),
              ),
              trailing: Expanded(
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (user != null)
                          _UserRoleBadge(user.username, user.role),
                        const SizedBox(height: 8),
                        IconButton(
                          icon: const Icon(Icons.logout),
                          tooltip: 'Logout',
                          onPressed: () async {
                            await ref.read(authProvider.notifier).logout();
                            if (context.mounted) context.go('/login');
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              destinations: _allNavItems.map((item) {
                final allowed = _isAllowed(ref, item);
                return NavigationRailDestination(
                  icon: _NavIcon(
                    icon: item.icon,
                    locked: !allowed,
                    selected: false,
                  ),
                  selectedIcon: _NavIcon(
                    icon: item.selectedIcon,
                    locked: !allowed,
                    selected: true,
                  ),
                  label: _NavLabel(label: item.label, locked: !allowed),
                  disabled: !allowed,
                );
              }).toList(),
            ),
            const VerticalDivider(width: 1),
            Expanded(child: child),
          ],
        ),
      );
    }

    // Mobile — bottom navigation bar
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIdx,
        onDestinationSelected: (i) {
          final item = _allNavItems[i];
          if (_isAllowed(ref, item)) {
            context.go(item.route);
          } else {
            context.go('/unauthorized');
          }
        },
        destinations: _allNavItems.map((item) {
          final allowed = _isAllowed(ref, item);
          return NavigationDestination(
            icon: _NavIcon(icon: item.icon, locked: !allowed, selected: false),
            selectedIcon: _NavIcon(icon: item.selectedIcon, locked: !allowed, selected: true),
            label: item.label,
            enabled: allowed,
          );
        }).toList(),
      ),
    );
  }
}

// ─── Helper widgets ───────────────────────────────────────────────────────────

/// Nav icon with an optional lock badge overlay.
class _NavIcon extends StatelessWidget {
  final IconData icon;
  final bool locked;
  final bool selected;

  const _NavIcon({
    required this.icon,
    required this.locked,
    required this.selected,
  });

  @override
  Widget build(BuildContext context) {
    final color = locked
        ? Theme.of(context).colorScheme.outline.withValues(alpha: 0.45)
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
              child: Icon(
                Icons.lock,
                size: 10,
                color: Theme.of(context).colorScheme.outline,
              ),
            ),
          ),
      ],
    );
  }
}

/// Nav label — dimmed when locked.
class _NavLabel extends StatelessWidget {
  final String label;
  final bool locked;

  const _NavLabel({required this.label, required this.locked});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: locked
            ? Theme.of(context).colorScheme.outline.withValues(alpha: 0.5)
            : null,
      ),
    );
  }
}

/// Small role badge shown under the username in the rail.
class _UserRoleBadge extends StatelessWidget {
  final String username;
  final String role;

  const _UserRoleBadge(this.username, this.role);

  Color _roleColor(BuildContext context, String role) {
    final scheme = Theme.of(context).colorScheme;
    switch (role) {
      case 'super_admin':
        return Colors.purple.shade200;
      case 'admin':
        return scheme.primaryContainer;
      default:
        return scheme.surfaceContainerHighest;
    }
  }

  @override
  Widget build(BuildContext context) {
    final extended = MediaQuery.of(context).size.width >= 1024;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          child: Text(
            username.isNotEmpty ? username[0].toUpperCase() : '?',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        if (extended) ...[
          const SizedBox(height: 4),
          Text(username,
              style: Theme.of(context).textTheme.labelSmall,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: _roleColor(context, role),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              role.replaceAll('_', ' ').toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(fontSize: 9),
            ),
          ),
        ],
      ],
    );
  }
}
