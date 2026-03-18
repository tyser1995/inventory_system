import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/product.dart';
import '../../../domain/repositories/product_repository.dart';

extension ProductMapper on ProductsTableData {
  Product toEntity({String? categoryName}) => Product(
        id: id,
        name: name,
        description: description,
        categoryId: categoryId,
        categoryName: categoryName,
        price: price,
        quantity: quantity,
        lowStockThreshold: lowStockThreshold,
        sku: sku,
        unit: unit,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}

class LocalProductDao {
  final AppDatabase _db;

  LocalProductDao(this._db);

  Future<PagedResult<Product>> getProducts({
    int page = 0,
    int pageSize = 10,
    String? search,
    String? categoryId,
    String? sortColumn,
    bool sortAscending = true,
  }) async {
    // Build base query with category join
    var query = _db.select(_db.productsTable).join([
      leftOuterJoin(
        _db.categoriesTable,
        _db.categoriesTable.id.equalsExp(_db.productsTable.categoryId),
      ),
    ]);

    // Filters
    final conditions = <Expression<bool>>[];
    if (search != null && search.isNotEmpty) {
      conditions.add(_db.productsTable.name.contains(search) |
          _db.productsTable.sku.contains(search));
    }
    if (categoryId != null) {
      conditions.add(_db.productsTable.categoryId.equals(categoryId));
    }
    if (conditions.isNotEmpty) {
      query.where(conditions.reduce((a, b) => a & b));
    }

    // Count total
    final countQuery = _db.selectOnly(_db.productsTable)
      ..addColumns([_db.productsTable.id.count()]);
    if (search != null && search.isNotEmpty) {
      countQuery.where(_db.productsTable.name.contains(search) |
          _db.productsTable.sku.contains(search));
    }
    if (categoryId != null) {
      countQuery.where(_db.productsTable.categoryId.equals(categoryId));
    }
    final countResult = await countQuery.getSingle();
    final total = countResult.read(_db.productsTable.id.count()) ?? 0;

    // Sort
    final col = sortColumn ?? 'name';
    OrderingMode mode = sortAscending ? OrderingMode.asc : OrderingMode.desc;
    switch (col) {
      case 'quantity':
        query.orderBy([OrderingTerm(expression: _db.productsTable.quantity, mode: mode)]);
        break;
      case 'price':
        query.orderBy([OrderingTerm(expression: _db.productsTable.price, mode: mode)]);
        break;
      case 'updatedAt':
        query.orderBy([OrderingTerm(expression: _db.productsTable.updatedAt, mode: mode)]);
        break;
      default:
        query.orderBy([OrderingTerm(expression: _db.productsTable.name, mode: mode)]);
    }

    // Paginate
    query.limit(pageSize, offset: page * pageSize);

    final rows = await query.get();
    final products = rows.map((row) {
      final p = row.readTable(_db.productsTable);
      final c = row.readTableOrNull(_db.categoriesTable);
      return p.toEntity(categoryName: c?.name);
    }).toList();

    return PagedResult(items: products, totalCount: total);
  }

  Future<Product?> getById(String id) async {
    final query = _db.select(_db.productsTable).join([
      leftOuterJoin(_db.categoriesTable,
          _db.categoriesTable.id.equalsExp(_db.productsTable.categoryId)),
    ])
      ..where(_db.productsTable.id.equals(id));
    final row = await query.getSingleOrNull();
    if (row == null) return null;
    final p = row.readTable(_db.productsTable);
    final c = row.readTableOrNull(_db.categoriesTable);
    return p.toEntity(categoryName: c?.name);
  }

  Future<void> upsert(ProductsTableCompanion companion) async {
    await _db.into(_db.productsTable).insertOnConflictUpdate(companion);
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.productsTable)
          ..where((t) => t.id.equals(id)))
        .go();
  }

  Future<List<Product>> getLowStock() async {
    // Drift doesn't support column-to-column WHERE comparisons, so filter in Dart.
    final allQuery = _db.select(_db.productsTable).join([
      leftOuterJoin(_db.categoriesTable,
          _db.categoriesTable.id.equalsExp(_db.productsTable.categoryId)),
    ]);
    final rows = await allQuery.get();
    return rows
        .map((row) {
          final p = row.readTable(_db.productsTable);
          final c = row.readTableOrNull(_db.categoriesTable);
          return p.toEntity(categoryName: c?.name);
        })
        .where((p) => p.isLowStock)
        .toList();
  }

  Future<int> count() async {
    final countExpr = _db.productsTable.id.count();
    final q = _db.selectOnly(_db.productsTable)..addColumns([countExpr]);
    final row = await q.getSingle();
    return row.read(countExpr) ?? 0;
  }
}
