import '../../domain/entities/user.dart';

/// Granular permission flags used throughout the app.
enum AppPermission {
  // Dashboard
  viewDashboard,

  // Products
  viewProducts,
  manageProducts, // create / edit / delete

  // Categories
  viewCategories,
  manageCategories,

  // Transactions
  viewTransactions,
  manageTransactions, // record stock in/out

  // Users
  viewUsers,
  manageUsers, // create / edit / delete users

  // Settings
  viewSettings,       // appearance / theme only (admin)
  systemSettings,     // data source, Supabase config, backup & restore, scheduled backups (super_admin only)

  // Reporting & Analytics
  viewReports,

  // Purchase Orders
  viewPurchaseOrders,
  managePurchaseOrders,

  // Warehouses
  viewWarehouses,
  manageWarehouses,

  // Sales Orders
  viewSalesOrders,
  manageSalesOrders,
}

/// Maps each role to the set of permissions it grants.
const Map<String, Set<AppPermission>> _rolePermissions = {
  'staff': {
    AppPermission.viewDashboard,
    AppPermission.viewProducts,
    AppPermission.viewCategories,
    AppPermission.viewTransactions,
    AppPermission.manageTransactions,
    AppPermission.viewSalesOrders,
    AppPermission.viewWarehouses,
  },
  'admin': {
    AppPermission.viewDashboard,
    AppPermission.viewProducts,
    AppPermission.manageProducts,
    AppPermission.viewCategories,
    AppPermission.manageCategories,
    AppPermission.viewTransactions,
    AppPermission.manageTransactions,
    AppPermission.viewUsers,
    AppPermission.manageUsers,
    AppPermission.viewSettings,
    AppPermission.viewReports,
    AppPermission.viewPurchaseOrders,
    AppPermission.managePurchaseOrders,
    AppPermission.viewWarehouses,
    AppPermission.manageWarehouses,
    AppPermission.viewSalesOrders,
    AppPermission.manageSalesOrders,
  },
  'super_admin': {
    AppPermission.viewDashboard,
    AppPermission.viewProducts,
    AppPermission.manageProducts,
    AppPermission.viewCategories,
    AppPermission.manageCategories,
    AppPermission.viewTransactions,
    AppPermission.manageTransactions,
    AppPermission.viewUsers,
    AppPermission.manageUsers,
    AppPermission.viewSettings,
    AppPermission.systemSettings,
    AppPermission.viewReports,
    AppPermission.viewPurchaseOrders,
    AppPermission.managePurchaseOrders,
    AppPermission.viewWarehouses,
    AppPermission.manageWarehouses,
    AppPermission.viewSalesOrders,
    AppPermission.manageSalesOrders,
  },
};

/// Returns true if [user] has [permission].
/// If the user has custom permissions, those override the role defaults.
bool userHasPermission(AppUser user, AppPermission permission) {
  if (user.customPermissions != null) {
    return user.customPermissions!.contains(permission.name);
  }
  final perms = _rolePermissions[user.role] ?? {};
  return perms.contains(permission);
}

/// Returns the default set of [AppPermission]s for [role].
Set<AppPermission> defaultPermissionsForRole(String role) =>
    _rolePermissions[role] ?? {};

/// The minimum permission required to visit each route prefix.
///
/// Matching uses longest-prefix-wins (see [router.dart]), so more specific
/// sub-routes always take precedence over their parent.
/// Routes not listed are accessible to any authenticated user.
const Map<String, AppPermission> routePermissions = {
  // Products
  '/products': AppPermission.viewProducts,
  '/products/new': AppPermission.manageProducts,
  '/products/edit': AppPermission.manageProducts,

  // Categories
  '/categories': AppPermission.viewCategories,

  // Transactions
  '/transactions': AppPermission.viewTransactions,
  '/transactions/new': AppPermission.manageTransactions,

  // Users
  '/users': AppPermission.viewUsers,

  // Settings
  '/settings': AppPermission.viewSettings,

  // Reports
  '/reports': AppPermission.viewReports,

  // Purchase orders + suppliers (same access tier)
  '/purchase-orders': AppPermission.viewPurchaseOrders,
  '/purchase-orders/new': AppPermission.managePurchaseOrders,
  '/purchase-orders/': AppPermission.managePurchaseOrders, // covers /:id
  '/suppliers': AppPermission.viewPurchaseOrders,

  // Warehouses
  '/warehouses': AppPermission.viewWarehouses,

  // Sales orders
  '/sales-orders': AppPermission.viewSalesOrders,
  '/sales-orders/new': AppPermission.manageSalesOrders,
  '/sales-orders/': AppPermission.manageSalesOrders, // covers /:id
};
