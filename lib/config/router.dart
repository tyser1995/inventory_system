import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/constants/permissions.dart';
import '../presentation/providers/auth_provider.dart';
import '../presentation/screens/auth/login_screen.dart';
import '../presentation/screens/auth/unauthorized_screen.dart';
import '../presentation/screens/dashboard/dashboard_screen.dart';
import '../presentation/screens/products/products_screen.dart';
import '../presentation/screens/products/product_form_screen.dart';
import '../presentation/screens/categories/categories_screen.dart';
import '../presentation/screens/transactions/transactions_screen.dart';
import '../presentation/screens/transactions/transaction_form_screen.dart';
import '../presentation/screens/settings/settings_screen.dart';
import '../presentation/screens/auth/users_screen.dart';
import '../presentation/screens/reports/reports_screen.dart';
import '../presentation/screens/purchase_orders/purchase_orders_screen.dart';
import '../presentation/screens/purchase_orders/purchase_order_form_screen.dart';
import '../presentation/screens/purchase_orders/suppliers_screen.dart';
import '../presentation/screens/warehouses/warehouses_screen.dart';
import '../presentation/screens/sales_orders/sales_orders_screen.dart';
import '../presentation/screens/sales_orders/sales_order_form_screen.dart';
import '../presentation/widgets/common/app_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final user = authState.valueOrNull;
      final loggedIn = user != null;
      final location = state.matchedLocation;
      final isLoginPage = location == '/login';
      final isUnauthorizedPage = location == '/unauthorized';

      // Not logged in → send to login
      if (!loggedIn && !isLoginPage) return '/login';
      // Already logged in → skip login page
      if (loggedIn && isLoginPage) return '/dashboard';

      // Route-level permission guard
      if (loggedIn && !isUnauthorizedPage) {
        final requiredPermission = routePermissions.entries
            .where((e) => location.startsWith(e.key))
            .map((e) => e.value)
            .firstOrNull;

        if (requiredPermission != null &&
            !userHasPermission(user, requiredPermission)) {
          return '/unauthorized';
        }
      }

      return null;
    },
    refreshListenable: RouterListenable(ref, authProvider),
    routes: [
      GoRoute(
        path: '/login',
        builder: (ctx, s) => const LoginScreen(),
      ),
      GoRoute(
        path: '/unauthorized',
        builder: (ctx, s) => const UnauthorizedScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => AppShell(
          currentLocation: state.matchedLocation,
          child: child,
        ),
        routes: [
          GoRoute(path: '/dashboard', builder: (ctx, s) => const DashboardScreen()),
          GoRoute(path: '/products', builder: (ctx, s) => const ProductsScreen()),
          GoRoute(path: '/products/new', builder: (ctx, s) => const ProductFormScreen()),
          GoRoute(
            path: '/products/edit/:id',
            builder: (_, state) => ProductFormScreen(productId: state.pathParameters['id']),
          ),
          GoRoute(path: '/categories', builder: (ctx, s) => const CategoriesScreen()),
          GoRoute(path: '/transactions', builder: (ctx, s) => const TransactionsScreen()),
          GoRoute(path: '/transactions/new', builder: (ctx, s) => const TransactionFormScreen()),
          GoRoute(path: '/users', builder: (ctx, s) => const UsersScreen()),
          GoRoute(path: '/settings', builder: (ctx, s) => const SettingsScreen()),

          // ── New feature routes ────────────────────────────────────────────
          GoRoute(path: '/reports', builder: (ctx, s) => const ReportsScreen()),
          GoRoute(path: '/purchase-orders', builder: (ctx, s) => const PurchaseOrdersScreen()),
          GoRoute(path: '/purchase-orders/new', builder: (ctx, s) => const PurchaseOrderFormScreen()),
          GoRoute(
            path: '/purchase-orders/:id',
            builder: (_, state) =>
                PurchaseOrderFormScreen(purchaseOrderId: state.pathParameters['id']),
          ),
          GoRoute(path: '/suppliers', builder: (ctx, s) => const SuppliersScreen()),
          GoRoute(path: '/warehouses', builder: (ctx, s) => const WarehousesScreen()),
          GoRoute(path: '/sales-orders', builder: (ctx, s) => const SalesOrdersScreen()),
          GoRoute(path: '/sales-orders/new', builder: (ctx, s) => const SalesOrderFormScreen()),
          GoRoute(
            path: '/sales-orders/:id',
            builder: (_, state) =>
                SalesOrderFormScreen(salesOrderId: state.pathParameters['id']),
          ),
        ],
      ),
    ],
  );
});

/// Makes GoRouter refresh when auth state changes.
class RouterListenable extends ChangeNotifier {
  RouterListenable(Ref ref, ProviderListenable provider) {
    ref.listen(provider, (_, __) => notifyListeners());
  }
}
