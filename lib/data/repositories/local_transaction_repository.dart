import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../domain/entities/transaction.dart';
import '../../domain/repositories/product_repository.dart';
import '../../domain/repositories/transaction_repository.dart';
import '../local/dao/product_dao.dart';
import '../local/dao/transaction_dao.dart';
import '../local/database/app_database.dart';

class LocalTransactionRepository implements TransactionRepository {
  final LocalTransactionDao _txDao;
  final LocalProductDao _productDao;
  final AppDatabase _db;
  static const _uuid = Uuid();

  LocalTransactionRepository(this._txDao, this._productDao, this._db);

  @override
  Future<PagedResult<InventoryTransaction>> getTransactions({
    int page = 0,
    int pageSize = 10,
    String? productId,
    TransactionType? type,
    DateTime? from,
    DateTime? to,
    String? sortColumn,
    bool sortAscending = false,
  }) =>
      _txDao.getTransactions(
        page: page,
        pageSize: pageSize,
        productId: productId,
        type: type,
        from: from,
        to: to,
        sortAscending: sortAscending,
      );

  @override
  Future<InventoryTransaction> createTransaction(InventoryTransaction transaction) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final tx = transaction.copyWith(id: id, createdAt: now);

    // Wrap both the product update and the transaction insert in a single
    // database transaction so they succeed or fail atomically.
    await _db.transaction(() async {
      final product = await _productDao.getById(tx.productId);
      if (product != null) {
        final newQty = tx.type == TransactionType.stockIn
            ? product.quantity + tx.quantity
            : product.quantity - tx.quantity;
        final updated = product.copyWith(quantity: newQty, updatedAt: now);
        await _productDao.upsert(ProductsTableCompanion.insert(
          id: updated.id,
          name: updated.name,
          description: Value(updated.description),
          categoryId: updated.categoryId,
          price: updated.price,
          quantity: updated.quantity,
          lowStockThreshold: Value(updated.lowStockThreshold),
          sku: Value(updated.sku),
          unit: Value(updated.unit),
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        ));
      }

      await _txDao.insert(TransactionsTableCompanion.insert(
        id: tx.id,
        productId: tx.productId,
        type: tx.type == TransactionType.stockIn ? 'stock_in' : 'stock_out',
        quantity: tx.quantity,
        notes: Value(tx.notes),
        userId: tx.userId,
        createdAt: tx.createdAt,
      ));
    });

    return tx;
  }

  @override
  Future<List<InventoryTransaction>> getAllTransactions() => _txDao.getAll();
}
