import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/sales_order.dart';
import '../../domain/repositories/sales_order_repository.dart';

class SupabaseSalesOrderRepository implements SalesOrderRepository {
  final SupabaseClient _client;

  SupabaseSalesOrderRepository(this._client);

  SalesOrder _mapOrder(Map<String, dynamic> r) {
    final itemRows = r['sales_order_items'] as List? ?? [];
    return SalesOrder(
      id: r['id'] as String,
      customerName: r['customer_name'] as String?,
      channel: r['channel'] as String,
      status: SalesOrderStatusLabel.fromString(r['status'] as String),
      total: (r['total'] as num).toDouble(),
      notes: r['notes'] as String?,
      items: itemRows.map((i) => _mapItem(i as Map<String, dynamic>)).toList(),
      createdAt: DateTime.parse(r['created_at'] as String),
      updatedAt: DateTime.parse(r['updated_at'] as String),
    );
  }

  SalesOrderItem _mapItem(Map<String, dynamic> r) => SalesOrderItem(
        id: r['id'] as String,
        salesOrderId: r['sales_order_id'] as String,
        productId: r['product_id'] as String,
        productName: (r['products'] as Map<String, dynamic>?)?['name'] as String?,
        quantity: r['quantity'] as int,
        unitPrice: (r['unit_price'] as num).toDouble(),
      );

  @override
  Future<List<SalesOrder>> getSalesOrders({SalesOrderStatus? status}) async {
    // Filters must be applied before order() since order() returns a
    // PostgrestTransformBuilder that no longer exposes filter methods.
    var q = _client
        .from('sales_orders')
        .select('*, sales_order_items(*, products(name))');
    if (status != null) q = q.eq('status', status.name);
    final rows = await q.order('created_at', ascending: false);
    return (rows as List).map((r) => _mapOrder(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<SalesOrder?> getSalesOrder(String id) async {
    final row = await _client
        .from('sales_orders')
        .select('*, sales_order_items(*, products(name))')
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : _mapOrder(row);
  }

  @override
  Future<SalesOrder> createSalesOrder(
    SalesOrder order,
    List<SalesOrderItem> items,
  ) async {
    final now = DateTime.now().toIso8601String();
    final row = await _client.from('sales_orders').insert({
      'customer_name': order.customerName,
      'channel': order.channel,
      'status': order.status.name,
      'total': order.total,
      'notes': order.notes,
      'created_at': now,
      'updated_at': now,
    }).select().single();

    final orderId = row['id'] as String;
    for (final item in items) {
      await _client.from('sales_order_items').insert({
        'sales_order_id': orderId,
        'product_id': item.productId,
        'quantity': item.quantity,
        'unit_price': item.unitPrice,
      });
    }

    return (await getSalesOrder(orderId))!;
  }

  @override
  Future<void> updateSalesOrder(
    SalesOrder order,
    List<SalesOrderItem> items,
  ) async {
    await _client.from('sales_orders').update({
      'customer_name': order.customerName,
      'channel': order.channel,
      'status': order.status.name,
      'total': order.total,
      'notes': order.notes,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', order.id);

    await _client.from('sales_order_items').delete().eq('sales_order_id', order.id);
    for (final item in items) {
      await _client.from('sales_order_items').insert({
        'sales_order_id': order.id,
        'product_id': item.productId,
        'quantity': item.quantity,
        'unit_price': item.unitPrice,
      });
    }
  }

  @override
  Future<void> updateStatus(
    String id,
    SalesOrderStatus status, {
    String? processedByUserId,
  }) async {
    await _client.from('sales_orders').update({
      'status': status.name,
      if (processedByUserId != null) 'processed_by_user_id': processedByUserId,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
  }

  @override
  Future<void> deleteSalesOrder(String id) async {
    await _client.from('sales_orders').delete().eq('id', id);
  }
}
