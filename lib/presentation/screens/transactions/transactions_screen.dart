import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/transaction.dart';
import '../../providers/transaction_provider.dart';
import '../../widgets/tables/app_table_card.dart';
import '../../widgets/tables/paginated_table.dart';

class TransactionsScreen extends ConsumerWidget {
  const TransactionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(transactionListProvider);
    final notifier = ref.read(transactionListProvider.notifier);
    final fmt = DateFormat('yyyy-MM-dd HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transactions'),
        actions: [
          FilledButton.icon(
            icon: const Icon(Icons.add),
            label: const Text('Record Transaction'),
            onPressed: () => context.go('/transactions/new'),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Type filter chips
            Row(
              children: [
                const Text('Filter: '),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('All'),
                  selected: state.typeFilter == null,
                  onSelected: (_) => notifier.setTypeFilter(null),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Stock In'),
                  selected: state.typeFilter == TransactionType.stockIn,
                  onSelected: (_) => notifier.setTypeFilter(TransactionType.stockIn),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Stock Out'),
                  selected: state.typeFilter == TransactionType.stockOut,
                  onSelected: (_) => notifier.setTypeFilter(TransactionType.stockOut),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Expanded(
              child: AppPaginatedTable<InventoryTransaction>(
                isLoading: state.isLoading,
                rows: state.items,
                totalCount: state.totalCount,
                currentPage: state.page,
                pageSize: state.pageSize,
                onPageChanged: notifier.setPage,
                onPageSizeChanged: notifier.setPageSize,
                emptyMessage: 'No transactions found',
                columns: const [
                  DataColumn(label: Text('Date')),
                  DataColumn(label: Text('Product')),
                  DataColumn(label: Text('Type')),
                  DataColumn(label: Text('Qty'), numeric: true),
                  DataColumn(label: Text('By')),
                  DataColumn(label: Text('Notes')),
                ],
                rowBuilder: (tx, _) => DataRow(cells: [
                  DataCell(Text(fmt.format(tx.createdAt))),
                  DataCell(Text(tx.productName ?? tx.productId)),
                  DataCell(_TxTypeChip(tx.type)),
                  DataCell(Text('${tx.quantity}')),
                  DataCell(Text(tx.userName ?? '—')),
                  DataCell(Text(tx.notes ?? '—')),
                ]),
                mobileCardBuilder: (tx) => AppTableCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              tx.productName ?? tx.productId,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                          ),
                          _TxTypeChip(tx.type),
                        ],
                      ),
                      const SizedBox(height: 6),
                      AppCardField(
                        label: 'Date',
                        value: Text(fmt.format(tx.createdAt)),
                      ),
                      AppCardField(
                        label: 'Quantity',
                        value: Text('${tx.quantity}'),
                      ),
                      AppCardField(
                        label: 'By',
                        value: Text(tx.userName ?? '—'),
                      ),
                      if (tx.notes != null)
                        AppCardField(
                          label: 'Notes',
                          value: Text(tx.notes!),
                          inline: false,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TxTypeChip extends StatelessWidget {
  final TransactionType type;
  const _TxTypeChip(this.type);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isIn = type == TransactionType.stockIn;
    return Chip(
      label: Text(isIn ? 'Stock In' : 'Stock Out'),
      backgroundColor: isIn
          ? cs.primaryContainer.withValues(alpha: 0.6)
          : cs.errorContainer.withValues(alpha: 0.6),
      labelStyle: TextStyle(
        color: isIn ? cs.onPrimaryContainer : cs.onErrorContainer,
        fontSize: 11,
      ),
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}
