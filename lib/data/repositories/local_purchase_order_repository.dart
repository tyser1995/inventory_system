import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../domain/entities/purchase_order.dart';
import '../../domain/repositories/purchase_order_repository.dart';
import '../local/dao/product_dao.dart';
import '../local/dao/purchase_order_dao.dart';
import '../local/dao/transaction_dao.dart';
import '../local/database/app_database.dart';

class LocalPurchaseOrderRepository implements PurchaseOrderRepository {
  final LocalPurchaseOrderDao _dao;
  final LocalTransactionDao _txDao;
  final LocalProductDao _productDao;
  static const _uuid = Uuid();

  LocalPurchaseOrderRepository(this._dao, this._txDao, this._productDao);

  @override
  Future<List<PurchaseOrder>> getPurchaseOrders() => _dao.getAll();

  @override
  Future<PurchaseOrder?> getPurchaseOrder(String id) => _dao.getById(id);

  @override
  Future<PurchaseOrder> createPurchaseOrder(
      PurchaseOrder order, List<PurchaseOrderItem> items) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final total = items.fold(0.0, (s, i) => s + i.subtotal);

    await _dao.upsertOrder(PurchaseOrdersTableCompanion.insert(
      id: id,
      supplierId: order.supplierId,
      status: order.status.name,
      total: Value(total),
      notes: Value(order.notes),
      createdAt: now,
      updatedAt: now,
    ));

    for (final item in items) {
      await _dao.insertItem(PurchaseOrderItemsTableCompanion.insert(
        id: _uuid.v4(),
        purchaseOrderId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
      ));
    }

    return order.copyWith(id: id, total: total, createdAt: now, updatedAt: now);
  }

  @override
  Future<void> updatePurchaseOrder(
      PurchaseOrder order, List<PurchaseOrderItem> items) async {
    final now = DateTime.now();
    final total = items.fold(0.0, (s, i) => s + i.subtotal);

    await _dao.upsertOrder(PurchaseOrdersTableCompanion.insert(
      id: order.id,
      supplierId: order.supplierId,
      status: order.status.name,
      total: Value(total),
      notes: Value(order.notes),
      createdAt: order.createdAt,
      updatedAt: now,
    ));

    await _dao.deleteItems(order.id);
    for (final item in items) {
      await _dao.insertItem(PurchaseOrderItemsTableCompanion.insert(
        id: item.id.isEmpty ? _uuid.v4() : item.id,
        purchaseOrderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
      ));
    }
  }

  @override
  Future<void> updateStatus(
    String id,
    PurchaseOrderStatus status, {
    String? receivedByUserId,
  }) async {
    await _dao.updateStatus(id, status.name);

    // When received → auto stock_in for each line item
    if (status == PurchaseOrderStatus.received) {
      final po = await _dao.getById(id);
      if (po == null) return;
      final now = DateTime.now();
      final userId = receivedByUserId ?? 'system';

      for (final item in po.items) {
        final product = await _productDao.getById(item.productId);
        if (product == null) continue;
        final newQty = product.quantity + item.quantity;
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
          type: 'stock_in',
          quantity: item.quantity,
          notes: Value('PO received: ${po.id.substring(0, 8)}'),
          userId: userId,
          createdAt: now,
        ));
      }
    }
  }

  @override
  Future<void> deletePurchaseOrder(String id) => _dao.delete(id);

  @override
  Future<int> countOpen() => _dao.countOpen();
}
