import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/warehouse.dart';
import 'core_providers.dart';

final warehouseListProvider = FutureProvider<List<Warehouse>>((ref) {
  return ref.watch(warehouseRepositoryProvider).getWarehouses();
});

final warehouseStockProvider =
    FutureProvider.family<List<WarehouseStock>, String>((ref, warehouseId) {
  return ref
      .watch(warehouseRepositoryProvider)
      .getStockForWarehouse(warehouseId);
});
