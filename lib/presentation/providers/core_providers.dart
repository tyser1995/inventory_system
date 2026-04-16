import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/constants/app_constants.dart';
import '../../core/services/secure_storage_service.dart';
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
import '../../data/repositories/supabase_auth_repository.dart';
import '../../data/repositories/supabase_lookup_repository.dart';
import '../../data/repositories/supabase_product_repository.dart';
import '../../data/repositories/supabase_purchase_order_repository.dart';
import '../../data/repositories/supabase_sales_order_repository.dart';
import '../../data/repositories/supabase_supplier_repository.dart';
import '../../data/repositories/supabase_transaction_repository.dart';
import '../../data/repositories/supabase_warehouse_repository.dart';
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

/// Pre-loaded synchronous cache over FlutterSecureStorage.
/// Must be overridden in [ProviderScope] with the value returned by
/// [SecureStorageService.init] in main.
final secureStorageProvider = Provider<SecureStorageService>((ref) {
  throw UnimplementedError('Override in ProviderScope');
});

/// Reads the persisted DataSource synchronously from SharedPreferences.
final _dataSourceProvider = Provider<DataSource>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  final raw = prefs.getString(AppConstants.keyDataSource) ?? 'local';
  return raw == 'supabase' ? DataSource.supabase : DataSource.local;
});

// Module-level cache so we only create a new SupabaseClient when the
// credentials actually change, not on every provider rebuild.
SupabaseClient? _supabaseClientCache;
String? _cachedSupabaseUrl;
String? _cachedSupabaseKey;

/// Returns a [SupabaseClient] built from credentials stored in
/// [SecureStorageService], or null when they are not yet configured.
///
/// The client instance is reused across rebuilds as long as the URL and
/// anon-key remain unchanged, avoiding resource leaks from repeated creation.
final supabaseClientProvider = Provider<SupabaseClient?>((ref) {
  final secure = ref.watch(secureStorageProvider);
  final url = secure.get(AppConstants.keySupabaseUrl);
  final anonKey = secure.get(AppConstants.keySupabaseAnonKey);

  if (url == null || url.isEmpty || anonKey == null || anonKey.isEmpty) {
    _supabaseClientCache = null;
    _cachedSupabaseUrl = null;
    _cachedSupabaseKey = null;
    return null;
  }

  if (url != _cachedSupabaseUrl || anonKey != _cachedSupabaseKey) {
    _cachedSupabaseUrl = url;
    _cachedSupabaseKey = anonKey;
    _supabaseClientCache = SupabaseClient(url, anonKey);
  }

  return _supabaseClientCache;
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

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  return LocalSettingsRepository(
    ref.watch(sharedPreferencesProvider),
    ref.watch(secureStorageProvider),
    ref.watch(userDaoProvider),
    ref.watch(productDaoProvider),
    ref.watch(categoryDaoProvider),
    ref.watch(transactionDaoProvider),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseAuthRepository(client);
  }
  return LocalAuthRepository(
    ref.watch(userDaoProvider),
    ref.watch(secureStorageProvider),
  );
});

final productRepositoryProvider = Provider<ProductRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseProductRepository(client);
  }
  return LocalProductRepository(ref.watch(productDaoProvider));
});

final categoryRepositoryProvider = Provider<CategoryRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseCategoryRepository(client);
  }
  return LocalCategoryRepository(ref.watch(categoryDaoProvider));
});

final transactionRepositoryProvider = Provider<TransactionRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseTransactionRepository(client);
  }
  return LocalTransactionRepository(
    ref.watch(transactionDaoProvider),
    ref.watch(productDaoProvider),
    ref.watch(appDatabaseProvider),
  );
});

final supplierRepositoryProvider = Provider<SupplierRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseSupplierRepository(client);
  }
  return LocalSupplierRepository(ref.watch(supplierDaoProvider));
});

final purchaseOrderRepositoryProvider =
    Provider<PurchaseOrderRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabasePurchaseOrderRepository(client);
  }
  return LocalPurchaseOrderRepository(
    ref.watch(purchaseOrderDaoProvider),
    ref.watch(transactionDaoProvider),
    ref.watch(productDaoProvider),
    ref.watch(appDatabaseProvider),
  );
});

final warehouseRepositoryProvider = Provider<WarehouseRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseWarehouseRepository(client);
  }
  return LocalWarehouseRepository(ref.watch(warehouseDaoProvider));
});

final salesOrderRepositoryProvider = Provider<SalesOrderRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseSalesOrderRepository(client);
  }
  return LocalSalesOrderRepository(
    ref.watch(salesOrderDaoProvider),
    ref.watch(transactionDaoProvider),
    ref.watch(productDaoProvider),
    ref.watch(appDatabaseProvider),
  );
});

final lookupRepositoryProvider = Provider<LookupRepository>((ref) {
  if (ref.watch(_dataSourceProvider) == DataSource.supabase) {
    final client = ref.watch(supabaseClientProvider);
    if (client != null) return SupabaseLookupRepository(client);
  }
  return LocalLookupRepository(ref.watch(lookupDaoProvider));
});

final lookupProvider =
    FutureProvider.family<List<AppLookup>, String>((ref, category) {
  return ref.watch(lookupRepositoryProvider).getByCategory(category);
});
