import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/permissions.dart';
import '../../../domain/entities/sales_order.dart';
import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../../providers/permission_provider.dart';
import '../../providers/sales_order_provider.dart';
import '../../widgets/common/confirm_dialog.dart';
import '../../widgets/tables/app_table_card.dart';

class SalesOrdersScreen extends ConsumerStatefulWidget {
  const SalesOrdersScreen({super.key});

  @override
  ConsumerState<SalesOrdersScreen> createState() => _SalesOrdersScreenState();
}

class _SalesOrdersScreenState extends ConsumerState<SalesOrdersScreen> {
  SalesOrderStatus? _filterStatus;
  String? _filterChannel;

  @override
  Widget build(BuildContext context) {
    final canManage =
        ref.watch(permissionProvider.notifier).can(AppPermission.manageSalesOrders);
    final ordersAsync = ref.watch(salesOrderListProvider);
    final channelsAsync = ref.watch(lookupProvider('sales_channel'));
    final currency = NumberFormat.currency(symbol: '\$');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales Orders'),
        actions: [
          if (canManage)
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('New Order'),
              onPressed: () async {
                await context.push('/sales-orders/new');
                ref.invalidate(salesOrderListProvider);
              },
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: Column(
        children: [
          // ── Filters ─────────────────────────────────────────────────────
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Text('Status: '),
                ...[null, ...SalesOrderStatus.values].map((s) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(s?.label ?? 'All'),
                      selected: _filterStatus == s,
                      onSelected: (_) => setState(() => _filterStatus = s),
                    ),
                  );
                }),
                const SizedBox(width: 16),
                const Text('Channel: '),
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: FilterChip(
                    label: const Text('All'),
                    selected: _filterChannel == null,
                    onSelected: (_) => setState(() => _filterChannel = null),
                  ),
                ),
                ...channelsAsync.when(
                  data: (channels) => channels.map((c) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: FilterChip(
                          label: Text(c.label),
                          selected: _filterChannel == c.value,
                          onSelected: (_) =>
                              setState(() => _filterChannel = c.value),
                        ),
                      )),
                  loading: () => const [],
                  error: (_, __) => const [],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // ── Order list ───────────────────────────────────────────────────
          Expanded(
            child: ordersAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (orders) {
                final channels = channelsAsync.valueOrNull ?? [];
                final filtered = orders.where((o) {
                  if (_filterStatus != null && o.status != _filterStatus)
                    return false;
                  if (_filterChannel != null && o.channel != _filterChannel)
                    return false;
                  return true;
                }).toList();

                if (filtered.isEmpty) {
                  return const Center(child: Text('No orders found'));
                }

                String channelLabel(String value) {
                  final match = channels.where((c) => c.value == value);
                  return match.isNotEmpty ? match.first.label : value;
                }

                return LayoutBuilder(
                  builder: (ctx, constraints) {
                    if (constraints.maxWidth < kTableMobileBreakpoint) {
                      return ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final o = filtered[i];
                          return AppTableCard(
                            actions: [
                              IconButton(
                                icon: const Icon(Icons.visibility_outlined),
                                tooltip: 'View / Edit',
                                onPressed: () async {
                                  await context.push('/sales-orders/${o.id}');
                                  ref.invalidate(salesOrderListProvider);
                                },
                              ),
                              if (canManage) ...[
                                if (o.status == SalesOrderStatus.pending)
                                  IconButton(
                                    icon: const Icon(Icons.play_circle_outline,
                                        color: Colors.blue),
                                    tooltip: 'Start Processing',
                                    onPressed: () => _updateStatus(
                                        context, ref, o, SalesOrderStatus.processing),
                                  ),
                                if (o.status == SalesOrderStatus.processing)
                                  IconButton(
                                    icon: const Icon(Icons.check_circle_outline,
                                        color: Colors.green),
                                    tooltip: 'Complete Order',
                                    onPressed: () => _updateStatus(
                                        context, ref, o, SalesOrderStatus.completed),
                                  ),
                                if (o.status != SalesOrderStatus.completed &&
                                    o.status != SalesOrderStatus.cancelled)
                                  IconButton(
                                    icon: const Icon(Icons.cancel_outlined,
                                        color: Colors.orange),
                                    tooltip: 'Cancel',
                                    onPressed: () => _updateStatus(
                                        context, ref, o, SalesOrderStatus.cancelled),
                                  ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline,
                                      color: Colors.red),
                                  tooltip: 'Delete',
                                  onPressed: () async {
                                    final ok = await showConfirmDialog(
                                      context,
                                      title: 'Delete Order',
                                      content:
                                          'Delete order ${o.id.substring(0, 8)}?',
                                      confirmColor: Colors.red,
                                    );
                                    if (ok) {
                                      await ref
                                          .read(salesOrderRepositoryProvider)
                                          .deleteSalesOrder(o.id);
                                      ref.invalidate(salesOrderListProvider);
                                    }
                                  },
                                ),
                              ],
                            ],
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        'Order #${o.id.substring(0, 8).toUpperCase()}',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                    _StatusChip(o.status),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                AppCardField(
                                  label: 'Customer',
                                  value: Text(o.customerName ?? '—'),
                                ),
                                AppCardField(
                                  label: 'Channel',
                                  value: _ChannelChip(o.channel, channelLabel(o.channel)),
                                ),
                                AppCardField(
                                  label: 'Items',
                                  value: Text('${o.items.length}'),
                                ),
                                AppCardField(
                                  label: 'Total',
                                  value: Text(currency.format(o.total)),
                                ),
                                AppCardField(
                                  label: 'Date',
                                  value: Text(o.createdAt.toString().substring(0, 10)),
                                ),
                              ],
                            ),
                          );
                        },
                      );
                    }

                    // Desktop: DataTable
                    final th = Theme.of(context);
                    return Padding(
                      padding: const EdgeInsets.all(16),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(minWidth: constraints.maxWidth - 32),
                          child: DataTable(
                          headingRowColor: WidgetStatePropertyAll(
                            th.colorScheme.surfaceContainerHighest,
                          ),
                          headingTextStyle: th.textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: th.colorScheme.onSurfaceVariant,
                          ),
                          dataRowMinHeight: 48,
                          dataRowMaxHeight: 56,
                          dividerThickness: 1,
                          border: TableBorder.all(
                            color: th.colorScheme.outlineVariant,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          columns: const [
                            DataColumn(label: Text('Order #')),
                            DataColumn(label: Text('Customer')),
                            DataColumn(label: Text('Channel')),
                            DataColumn(label: Text('Status')),
                            DataColumn(label: Text('Items')),
                            DataColumn(label: Text('Total')),
                            DataColumn(label: Text('Date')),
                            DataColumn(label: Text('Actions')),
                          ],
                          rows: filtered.map((o) {
                            return DataRow(cells: [
                              DataCell(Text(o.id.substring(0, 8).toUpperCase())),
                              DataCell(Text(o.customerName ?? '—')),
                              DataCell(_ChannelChip(o.channel, channelLabel(o.channel))),
                              DataCell(_StatusChip(o.status)),
                              DataCell(Text('${o.items.length}')),
                              DataCell(Text(currency.format(o.total))),
                              DataCell(Text(o.createdAt.toString().substring(0, 10))),
                              DataCell(Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.visibility_outlined),
                                    tooltip: 'View / Edit',
                                    onPressed: () async {
                                      await context.push('/sales-orders/${o.id}');
                                      ref.invalidate(salesOrderListProvider);
                                    },
                                  ),
                                  if (canManage) ...[
                                    if (o.status == SalesOrderStatus.pending)
                                      IconButton(
                                        icon: const Icon(
                                            Icons.play_circle_outline,
                                            color: Colors.blue),
                                        tooltip: 'Start Processing',
                                        onPressed: () => _updateStatus(context,
                                            ref, o, SalesOrderStatus.processing),
                                      ),
                                    if (o.status == SalesOrderStatus.processing)
                                      IconButton(
                                        icon: const Icon(
                                            Icons.check_circle_outline,
                                            color: Colors.green),
                                        tooltip: 'Complete Order',
                                        onPressed: () => _updateStatus(context,
                                            ref, o, SalesOrderStatus.completed),
                                      ),
                                    if (o.status != SalesOrderStatus.completed &&
                                        o.status != SalesOrderStatus.cancelled)
                                      IconButton(
                                        icon: const Icon(Icons.cancel_outlined,
                                            color: Colors.orange),
                                        tooltip: 'Cancel',
                                        onPressed: () => _updateStatus(context,
                                            ref, o, SalesOrderStatus.cancelled),
                                      ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline,
                                          color: Colors.red),
                                      tooltip: 'Delete',
                                      onPressed: () async {
                                        final ok = await showConfirmDialog(
                                          context,
                                          title: 'Delete Order',
                                          content:
                                              'Delete order ${o.id.substring(0, 8)}?',
                                          confirmColor: Colors.red,
                                        );
                                        if (ok) {
                                          await ref
                                              .read(salesOrderRepositoryProvider)
                                              .deleteSalesOrder(o.id);
                                          ref.invalidate(salesOrderListProvider);
                                        }
                                      },
                                    ),
                                  ],
                                ],
                              )),
                            ]);
                          }).toList(),
                          ),
                        ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _updateStatus(BuildContext context, WidgetRef ref,
      SalesOrder order, SalesOrderStatus newStatus) async {
    final currentUser = ref.read(authProvider).valueOrNull;
    final extra = newStatus == SalesOrderStatus.completed
        ? '\n\nThis will deduct stock for all items.'
        : '';
    final ok = await showConfirmDialog(
      context,
      title: 'Update Status',
      content: 'Mark order ${order.id.substring(0, 8)} as ${newStatus.label}?$extra',
    );
    if (ok) {
      await ref.read(salesOrderRepositoryProvider).updateStatus(
            order.id,
            newStatus,
            processedByUserId: currentUser?.id,
          );
      ref.invalidate(salesOrderListProvider);
    }
  }
}

class _StatusChip extends StatelessWidget {
  final SalesOrderStatus status;
  const _StatusChip(this.status);

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      SalesOrderStatus.pending => Colors.grey,
      SalesOrderStatus.processing => Colors.blue,
      SalesOrderStatus.completed => Colors.green,
      SalesOrderStatus.cancelled => Colors.red,
    };
    return Chip(
      label: Text(status.label, style: const TextStyle(fontSize: 11)),
      backgroundColor: color.withValues(alpha: 0.15),
      side: BorderSide(color: color),
      labelStyle: TextStyle(color: color),
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}

class _ChannelChip extends StatelessWidget {
  final String channelValue;
  final String channelLabel;
  const _ChannelChip(this.channelValue, this.channelLabel);

  @override
  Widget build(BuildContext context) {
    const knownColors = {
      'retail': Colors.teal,
      'online': Colors.purple,
      'wholesale': Colors.orange,
      'b2b': Colors.blue,
      'direct': Colors.indigo,
    };
    const fallbackPalette = [
      Colors.teal,
      Colors.purple,
      Colors.orange,
      Colors.blue,
      Colors.indigo,
      Colors.grey
    ];
    final color = knownColors[channelValue] ??
        fallbackPalette[channelValue.hashCode.abs() % fallbackPalette.length];
    return Chip(
      label: Text(channelLabel, style: const TextStyle(fontSize: 11)),
      backgroundColor: color.withValues(alpha: 0.15),
      side: BorderSide(color: color),
      labelStyle: TextStyle(color: color),
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}
