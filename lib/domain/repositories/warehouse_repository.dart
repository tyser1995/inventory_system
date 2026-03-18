import '../entities/warehouse.dart';

abstract class WarehouseRepository {
  Future<List<Warehouse>> getWarehouses();
  Future<Warehouse?> getWarehouse(String id);
  Future<void> createWarehouse(Warehouse warehouse);
  Future<void> updateWarehouse(Warehouse warehouse);
  Future<void> setDefault(String id);
  Future<void> deleteWarehouse(String id);
  Future<List<WarehouseStock>> getStockForWarehouse(String warehouseId);
  /// Move [qty] units of [productId] from [fromWarehouseId] to [toWarehouseId].
  Future<void> transferStock({
    required String productId,
    required String fromWarehouseId,
    required String toWarehouseId,
    required int qty,
  });
}
