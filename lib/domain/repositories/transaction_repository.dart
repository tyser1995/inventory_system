import '../entities/transaction.dart';
import 'product_repository.dart';

abstract class TransactionRepository {
  Future<PagedResult<InventoryTransaction>> getTransactions({
    int page = 0,
    int pageSize = 10,
    String? productId,
    TransactionType? type,
    DateTime? from,
    DateTime? to,
    String? sortColumn,
    bool sortAscending = false,
  });
  Future<InventoryTransaction> createTransaction(InventoryTransaction transaction);
  Future<List<InventoryTransaction>> getAllTransactions();
}
