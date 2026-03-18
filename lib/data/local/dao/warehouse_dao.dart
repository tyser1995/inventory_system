import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/warehouse.dart';

extension WarehouseMapper on WarehousesTableData {
  Warehouse toEntity() => Warehouse(
        id: id,
        name: name,
        address: address,
        notes: notes,
        isDefault: isDefault,
        createdAt: createdAt,
      );
}

class LocalWarehouseDao {
  final AppDatabase _db;
  LocalWarehouseDao(this._db);

  Future<List<Warehouse>> getAll() async {
    final rows = await (_db.select(_db.warehousesTable)
          ..orderBy([
            (t) => OrderingTerm.desc(t.isDefault),
            (t) => OrderingTerm.asc(t.name),
          ]))
        .get();
    return rows.map((r) => r.toEntity()).toList();
  }

  Future<Warehouse?> getById(String id) async {
    final row = await (_db.select(_db.warehousesTable)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();
    return row?.toEntity();
  }

  Future<void> upsert(WarehousesTableCompanion companion) async {
    await _db.into(_db.warehousesTable).insertOnConflictUpdate(companion);
  }

  Future<void> setDefault(String id) async {
    // Clear all defaults then set this one
    await _db.update(_db.warehousesTable).write(
          const WarehousesTableCompanion(isDefault: Value(false)),
        );
    await (_db.update(_db.warehousesTable)
          ..where((t) => t.id.equals(id)))
        .write(const WarehousesTableCompanion(isDefault: Value(true)));
  }

  Future<void> delete(String id) async {
    // Remove stock records first
    await (_db.delete(_db.productWarehouseStockTable)
          ..where((t) => t.warehouseId.equals(id)))
        .go();
    await (_db.delete(_db.warehousesTable)..where((t) => t.id.equals(id)))
        .go();
  }

  // ── Stock per warehouse ──────────────────────────────────────────────────

  Future<List<WarehouseStock>> getStockForWarehouse(String warehouseId) async {
    final rows = await (_db.select(_db.productWarehouseStockTable)
          ..where((t) => t.warehouseId.equals(warehouseId)))
        .join([
      innerJoin(
        _db.productsTable,
        _db.productsTable.id
            .equalsExp(_db.productWarehouseStockTable.productId),
      ),
      innerJoin(
        _db.warehousesTable,
        _db.warehousesTable.id
            .equalsExp(_db.productWarehouseStockTable.warehouseId),
      ),
    ]).get();

    return rows.map((row) {
      final stock = row.readTable(_db.productWarehouseStockTable);
      final product = row.readTable(_db.productsTable);
      final warehouse = row.readTable(_db.warehousesTable);
      return WarehouseStock(
        productId: stock.productId,
        productName: product.name,
        sku: product.sku,
        warehouseId: stock.warehouseId,
        warehouseName: warehouse.name,
        quantity: stock.quantity,
      );
    }).toList();
  }

  Future<void> upsertStock(
      ProductWarehouseStockTableCompanion companion) async {
    await _db
        .into(_db.productWarehouseStockTable)
        .insertOnConflictUpdate(companion);
  }

  Future<void> adjustStock({
    required String productId,
    required String warehouseId,
    required int delta,
  }) async {
    final existing = await (_db.select(_db.productWarehouseStockTable)
          ..where((t) =>
              t.productId.equals(productId) &
              t.warehouseId.equals(warehouseId)))
        .getSingleOrNull();

    final newQty = (existing?.quantity ?? 0) + delta;
    await upsertStock(ProductWarehouseStockTableCompanion.insert(
      productId: productId,
      warehouseId: warehouseId,
      quantity: Value(newQty < 0 ? 0 : newQty),
      updatedAt: DateTime.now(),
    ));
  }
}
