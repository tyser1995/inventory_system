import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/category.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';
import 'core_providers.dart';

// ─── Product list state ───────────────────────────────────────────────────────

class ProductListState {
  final List<Product> items;
  final int totalCount;
  final int page;
  final int pageSize;
  final String? search;
  final String? categoryId;
  final String sortColumn;
  final bool sortAscending;
  final bool isLoading;
  final String? error;

  const ProductListState({
    this.items = const [],
    this.totalCount = 0,
    this.page = 0,
    this.pageSize = 10,
    this.search,
    this.categoryId,
    this.sortColumn = 'name',
    this.sortAscending = true,
    this.isLoading = false,
    this.error,
  });

  int get totalPages => (totalCount / pageSize).ceil();

  ProductListState copyWith({
    List<Product>? items,
    int? totalCount,
    int? page,
    int? pageSize,
    String? search,
    String? categoryId,
    String? sortColumn,
    bool? sortAscending,
    bool? isLoading,
    String? error,
  }) {
    return ProductListState(
      items: items ?? this.items,
      totalCount: totalCount ?? this.totalCount,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      search: search ?? this.search,
      categoryId: categoryId ?? this.categoryId,
      sortColumn: sortColumn ?? this.sortColumn,
      sortAscending: sortAscending ?? this.sortAscending,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ProductListNotifier extends Notifier<ProductListState> {
  @override
  ProductListState build() {
    // Schedule after build() returns so `state` is initialized before _load reads it.
    Future.microtask(_load);
    return const ProductListState(isLoading: true);
  }

  ProductRepository get _repo => ref.read(productRepositoryProvider);

  Future<void> _load() async {
    try {
      final result = await _repo.getProducts(
        page: state.page,
        pageSize: state.pageSize,
        search: state.search,
        categoryId: state.categoryId,
        sortColumn: state.sortColumn,
        sortAscending: state.sortAscending,
      );
      state = state.copyWith(
        items: result.items,
        totalCount: result.totalCount,
        isLoading: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setPage(int page) {
    state = state.copyWith(page: page, isLoading: true);
    _load();
  }

  void setPageSize(int size) {
    state = state.copyWith(pageSize: size, page: 0, isLoading: true);
    _load();
  }

  void setSearch(String? search) {
    state = state.copyWith(search: search, page: 0, isLoading: true);
    _load();
  }

  void setCategory(String? categoryId) {
    state = state.copyWith(categoryId: categoryId, page: 0, isLoading: true);
    _load();
  }

  void setSort(String column) {
    final asc = state.sortColumn == column ? !state.sortAscending : true;
    state = state.copyWith(sortColumn: column, sortAscending: asc, page: 0, isLoading: true);
    _load();
  }

  Future<void> refresh() {
    state = state.copyWith(isLoading: true);
    return _load();
  }

  Future<void> createProduct(Product product) async {
    await _repo.createProduct(product);
    await _load();
  }

  Future<void> updateProduct(Product product) async {
    await _repo.updateProduct(product);
    await _load();
  }

  Future<void> deleteProduct(String id) async {
    await _repo.deleteProduct(id);
    await _load();
  }
}

final productListProvider =
    NotifierProvider<ProductListNotifier, ProductListState>(ProductListNotifier.new);

// ─── Category list ────────────────────────────────────────────────────────────

final categoryListProvider = FutureProvider<List<Category>>((ref) {
  return ref.watch(categoryRepositoryProvider).getCategories();
});

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────

class DashboardStats {
  final int totalProducts;
  final int lowStockCount;
  final int totalStockValue;
  final List<Product> lowStockProducts;

  const DashboardStats({
    required this.totalProducts,
    required this.lowStockCount,
    required this.totalStockValue,
    required this.lowStockProducts,
  });
}

final dashboardStatsProvider = FutureProvider<DashboardStats>((ref) async {
  final repo = ref.watch(productRepositoryProvider);
  final total = await repo.getTotalProductCount();
  final value = await repo.getTotalStockValue();
  final lowStock = await repo.getLowStockProducts();
  return DashboardStats(
    totalProducts: total,
    lowStockCount: lowStock.length,
    totalStockValue: value,
    lowStockProducts: lowStock,
  );
});
