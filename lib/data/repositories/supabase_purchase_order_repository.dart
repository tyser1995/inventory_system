import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/purchase_order.dart';
import '../../domain/repositories/purchase_order_repository.dart';

class SupabasePurchaseOrderRepository implements PurchaseOrderRepository {
  final SupabaseClient _client;

  SupabasePurchaseOrderRepository(this._client);

  PurchaseOrder _mapOrder(Map<String, dynamic> r) {
    final itemRows = r['purchase_order_items'] as List? ?? [];
    return PurchaseOrder(
      id: r['id'] as String,
      supplierId: r['supplier_id'] as String,
      supplierName: (r['suppliers'] as Map<String, dynamic>?)?['name'] as String?,
      status: PurchaseOrderStatus.values.firstWhere(
        (s) => s.name == r['status'],
        orElse: () => PurchaseOrderStatus.draft,
      ),
      total: (r['total'] as num).toDouble(),
      notes: r['notes'] as String?,
      items: itemRows.map((i) => _mapItem(i as Map<String, dynamic>)).toList(),
      createdAt: DateTime.parse(r['created_at'] as String),
      updatedAt: DateTime.parse(r['updated_at'] as String),
    );
  }

  PurchaseOrderItem _mapItem(Map<String, dynamic> r) => PurchaseOrderItem(
        id: r['id'] as String,
        purchaseOrderId: r['purchase_order_id'] as String,
        productId: r['product_id'] as String,
        productName: (r['products'] as Map<String, dynamic>?)?['name'] as String?,
        quantity: r['quantity'] as int,
        unitCost: (r['unit_cost'] as num).toDouble(),
      );

  @override
  Future<List<PurchaseOrder>> getPurchaseOrders() async {
    final rows = await _client
        .from('purchase_orders')
        .select('*, suppliers(name), purchase_order_items(*, products(name))')
        .order('created_at', ascending: false);
    return (rows as List).map((r) => _mapOrder(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<PurchaseOrder?> getPurchaseOrder(String id) async {
    final row = await _client
        .from('purchase_orders')
        .select('*, suppliers(name), purchase_order_items(*, products(name))')
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : _mapOrder(row);
  }

  @override
  Future<PurchaseOrder> createPurchaseOrder(
    PurchaseOrder order,
    List<PurchaseOrderItem> items,
  ) async {
    final now = DateTime.now().toIso8601String();
    final row = await _client.from('purchase_orders').insert({
      'supplier_id': order.supplierId,
      'status': order.status.name,
      'total': order.total,
      'notes': order.notes,
      'created_at': now,
      'updated_at': now,
    }).select().single();

    final orderId = row['id'] as String;
    for (final item in items) {
      await _client.from('purchase_order_items').insert({
        'purchase_order_id': orderId,
        'product_id': item.productId,
        'quantity': item.quantity,
        'unit_cost': item.unitCost,
      });
    }

    return (await getPurchaseOrder(orderId))!;
  }

  @override
  Future<void> updatePurchaseOrder(
    PurchaseOrder order,
    List<PurchaseOrderItem> items,
  ) async {
    await _client.from('purchase_orders').update({
      'supplier_id': order.supplierId,
      'status': order.status.name,
      'total': order.total,
      'notes': order.notes,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', order.id);

    await _client.from('purchase_order_items').delete().eq('purchase_order_id', order.id);
    for (final item in items) {
      await _client.from('purchase_order_items').insert({
        'purchase_order_id': order.id,
        'product_id': item.productId,
        'quantity': item.quantity,
        'unit_cost': item.unitCost,
      });
    }
  }

  @override
  Future<void> updateStatus(
    String id,
    PurchaseOrderStatus status, {
    String? receivedByUserId,
  }) async {
    await _client.from('purchase_orders').update({
      'status': status.name,
      if (receivedByUserId != null) 'received_by_user_id': receivedByUserId,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
  }

  @override
  Future<void> deletePurchaseOrder(String id) async {
    await _client.from('purchase_orders').delete().eq('id', id);
  }

  @override
  Future<int> countOpen() async {
    final rows = await _client
        .from('purchase_orders')
        .select('id')
        .inFilter('status', ['draft', 'sent']);
    return (rows as List).length;
  }
}
