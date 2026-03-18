import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import 'app_table_card.dart';

/// Generic paginated data table widget used across all list screens.
/// Supports an optional [mobileCardBuilder] — when provided and the
/// available width is below [kTableMobileBreakpoint], the table switches
/// to a scrollable list of cards instead of a DataTable.
class AppPaginatedTable<T> extends StatelessWidget {
  final List<DataColumn> columns;
  final List<T> rows;
  final DataRow Function(T item, int index) rowBuilder;
  final Widget Function(T item)? mobileCardBuilder;
  final int totalCount;
  final int currentPage;
  final int pageSize;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<int> onPageSizeChanged;
  final bool isLoading;
  final String? emptyMessage;

  const AppPaginatedTable({
    super.key,
    required this.columns,
    required this.rows,
    required this.rowBuilder,
    required this.totalCount,
    required this.currentPage,
    required this.pageSize,
    required this.onPageChanged,
    required this.onPageSizeChanged,
    this.mobileCardBuilder,
    this.isLoading = false,
    this.emptyMessage,
  });

  int get _totalPages => totalCount == 0 ? 1 : (totalCount / pageSize).ceil();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile =
            constraints.maxWidth < kTableMobileBreakpoint && mobileCardBuilder != null;

        Widget content;
        if (isLoading) {
          content = const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(child: CircularProgressIndicator()),
          );
        } else if (rows.isEmpty) {
          content = Padding(
            padding: const EdgeInsets.symmetric(vertical: 48),
            child: Center(
              child: Text(
                emptyMessage ?? 'No records found',
                style: theme.textTheme.bodyLarge
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
            ),
          );
        } else if (isMobile) {
          content = Expanded(
            child: ListView.separated(
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => mobileCardBuilder!(rows[i]),
            ),
          );
        } else {
          content = ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: constraints.maxWidth),
                child: DataTable(
                  headingRowColor: WidgetStatePropertyAll(
                    theme.colorScheme.surfaceContainerHighest,
                  ),
                  headingTextStyle: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  dataRowMinHeight: 48,
                  dataRowMaxHeight: 56,
                  dividerThickness: 1,
                  border: TableBorder.all(
                    color: theme.colorScheme.outlineVariant,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  columns: columns,
                  rows: rows
                      .asMap()
                      .entries
                      .map((e) => rowBuilder(e.value, e.key))
                      .toList(),
                ),
              ),
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            content,
            const SizedBox(height: 12),

            // Pagination controls
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text('Rows per page:', style: theme.textTheme.bodySmall),
                    const SizedBox(width: 8),
                    DropdownButton<int>(
                      value: pageSize,
                      underline: const SizedBox.shrink(),
                      items: AppConstants.rowsPerPageOptions
                          .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                          .toList(),
                      onChanged: (v) => v != null ? onPageSizeChanged(v) : null,
                    ),
                  ],
                ),
                Row(
                  children: [
                    Text(
                      '${currentPage + 1} / $_totalPages  ($totalCount total)',
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(width: 8),
                    IconButton.outlined(
                      icon: const Icon(Icons.chevron_left),
                      onPressed:
                          currentPage > 0 ? () => onPageChanged(currentPage - 1) : null,
                    ),
                    const SizedBox(width: 4),
                    IconButton.outlined(
                      icon: const Icon(Icons.chevron_right),
                      onPressed: currentPage < _totalPages - 1
                          ? () => onPageChanged(currentPage + 1)
                          : null,
                    ),
                  ],
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}
