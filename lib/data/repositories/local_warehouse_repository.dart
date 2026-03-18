import 'package:uuid/uuid.dart';
import '../../domain/entities/warehouse.dart';
import '../../domain/repositories/warehouse_repository.dart';
import '../local/dao/warehouse_dao.dart';
import '../local/database/app_database.dart';
import 'package:drift/drift.dart';

class LocalWarehouseRepository implements WarehouseRepository {
  final LocalWarehouseDao _dao;
  static const _uuid = Uuid();

  LocalWarehouseRepository(this._dao);

  @override
  Future<List<Warehouse>> getWarehouses() => _dao.getAll();

  @override
  Future<Warehouse?> getWarehouse(String id) => _dao.getById(id);

  @override
  Future<void> createWarehouse(Warehouse warehouse) => _dao.upsert(
        WarehousesTableCompanion.insert(
          id: warehouse.id.isEmpty ? _uuid.v4() : warehouse.id,
          name: warehouse.name,
          address: Value(warehouse.address),
          notes: Value(warehouse.notes),
          isDefault: Value(warehouse.isDefault),
          createdAt: warehouse.createdAt,
        ),
      );

  @override
  Future<void> updateWarehouse(Warehouse warehouse) => _dao.upsert(
        WarehousesTableCompanion.insert(
          id: warehouse.id,
          name: warehouse.name,
          address: Value(warehouse.address),
          notes: Value(warehouse.notes),
          isDefault: Value(warehouse.isDefault),
          createdAt: warehouse.createdAt,
        ),
      );

  @override
  Future<void> setDefault(String id) => _dao.setDefault(id);

  @override
  Future<void> deleteWarehouse(String id) => _dao.delete(id);

  @override
  Future<List<WarehouseStock>> getStockForWarehouse(String warehouseId) =>
      _dao.getStockForWarehouse(warehouseId);

  @override
  Future<void> transferStock({
    required String productId,
    required String fromWarehouseId,
    required String toWarehouseId,
    required int qty,
  }) async {
    await _dao.adjustStock(
        productId: productId, warehouseId: fromWarehouseId, delta: -qty);
    await _dao.adjustStock(
        productId: productId, warehouseId: toWarehouseId, delta: qty);
  }
}
