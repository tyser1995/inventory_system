import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/transaction.dart';
import '../../../domain/repositories/product_repository.dart' show PagedResult;

extension TransactionMapper on TransactionsTableData {
  InventoryTransaction toEntity({String? productName, String? userName}) =>
      InventoryTransaction(
        id: id,
        productId: productId,
        productName: productName,
        type: type == 'stock_in' ? TransactionType.stockIn : TransactionType.stockOut,
        quantity: quantity,
        notes: notes,
        userId: userId,
        userName: userName,
        createdAt: createdAt,
      );
}

class LocalTransactionDao {
  final AppDatabase _db;
  LocalTransactionDao(this._db);

  Future<PagedResult<InventoryTransaction>> getTransactions({
    int page = 0,
    int pageSize = 10,
    String? productId,
    TransactionType? type,
    DateTime? from,
    DateTime? to,
    bool sortAscending = false,
  }) async {
    var query = _db.select(_db.transactionsTable).join([
      leftOuterJoin(_db.productsTable,
          _db.productsTable.id.equalsExp(_db.transactionsTable.productId)),
      leftOuterJoin(_db.usersTable,
          _db.usersTable.id.equalsExp(_db.transactionsTable.userId)),
    ]);

    final conditions = <Expression<bool>>[];
    if (productId != null) conditions.add(_db.transactionsTable.productId.equals(productId));
    if (type != null) conditions.add(_db.transactionsTable.type.equals(type == TransactionType.stockIn ? 'stock_in' : 'stock_out'));
    if (from != null) conditions.add(_db.transactionsTable.createdAt.isBiggerOrEqualValue(from));
    if (to != null) conditions.add(_db.transactionsTable.createdAt.isSmallerOrEqualValue(to));
    if (conditions.isNotEmpty) query.where(conditions.reduce((a, b) => a & b));

    final mode = sortAscending ? OrderingMode.asc : OrderingMode.desc;
    query.orderBy([OrderingTerm(expression: _db.transactionsTable.createdAt, mode: mode)]);

    // Count
    final total = (await query.get()).length; // simple count for now

    query.limit(pageSize, offset: page * pageSize);
    final rows = await query.get();
    final items = rows.map((row) {
      final t = row.readTable(_db.transactionsTable);
      final p = row.readTableOrNull(_db.productsTable);
      final u = row.readTableOrNull(_db.usersTable);
      return t.toEntity(productName: p?.name, userName: u?.username);
    }).toList();

    return PagedResult(items: items, totalCount: total);
  }

  Future<void> insert(TransactionsTableCompanion companion) async {
    await _db.into(_db.transactionsTable).insert(companion);
  }

  /// Inserts [companion] and silently ignores the row if it already exists.
  /// Used during backup restore to avoid duplicate transaction records.
  Future<void> insertOrIgnore(TransactionsTableCompanion companion) async {
    await _db
        .into(_db.transactionsTable)
        .insert(companion, mode: InsertMode.insertOrIgnore);
  }

  Future<List<InventoryTransaction>> getAll() async {
    final rows = await _db.select(_db.transactionsTable).get();
    return rows.map((r) => r.toEntity()).toList();
  }
}
