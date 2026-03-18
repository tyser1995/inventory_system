import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../data/local/dao/category_dao.dart';
import '../../data/local/dao/lookup_dao.dart';
import '../../data/local/dao/product_dao.dart';
import '../../data/local/dao/purchase_order_dao.dart';
import '../../data/local/dao/sales_order_dao.dart';
import '../../data/local/dao/supplier_dao.dart';
import '../../data/local/dao/transaction_dao.dart';
import '../../data/local/dao/user_dao.dart';
import '../../data/local/dao/warehouse_dao.dart';
import '../../data/local/database/app_database.dart';
import '../../data/repositories/local_auth_repository.dart';
import '../../data/repositories/local_lookup_repository.dart';
import '../../data/repositories/local_product_repository.dart';
import '../../data/repositories/local_purchase_order_repository.dart';
import '../../data/repositories/local_sales_order_repository.dart';
import '../../data/repositories/local_settings_repository.dart';
import '../../data/repositories/local_supplier_repository.dart';
import '../../data/repositories/local_transaction_repository.dart';
import '../../data/repositories/local_warehouse_repository.dart';
import '../../domain/entities/app_lookup.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/repositories/lookup_repository.dart';
import '../../domain/repositories/product_repository.dart';
import '../../domain/repositories/purchase_order_repository.dart';
import '../../domain/repositories/sales_order_repository.dart';
import '../../domain/repositories/settings_repository.dart';
import '../../domain/repositories/supplier_repository.dart';
import '../../domain/repositories/transaction_repository.dart';
import '../../domain/repositories/warehouse_repository.dart';

// ─── Infrastructure ──────────────────────────────────────────────────────────

final appDatabaseProvider = Provider<AppDatabase>((ref) => AppDatabase());

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('Override in ProviderScope');
});

// ─── DAOs ────────────────────────────────────────────────────────────────────

final userDaoProvider = Provider<LocalUserDao>(
    (ref) => LocalUserDao(ref.watch(appDatabaseProvider)));

final productDaoProvider = Provider<LocalProductDao>(
    (ref) => LocalProductDao(ref.watch(appDatabaseProvider)));

final categoryDaoProvider = Provider<LocalCategoryDao>(
    (ref) => LocalCategoryDao(ref.watch(appDatabaseProvider)));

final transactionDaoProvider = Provider<LocalTransactionDao>(
    (ref) => LocalTransactionDao(ref.watch(appDatabaseProvider)));

final supplierDaoProvider = Provider<LocalSupplierDao>(
    (ref) => LocalSupplierDao(ref.watch(appDatabaseProvider)));

final purchaseOrderDaoProvider = Provider<LocalPurchaseOrderDao>(
    (ref) => LocalPurchaseOrderDao(ref.watch(appDatabaseProvider)));

final warehouseDaoProvider = Provider<LocalWarehouseDao>(
    (ref) => LocalWarehouseDao(ref.watch(appDatabaseProvider)));

final salesOrderDaoProvider = Provider<LocalSalesOrderDao>(
    (ref) => LocalSalesOrderDao(ref.watch(appDatabaseProvider)));

final lookupDaoProvider = Provider<LocalLookupDao>(
    (ref) => LocalLookupDao(ref.watch(appDatabaseProvider)));

// ─── Repositories ────────────────────────────────────────────────────────────

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return LocalAuthRepository(
    ref.watch(userDaoProvider),
    ref.watch(sharedPreferencesProvider),
  );
});

final productRepositoryProvider = Provider<ProductRepository>((ref) {
  return LocalProductRepository(ref.watch(productDaoProvider));
});

final categoryRepositoryProvider = Provider<CategoryRepository>((ref) {
  return LocalCategoryRepository(ref.watch(categoryDaoProvider));
});

final transactionRepositoryProvider = Provider<TransactionRepository>((ref) {
  return LocalTransactionRepository(
    ref.watch(transactionDaoProvider),
    ref.watch(productDaoProvider),
  );
});

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  return LocalSettingsRepository(
    ref.watch(sharedPreferencesProvider),
    ref.watch(userDaoProvider),
    ref.watch(productDaoProvider),
    ref.watch(categoryDaoProvider),
    ref.watch(transactionDaoProvider),
  );
});

final supplierRepositoryProvider = Provider<SupplierRepository>((ref) {
  return LocalSupplierRepository(ref.watch(supplierDaoProvider));
});

final purchaseOrderRepositoryProvider =
    Provider<PurchaseOrderRepository>((ref) {
  return LocalPurchaseOrderRepository(
    ref.watch(purchaseOrderDaoProvider),
    ref.watch(transactionDaoProvider),
    ref.watch(productDaoProvider),
  );
});

final warehouseRepositoryProvider = Provider<WarehouseRepository>((ref) {
  return LocalWarehouseRepository(ref.watch(warehouseDaoProvider));
});

final salesOrderRepositoryProvider = Provider<SalesOrderRepository>((ref) {
  return LocalSalesOrderRepository(
    ref.watch(salesOrderDaoProvider),
    ref.watch(transactionDaoProvider),
    ref.watch(productDaoProvider),
  );
});

final lookupRepositoryProvider = Provider<LookupRepository>((ref) {
  return LocalLookupRepository(ref.watch(lookupDaoProvider));
});

final lookupProvider =
    FutureProvider.family<List<AppLookup>, String>((ref, category) {
  return ref.watch(lookupRepositoryProvider).getByCategory(category);
});
