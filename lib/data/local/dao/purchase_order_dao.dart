import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/purchase_order.dart';

class LocalPurchaseOrderDao {
  final AppDatabase _db;
  LocalPurchaseOrderDao(this._db);

  Future<List<PurchaseOrder>> getAll() async {
    final poRows = await (_db.select(_db.purchaseOrdersTable)
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .join([
      leftOuterJoin(
        _db.suppliersTable,
        _db.suppliersTable.id.equalsExp(_db.purchaseOrdersTable.supplierId),
      ),
    ]).get();

    final orders = <PurchaseOrder>[];
    for (final row in poRows) {
      final po = row.readTable(_db.purchaseOrdersTable);
      final supplier = row.readTableOrNull(_db.suppliersTable);
      final items = await _getItems(po.id);
      orders.add(_mapOrder(po, supplier?.name, items));
    }
    return orders;
  }

  Future<PurchaseOrder?> getById(String id) async {
    final row = await (_db.select(_db.purchaseOrdersTable)
          ..where((t) => t.id.equals(id)))
        .join([
      leftOuterJoin(
        _db.suppliersTable,
        _db.suppliersTable.id.equalsExp(_db.purchaseOrdersTable.supplierId),
      ),
    ]).getSingleOrNull();
    if (row == null) return null;
    final po = row.readTable(_db.purchaseOrdersTable);
    final supplier = row.readTableOrNull(_db.suppliersTable);
    final items = await _getItems(po.id);
    return _mapOrder(po, supplier?.name, items);
  }

  Future<List<PurchaseOrderItem>> _getItems(String poId) async {
    final rows = await (_db.select(_db.purchaseOrderItemsTable)
          ..where((t) => t.purchaseOrderId.equals(poId)))
        .join([
      leftOuterJoin(
        _db.productsTable,
        _db.productsTable.id
            .equalsExp(_db.purchaseOrderItemsTable.productId),
      ),
    ]).get();
    return rows.map((row) {
      final item = row.readTable(_db.purchaseOrderItemsTable);
      final product = row.readTableOrNull(_db.productsTable);
      return PurchaseOrderItem(
        id: item.id,
        purchaseOrderId: item.purchaseOrderId,
        productId: item.productId,
        productName: product?.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
      );
    }).toList();
  }

  Future<void> upsertOrder(PurchaseOrdersTableCompanion companion) async {
    await _db.into(_db.purchaseOrdersTable).insertOnConflictUpdate(companion);
  }

  Future<void> deleteItems(String poId) async {
    await (_db.delete(_db.purchaseOrderItemsTable)
          ..where((t) => t.purchaseOrderId.equals(poId)))
        .go();
  }

  Future<void> insertItem(PurchaseOrderItemsTableCompanion companion) async {
    await _db.into(_db.purchaseOrderItemsTable).insert(companion);
  }

  Future<void> updateStatus(String id, String status) async {
    await (_db.update(_db.purchaseOrdersTable)..where((t) => t.id.equals(id)))
        .write(PurchaseOrdersTableCompanion(
      status: Value(status),
      updatedAt: Value(DateTime.now()),
    ));
  }

  Future<void> delete(String id) async {
    await deleteItems(id);
    await (_db.delete(_db.purchaseOrdersTable)..where((t) => t.id.equals(id)))
        .go();
  }

  Future<int> countOpen() async {
    final rows = await (_db.select(_db.purchaseOrdersTable)
          ..where((t) =>
              t.status.equals('draft') | t.status.equals('sent')))
        .get();
    return rows.length;
  }

  PurchaseOrder _mapOrder(
    PurchaseOrdersTableData po,
    String? supplierName,
    List<PurchaseOrderItem> items,
  ) {
    return PurchaseOrder(
      id: po.id,
      supplierId: po.supplierId,
      supplierName: supplierName,
      status: PurchaseOrderStatus.values.firstWhere(
        (s) => s.name == po.status,
        orElse: () => PurchaseOrderStatus.draft,
      ),
      total: po.total,
      notes: po.notes,
      items: items,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
    );
  }
}
