import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../domain/entities/category.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';
import '../local/dao/category_dao.dart';
import '../local/dao/product_dao.dart';
import '../local/database/app_database.dart';
// ignore_for_file: unused_import

class LocalProductRepository implements ProductRepository {
  final LocalProductDao _dao;
  static const _uuid = Uuid();

  LocalProductRepository(this._dao);

  @override
  Future<PagedResult<Product>> getProducts({
    int page = 0,
    int pageSize = 10,
    String? search,
    String? categoryId,
    String? sortColumn,
    bool sortAscending = true,
  }) =>
      _dao.getProducts(
        page: page,
        pageSize: pageSize,
        search: search,
        categoryId: categoryId,
        sortColumn: sortColumn,
        sortAscending: sortAscending,
      );

  @override
  Future<Product?> getProductById(String id) => _dao.getById(id);

  @override
  Future<Product> createProduct(Product product) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final p = product.copyWith(id: id, createdAt: now, updatedAt: now);
    await _dao.upsert(ProductsTableCompanion.insert(
      id: p.id,
      name: p.name,
      description: Value(p.description),
      categoryId: p.categoryId,
      price: p.price,
      quantity: p.quantity,
      lowStockThreshold: Value(p.lowStockThreshold),
      sku: Value(p.sku),
      unit: Value(p.unit),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    ));
    return p;
  }

  @override
  Future<Product> updateProduct(Product product) async {
    final p = product.copyWith(updatedAt: DateTime.now());
    await _dao.upsert(ProductsTableCompanion.insert(
      id: p.id,
      name: p.name,
      description: Value(p.description),
      categoryId: p.categoryId,
      price: p.price,
      quantity: p.quantity,
      lowStockThreshold: Value(p.lowStockThreshold),
      sku: Value(p.sku),
      unit: Value(p.unit),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    ));
    return p;
  }

  @override
  Future<void> deleteProduct(String id) => _dao.delete(id);

  @override
  Future<List<Product>> getLowStockProducts() => _dao.getLowStock();

  @override
  Future<int> getTotalProductCount() => _dao.count();

  @override
  Future<int> getTotalStockValue() async {
    final result = await _dao.getProducts(pageSize: 100000);
    return result.items
        .fold<double>(0, (sum, p) => sum + p.price * p.quantity)
        .toInt();
  }
}

class LocalCategoryRepository implements CategoryRepository {
  final LocalCategoryDao _dao;
  static const _uuid = Uuid();

  LocalCategoryRepository(this._dao);

  @override
  Future<List<Category>> getCategories({String? search}) =>
      _dao.getAll(search: search);

  @override
  Future<Category?> getCategoryById(String id) => _dao.getById(id);

  @override
  Future<Category> createCategory(Category category) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final c = category.copyWith(id: id, createdAt: now);
    await _dao.upsert(CategoriesTableCompanion.insert(
      id: c.id,
      name: c.name,
      description: Value(c.description),
      createdAt: c.createdAt,
    ));
    return c;
  }

  @override
  Future<Category> updateCategory(Category category) async {
    await _dao.upsert(CategoriesTableCompanion.insert(
      id: category.id,
      name: category.name,
      description: Value(category.description),
      createdAt: category.createdAt,
    ));
    return category;
  }

  @override
  Future<void> deleteCategory(String id) => _dao.delete(id);
}
