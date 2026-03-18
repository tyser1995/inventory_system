import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../domain/entities/sales_order.dart';
import '../../domain/repositories/sales_order_repository.dart';
import '../local/dao/product_dao.dart';
import '../local/dao/sales_order_dao.dart';
import '../local/dao/transaction_dao.dart';
import '../local/database/app_database.dart';

class LocalSalesOrderRepository implements SalesOrderRepository {
  final LocalSalesOrderDao _dao;
  final LocalTransactionDao _txDao;
  final LocalProductDao _productDao;
  static const _uuid = Uuid();

  LocalSalesOrderRepository(this._dao, this._txDao, this._productDao);

  @override
  Future<List<SalesOrder>> getSalesOrders({SalesOrderStatus? status}) =>
      _dao.getAll(status: status);

  @override
  Future<SalesOrder?> getSalesOrder(String id) => _dao.getById(id);

  @override
  Future<SalesOrder> createSalesOrder(
      SalesOrder order, List<SalesOrderItem> items) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final total = items.fold(0.0, (s, i) => s + i.subtotal);

    await _dao.upsertOrder(SalesOrdersTableCompanion.insert(
      id: id,
      customerName: Value(order.customerName),
      channel: order.channel,
      status: order.status.name,
      total: Value(total),
      notes: Value(order.notes),
      createdAt: now,
      updatedAt: now,
    ));

    for (final item in items) {
      await _dao.insertItem(SalesOrderItemsTableCompanion.insert(
        id: _uuid.v4(),
        salesOrderId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      ));
    }

    return order.copyWith(id: id, total: total, createdAt: now, updatedAt: now);
  }

  @override
  Future<void> updateSalesOrder(
      SalesOrder order, List<SalesOrderItem> items) async {
    final now = DateTime.now();
    final total = items.fold(0.0, (s, i) => s + i.subtotal);

    await _dao.upsertOrder(SalesOrdersTableCompanion.insert(
      id: order.id,
      customerName: Value(order.customerName),
      channel: order.channel,
      status: order.status.name,
      total: Value(total),
      notes: Value(order.notes),
      createdAt: order.createdAt,
      updatedAt: now,
    ));

    await _dao.deleteItems(order.id);
    for (final item in items) {
      await _dao.insertItem(SalesOrderItemsTableCompanion.insert(
        id: item.id.isEmpty ? _uuid.v4() : item.id,
        salesOrderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      ));
    }
  }

  @override
  Future<void> updateStatus(
    String id,
    SalesOrderStatus status, {
    String? processedByUserId,
  }) async {
    await _dao.updateStatus(id, status.name);

    // When completed → auto stock_out for each line item
    if (status == SalesOrderStatus.completed) {
      final order = await _dao.getById(id);
      if (order == null) return;
      final now = DateTime.now();
      final userId = processedByUserId ?? 'system';

      for (final item in order.items) {
        final product = await _productDao.getById(item.productId);
        if (product == null) continue;
        final newQty = (product.quantity - item.quantity).clamp(0, 999999);
        await _productDao.upsert(ProductsTableCompanion.insert(
          id: product.id,
          name: product.name,
          description: Value(product.description),
          categoryId: product.categoryId,
          price: product.price,
          quantity: newQty,
          lowStockThreshold: Value(product.lowStockThreshold),
          sku: Value(product.sku),
          unit: Value(product.unit),
          createdAt: product.createdAt,
          updatedAt: now,
        ));
        await _txDao.insert(TransactionsTableCompanion.insert(
          id: _uuid.v4(),
          productId: item.productId,
          type: 'stock_out',
          quantity: item.quantity,
          notes: Value('Sales order fulfilled: ${order.id.substring(0, 8)}'),
          userId: userId,
          createdAt: now,
        ));
      }
    }
  }

  @override
  Future<void> deleteSalesOrder(String id) => _dao.delete(id);
}
