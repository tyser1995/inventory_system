import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/sales_order.dart';

class LocalSalesOrderDao {
  final AppDatabase _db;
  LocalSalesOrderDao(this._db);

  Future<List<SalesOrder>> getAll({SalesOrderStatus? status}) async {
    final query = _db.select(_db.salesOrdersTable)
      ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]);
    if (status != null) {
      query.where((t) => t.status.equals(status.name));
    }
    final rows = await query.get();
    final orders = <SalesOrder>[];
    for (final row in rows) {
      final items = await _getItems(row.id);
      orders.add(_mapOrder(row, items));
    }
    return orders;
  }

  Future<SalesOrder?> getById(String id) async {
    final row = await (_db.select(_db.salesOrdersTable)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();
    if (row == null) return null;
    final items = await _getItems(id);
    return _mapOrder(row, items);
  }

  Future<List<SalesOrderItem>> _getItems(String orderId) async {
    final rows = await (_db.select(_db.salesOrderItemsTable)
          ..where((t) => t.salesOrderId.equals(orderId)))
        .join([
      leftOuterJoin(
        _db.productsTable,
        _db.productsTable.id
            .equalsExp(_db.salesOrderItemsTable.productId),
      ),
    ]).get();
    return rows.map((row) {
      final item = row.readTable(_db.salesOrderItemsTable);
      final product = row.readTableOrNull(_db.productsTable);
      return SalesOrderItem(
        id: item.id,
        salesOrderId: item.salesOrderId,
        productId: item.productId,
        productName: product?.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      );
    }).toList();
  }

  Future<void> upsertOrder(SalesOrdersTableCompanion companion) async {
    await _db.into(_db.salesOrdersTable).insertOnConflictUpdate(companion);
  }

  Future<void> deleteItems(String orderId) async {
    await (_db.delete(_db.salesOrderItemsTable)
          ..where((t) => t.salesOrderId.equals(orderId)))
        .go();
  }

  Future<void> insertItem(SalesOrderItemsTableCompanion companion) async {
    await _db.into(_db.salesOrderItemsTable).insert(companion);
  }

  Future<void> updateStatus(String id, String status) async {
    await (_db.update(_db.salesOrdersTable)..where((t) => t.id.equals(id)))
        .write(SalesOrdersTableCompanion(
      status: Value(status),
      updatedAt: Value(DateTime.now()),
    ));
  }

  Future<void> delete(String id) async {
    await deleteItems(id);
    await (_db.delete(_db.salesOrdersTable)..where((t) => t.id.equals(id)))
        .go();
  }

  Future<List<SalesOrder>> getCompleted() async {
    final rows = await (_db.select(_db.salesOrdersTable)
          ..where((t) => t.status.equals('completed')))
        .get();
    final orders = <SalesOrder>[];
    for (final row in rows) {
      final items = await _getItems(row.id);
      orders.add(_mapOrder(row, items));
    }
    return orders;
  }

  SalesOrder _mapOrder(SalesOrdersTableData row, List<SalesOrderItem> items) {
    return SalesOrder(
      id: row.id,
      customerName: row.customerName,
      channel: row.channel,
      status: SalesOrderStatusLabel.fromString(row.status),
      total: row.total,
      notes: row.notes,
      items: items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    );
  }
}
