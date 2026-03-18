import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/permissions.dart';
import '../../../domain/entities/product.dart';
import '../../providers/permission_provider.dart';
import '../../providers/product_provider.dart';
import '../../widgets/common/confirm_dialog.dart';
import '../../widgets/common/debounced_search_field.dart';
import '../../widgets/tables/app_table_card.dart';
import '../../widgets/tables/paginated_table.dart';

class ProductsScreen extends ConsumerWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(productListProvider);
    final notifier = ref.read(productListProvider.notifier);
    final perms = ref.watch(permissionProvider.notifier);
    final canManage = perms.can(AppPermission.manageProducts);
    final categories = ref.watch(categoryListProvider);
    final currency = NumberFormat.currency(symbol: '\$', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        actions: [
          if (canManage)
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Add Product'),
              onPressed: () => context.go('/products/new'),
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Search + category filter row
            Row(
              children: [
                Expanded(
                  child: DebouncedSearchField(
                    hint: 'Search by name or SKU...',
                    onChanged: notifier.setSearch,
                  ),
                ),
                const SizedBox(width: 12),
                categories.when(
                  data: (cats) => DropdownButton<String?>(
                    hint: const Text('All Categories'),
                    value: state.categoryId,
                    onChanged: notifier.setCategory,
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All Categories')),
                      ...cats.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))),
                    ],
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ],
            ),
            const SizedBox(height: 16),

            Expanded(
              child: AppPaginatedTable<Product>(
                isLoading: state.isLoading,
                rows: state.items,
                totalCount: state.totalCount,
                currentPage: state.page,
                pageSize: state.pageSize,
                onPageChanged: notifier.setPage,
                onPageSizeChanged: notifier.setPageSize,
                emptyMessage: 'No products found',
                columns: [
                  DataColumn(
                    label: _SortHeader('Name', 'name', state, notifier),
                    onSort: (_, __) => notifier.setSort('name'),
                  ),
                  const DataColumn(label: Text('Category')),
                  const DataColumn(label: Text('SKU')),
                  DataColumn(
                    label: _SortHeader('Price', 'price', state, notifier),
                    numeric: true,
                    onSort: (_, __) => notifier.setSort('price'),
                  ),
                  DataColumn(
                    label: _SortHeader('Qty', 'quantity', state, notifier),
                    numeric: true,
                    onSort: (_, __) => notifier.setSort('quantity'),
                  ),
                  const DataColumn(label: Text('Status')),
                  if (canManage) const DataColumn(label: Text('Actions')),
                ],
                rowBuilder: (product, index) => DataRow(
                  cells: [
                    DataCell(Text(product.name)),
                    DataCell(Text(product.categoryName ?? '—')),
                    DataCell(Text(product.sku ?? '—')),
                    DataCell(Text(currency.format(product.price))),
                    DataCell(Text('${product.quantity}')),
                    DataCell(_StockChip(product.isLowStock)),
                    if (canManage)
                      DataCell(Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined),
                            onPressed: () => context.go('/products/edit/${product.id}'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () async {
                              final confirmed = await showConfirmDialog(
                                context,
                                title: 'Delete Product',
                                content:
                                    'Are you sure you want to delete "${product.name}"?',
                                confirmColor: Colors.red,
                              );
                              if (confirmed) notifier.deleteProduct(product.id);
                            },
                          ),
                        ],
                      )),
                  ],
                ),
                mobileCardBuilder: (product) => AppTableCard(
                  actions: canManage
                      ? [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined),
                            onPressed: () => context.go('/products/edit/${product.id}'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () async {
                              final confirmed = await showConfirmDialog(
                                context,
                                title: 'Delete Product',
                                content: 'Delete "${product.name}"?',
                                confirmColor: Colors.red,
                              );
                              if (confirmed) notifier.deleteProduct(product.id);
                            },
                          ),
                        ]
                      : null,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              product.name,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                          ),
                          _StockChip(product.isLowStock),
                        ],
                      ),
                      const SizedBox(height: 6),
                      AppCardField(
                        label: 'Category',
                        value: Text(product.categoryName ?? '—'),
                      ),
                      AppCardField(
                        label: 'SKU',
                        value: Text(product.sku ?? '—'),
                      ),
                      AppCardField(
                        label: 'Price',
                        value: Text(currency.format(product.price)),
                      ),
                      AppCardField(
                        label: 'Quantity',
                        value: Text('${product.quantity}'),
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

class _StockChip extends StatelessWidget {
  final bool isLowStock;
  const _StockChip(this.isLowStock);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Chip(
      label: Text(isLowStock ? 'Low Stock' : 'OK'),
      backgroundColor: isLowStock
          ? cs.errorContainer.withValues(alpha: 0.6)
          : cs.primaryContainer.withValues(alpha: 0.6),
      labelStyle: TextStyle(
        color: isLowStock ? cs.onErrorContainer : cs.onPrimaryContainer,
        fontSize: 11,
      ),
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}

class _SortHeader extends StatelessWidget {
  final String label;
  final String column;
  final ProductListState state;
  final ProductListNotifier notifier;

  const _SortHeader(this.label, this.column, this.state, this.notifier);

  @override
  Widget build(BuildContext context) {
    final isActive = state.sortColumn == column;
    return GestureDetector(
      onTap: () => notifier.setSort(column),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label),
          if (isActive)
            Icon(
              state.sortAscending ? Icons.arrow_upward : Icons.arrow_downward,
              size: 14,
            ),
        ],
      ),
    );
  }
}
