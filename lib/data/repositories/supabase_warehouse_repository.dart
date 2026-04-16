import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/warehouse.dart';
import '../../domain/repositories/warehouse_repository.dart';

class SupabaseWarehouseRepository implements WarehouseRepository {
  final SupabaseClient _client;

  SupabaseWarehouseRepository(this._client);

  Warehouse _map(Map<String, dynamic> r) => Warehouse(
        id: r['id'] as String,
        name: r['name'] as String,
        address: r['address'] as String?,
        notes: r['notes'] as String?,
        isDefault: r['is_default'] as bool? ?? false,
        createdAt: DateTime.parse(r['created_at'] as String),
      );

  @override
  Future<List<Warehouse>> getWarehouses() async {
    final rows = await _client.from('warehouses').select().order('name');
    return (rows as List).map((r) => _map(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<Warehouse?> getWarehouse(String id) async {
    final row = await _client.from('warehouses').select().eq('id', id).maybeSingle();
    return row == null ? null : _map(row);
  }

  @override
  Future<void> createWarehouse(Warehouse warehouse) async {
    await _client.from('warehouses').insert({
      'name': warehouse.name,
      'address': warehouse.address,
      'notes': warehouse.notes,
      'is_default': warehouse.isDefault,
      'created_at': warehouse.createdAt.toIso8601String(),
    });
  }

  @override
  Future<void> updateWarehouse(Warehouse warehouse) async {
    await _client.from('warehouses').update({
      'name': warehouse.name,
      'address': warehouse.address,
      'notes': warehouse.notes,
      'is_default': warehouse.isDefault,
    }).eq('id', warehouse.id);
  }

  @override
  Future<void> setDefault(String id) async {
    // Clear existing default, then set new one
    await _client.from('warehouses').update({'is_default': false}).neq('id', id);
    await _client.from('warehouses').update({'is_default': true}).eq('id', id);
  }

  @override
  Future<void> deleteWarehouse(String id) async {
    await _client.from('warehouses').delete().eq('id', id);
  }

  @override
  Future<List<WarehouseStock>> getStockForWarehouse(String warehouseId) async {
    final rows = await _client
        .from('warehouse_stock')
        .select('*, products(name, sku), warehouses(name)')
        .eq('warehouse_id', warehouseId);
    return (rows as List).map((r) {
      final m = r as Map<String, dynamic>;
      final product = m['products'] as Map<String, dynamic>;
      final warehouse = m['warehouses'] as Map<String, dynamic>;
      return WarehouseStock(
        productId: m['product_id'] as String,
        productName: product['name'] as String,
        sku: product['sku'] as String?,
        warehouseId: m['warehouse_id'] as String,
        warehouseName: warehouse['name'] as String,
        quantity: m['quantity'] as int,
      );
    }).toList();
  }

  @override
  Future<void> transferStock({
    required String productId,
    required String fromWarehouseId,
    required String toWarehouseId,
    required int qty,
  }) async {
    // Decrement source
    await _client.rpc('transfer_warehouse_stock', params: {
      'p_product_id': productId,
      'p_from_warehouse_id': fromWarehouseId,
      'p_to_warehouse_id': toWarehouseId,
      'p_quantity': qty,
    });
  }
}
