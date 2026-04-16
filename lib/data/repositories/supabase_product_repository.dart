import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/category.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';

class SupabaseProductRepository implements ProductRepository {
  final SupabaseClient _client;

  SupabaseProductRepository(this._client);

  Product _mapProduct(Map<String, dynamic> r) => Product(
        id: r['id'] as String,
        name: r['name'] as String,
        description: r['description'] as String?,
        categoryId: r['category_id'] as String,
        categoryName: (r['categories'] as Map<String, dynamic>?)?['name'] as String?,
        price: (r['price'] as num).toDouble(),
        quantity: r['quantity'] as int,
        lowStockThreshold: (r['low_stock_threshold'] as int?) ?? 10,
        sku: r['sku'] as String?,
        unit: r['unit'] as String?,
        createdAt: DateTime.parse(r['created_at'] as String),
        updatedAt: DateTime.parse(r['updated_at'] as String),
      );

  @override
  Future<PagedResult<Product>> getProducts({
    int page = 0,
    int pageSize = 10,
    String? search,
    String? categoryId,
    String? sortColumn,
    bool sortAscending = true,
  }) async {
    // Apply filters first, then ordering and range — order() returns a
    // PostgrestTransformBuilder which no longer accepts filter methods.
    var q = _client.from('products').select('*, categories(name)');

    if (search != null && search.isNotEmpty) {
      q = q.ilike('name', '%$search%');
    }
    if (categoryId != null) {
      q = q.eq('category_id', categoryId);
    }

    final col = _toSnake(sortColumn ?? 'name');
    final rows = await q
        .order(col, ascending: sortAscending)
        .range(page * pageSize, page * pageSize + pageSize - 1);

    final items = rows.map(_mapProduct).toList();
    // Fetch total count separately for pagination
    final countRows = await _client.from('products').select('id');
    return PagedResult(items: items, totalCount: countRows.length);
  }

  @override
  Future<Product?> getProductById(String id) async {
    final row = await _client
        .from('products')
        .select('*, categories(name)')
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : _mapProduct(row);
  }

  @override
  Future<Product> createProduct(Product product) async {
    final now = DateTime.now().toIso8601String();
    final row = await _client.from('products').insert({
      'name': product.name,
      'description': product.description,
      'category_id': product.categoryId,
      'price': product.price,
      'quantity': product.quantity,
      'low_stock_threshold': product.lowStockThreshold,
      'sku': product.sku,
      'unit': product.unit,
      'created_at': now,
      'updated_at': now,
    }).select('*, categories(name)').single();
    return _mapProduct(row);
  }

  @override
  Future<Product> updateProduct(Product product) async {
    final now = DateTime.now().toIso8601String();
    final row = await _client.from('products').update({
      'name': product.name,
      'description': product.description,
      'category_id': product.categoryId,
      'price': product.price,
      'quantity': product.quantity,
      'low_stock_threshold': product.lowStockThreshold,
      'sku': product.sku,
      'unit': product.unit,
      'updated_at': now,
    }).eq('id', product.id).select('*, categories(name)').single();
    return _mapProduct(row);
  }

  @override
  Future<void> deleteProduct(String id) async {
    await _client.from('products').delete().eq('id', id);
  }

  @override
  Future<List<Product>> getLowStockProducts() async {
    // Supabase JS client doesn't support column-to-column comparisons,
    // so we fetch all and filter client-side.
    final all = await _client.from('products').select('*, categories(name)');
    return (all as List)
        .map((r) => _mapProduct(r as Map<String, dynamic>))
        .where((p) => p.isLowStock)
        .toList();
  }

  @override
  Future<int> getTotalProductCount() async {
    final rows = await _client.from('products').select('id');
    return (rows as List).length;
  }

  @override
  Future<int> getTotalStockValue() async {
    final rows = await _client.from('products').select('price, quantity');
    return (rows as List).fold<double>(
      0,
      (sum, r) {
        final m = r as Map<String, dynamic>;
        return sum + (m['price'] as num).toDouble() * (m['quantity'] as int);
      },
    ).toInt();
  }

  String _toSnake(String camel) =>
      camel.replaceAllMapped(RegExp(r'[A-Z]'), (m) => '_${m.group(0)!.toLowerCase()}');
}

class SupabaseCategoryRepository implements CategoryRepository {
  final SupabaseClient _client;

  SupabaseCategoryRepository(this._client);

  Category _map(Map<String, dynamic> r) => Category(
        id: r['id'] as String,
        name: r['name'] as String,
        description: r['description'] as String?,
        createdAt: DateTime.parse(r['created_at'] as String),
      );

  @override
  Future<List<Category>> getCategories({String? search}) async {
    var q = _client.from('categories').select();
    if (search != null && search.isNotEmpty) {
      q = q.ilike('name', '%$search%');
    }
    final rows = await q.order('name');
    return (rows as List).map((r) => _map(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<Category?> getCategoryById(String id) async {
    final row = await _client.from('categories').select().eq('id', id).maybeSingle();
    return row == null ? null : _map(row);
  }

  @override
  Future<Category> createCategory(Category category) async {
    final row = await _client.from('categories').insert({
      'name': category.name,
      'description': category.description,
      'created_at': DateTime.now().toIso8601String(),
    }).select().single();
    return _map(row);
  }

  @override
  Future<Category> updateCategory(Category category) async {
    final row = await _client.from('categories').update({
      'name': category.name,
      'description': category.description,
    }).eq('id', category.id).select().single();
    return _map(row);
  }

  @override
  Future<void> deleteCategory(String id) async {
    await _client.from('categories').delete().eq('id', id);
  }
}
