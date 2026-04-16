import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/transaction.dart';
import '../../domain/repositories/product_repository.dart';
import '../../domain/repositories/transaction_repository.dart';

class SupabaseTransactionRepository implements TransactionRepository {
  final SupabaseClient _client;

  SupabaseTransactionRepository(this._client);

  InventoryTransaction _map(Map<String, dynamic> r) => InventoryTransaction(
        id: r['id'] as String,
        productId: r['product_id'] as String,
        productName: (r['products'] as Map<String, dynamic>?)?['name'] as String?,
        type: r['type'] == 'stockIn' ? TransactionType.stockIn : TransactionType.stockOut,
        quantity: r['quantity'] as int,
        notes: r['notes'] as String?,
        userId: r['user_id'] as String,
        userName: (r['users'] as Map<String, dynamic>?)?['username'] as String?,
        createdAt: DateTime.parse(r['created_at'] as String),
      );

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
  }) async {
    var q = _client
        .from('inventory_transactions')
        .select('*, products(name), users(username)');

    if (productId != null) q = q.eq('product_id', productId);
    if (type != null) q = q.eq('type', type.name);
    if (from != null) q = q.gte('created_at', from.toIso8601String());
    if (to != null) q = q.lte('created_at', to.toIso8601String());

    final col = sortColumn ?? 'created_at';
    final rows = await q
        .order(col, ascending: sortAscending)
        .range(page * pageSize, page * pageSize + pageSize - 1);

    final items = (rows as List).map((r) => _map(r as Map<String, dynamic>)).toList();
    return PagedResult(items: items, totalCount: items.length);
  }

  @override
  Future<InventoryTransaction> createTransaction(InventoryTransaction transaction) async {
    final row = await _client.from('inventory_transactions').insert({
      'product_id': transaction.productId,
      'type': transaction.type.name,
      'quantity': transaction.quantity,
      'notes': transaction.notes,
      'user_id': transaction.userId,
      'created_at': transaction.createdAt.toIso8601String(),
    }).select('*, products(name), users(username)').single();
    return _map(row);
  }

  @override
  Future<List<InventoryTransaction>> getAllTransactions() async {
    final rows = await _client
        .from('inventory_transactions')
        .select('*, products(name), users(username)')
        .order('created_at', ascending: false);
    return (rows as List).map((r) => _map(r as Map<String, dynamic>)).toList();
  }
}
