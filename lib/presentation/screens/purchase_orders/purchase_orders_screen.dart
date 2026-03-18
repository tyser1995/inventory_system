import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/permissions.dart';
import '../../../domain/entities/purchase_order.dart';
import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../../providers/permission_provider.dart';
import '../../providers/purchase_order_provider.dart';
import '../../widgets/common/confirm_dialog.dart';
import '../../widgets/tables/app_table_card.dart';

class PurchaseOrdersScreen extends ConsumerWidget {
  const PurchaseOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage =
        ref.watch(permissionProvider.notifier).can(AppPermission.managePurchaseOrders);
    final ordersAsync = ref.watch(purchaseOrderListProvider);
    final currency = NumberFormat.currency(symbol: '\$');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchase Orders'),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.business_outlined),
            label: const Text('Suppliers'),
            onPressed: () async {
              await context.push('/suppliers');
              ref.invalidate(purchaseOrderListProvider);
            },
          ),
          const SizedBox(width: 8),
          if (canManage)
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('New PO'),
              onPressed: () async {
                await context.push('/purchase-orders/new');
                ref.invalidate(purchaseOrderListProvider);
              },
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (orders) {
          if (orders.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No purchase orders yet'),
                ],
              ),
            );
          }

          return LayoutBuilder(
            builder: (ctx, constraints) {
              if (constraints.maxWidth < kTableMobileBreakpoint) {
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: orders.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final po = orders[i];
                    return AppTableCard(
                      actions: [
                        IconButton(
                          icon: const Icon(Icons.visibility_outlined),
                          tooltip: 'View / Edit',
                          onPressed: () async {
                            await context.push('/purchase-orders/${po.id}');
                            ref.invalidate(purchaseOrderListProvider);
                          },
                        ),
                        if (canManage && po.status == PurchaseOrderStatus.draft)
                          IconButton(
                            icon: const Icon(Icons.send_outlined),
                            tooltip: 'Mark as Sent',
                            onPressed: () => _updateStatus(
                                context, ref, po, PurchaseOrderStatus.sent),
                          ),
                        if (canManage && po.status == PurchaseOrderStatus.sent)
                          IconButton(
                            icon: const Icon(Icons.check_circle_outline,
                                color: Colors.green),
                            tooltip: 'Mark as Received',
                            onPressed: () => _updateStatus(
                                context, ref, po, PurchaseOrderStatus.received),
                          ),
                        if (canManage && po.status != PurchaseOrderStatus.received)
                          IconButton(
                            icon: const Icon(Icons.delete_outline,
                                color: Colors.red),
                            tooltip: 'Delete',
                            onPressed: () async {
                              final ok = await showConfirmDialog(
                                context,
                                title: 'Delete Purchase Order',
                                content: 'Delete PO ${po.id.substring(0, 8)}?',
                                confirmColor: Colors.red,
                              );
                              if (ok) {
                                await ref
                                    .read(purchaseOrderRepositoryProvider)
                                    .deletePurchaseOrder(po.id);
                                ref.invalidate(purchaseOrderListProvider);
                              }
                            },
                          ),
                      ],
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'PO #${po.id.substring(0, 8).toUpperCase()}',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.w600),
                                ),
                              ),
                              _StatusChip(po.status),
                            ],
                          ),
                          const SizedBox(height: 6),
                          AppCardField(
                            label: 'Supplier',
                            value: Text(po.supplierName ?? '—'),
                          ),
                          AppCardField(
                            label: 'Items',
                            value: Text('${po.items.length}'),
                          ),
                          AppCardField(
                            label: 'Total',
                            value: Text(currency.format(po.total)),
                          ),
                          AppCardField(
                            label: 'Date',
                            value: Text(po.createdAt.toString().substring(0, 10)),
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
                      DataColumn(label: Text('PO #')),
                      DataColumn(label: Text('Supplier')),
                      DataColumn(label: Text('Status')),
                      DataColumn(label: Text('Items')),
                      DataColumn(label: Text('Total')),
                      DataColumn(label: Text('Date')),
                      DataColumn(label: Text('Actions')),
                    ],
                    rows: orders.map((po) {
                      return DataRow(cells: [
                        DataCell(Text(po.id.substring(0, 8).toUpperCase())),
                        DataCell(Text(po.supplierName ?? '—')),
                        DataCell(_StatusChip(po.status)),
                        DataCell(Text('${po.items.length}')),
                        DataCell(Text(currency.format(po.total))),
                        DataCell(Text(po.createdAt.toString().substring(0, 10))),
                        DataCell(Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.visibility_outlined),
                              tooltip: 'View / Edit',
                              onPressed: () async {
                                await context.push('/purchase-orders/${po.id}');
                                ref.invalidate(purchaseOrderListProvider);
                              },
                            ),
                            if (canManage &&
                                po.status == PurchaseOrderStatus.draft) ...[
                              IconButton(
                                icon: const Icon(Icons.send_outlined),
                                tooltip: 'Mark as Sent',
                                onPressed: () => _updateStatus(
                                    context, ref, po, PurchaseOrderStatus.sent),
                              ),
                            ],
                            if (canManage &&
                                po.status == PurchaseOrderStatus.sent) ...[
                              IconButton(
                                icon: const Icon(Icons.check_circle_outline,
                                    color: Colors.green),
                                tooltip: 'Mark as Received',
                                onPressed: () => _updateStatus(
                                    context, ref, po, PurchaseOrderStatus.received),
                              ),
                            ],
                            if (canManage &&
                                po.status != PurchaseOrderStatus.received)
                              IconButton(
                                icon: const Icon(Icons.delete_outline,
                                    color: Colors.red),
                                tooltip: 'Delete',
                                onPressed: () async {
                                  final ok = await showConfirmDialog(
                                    context,
                                    title: 'Delete Purchase Order',
                                    content:
                                        'Delete PO ${po.id.substring(0, 8)}?',
                                    confirmColor: Colors.red,
                                  );
                                  if (ok) {
                                    await ref
                                        .read(purchaseOrderRepositoryProvider)
                                        .deletePurchaseOrder(po.id);
                                    ref.invalidate(purchaseOrderListProvider);
                                  }
                                },
                              ),
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
    );
  }

  Future<void> _updateStatus(BuildContext context, WidgetRef ref,
      PurchaseOrder po, PurchaseOrderStatus newStatus) async {
    final currentUser = ref.read(authProvider).valueOrNull;
    final label =
        newStatus == PurchaseOrderStatus.received ? 'received' : 'sent';
    final ok = await showConfirmDialog(
      context,
      title: 'Update Status',
      content:
          'Mark PO ${po.id.substring(0, 8)} as $label?${newStatus == PurchaseOrderStatus.received ? '\n\nThis will add stock for all items.' : ''}',
    );
    if (ok) {
      await ref.read(purchaseOrderRepositoryProvider).updateStatus(
            po.id,
            newStatus,
            receivedByUserId: currentUser?.id,
          );
      ref.invalidate(purchaseOrderListProvider);
    }
  }
}

class _StatusChip extends StatelessWidget {
  final PurchaseOrderStatus status;
  const _StatusChip(this.status);

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      PurchaseOrderStatus.draft => ('Draft', Colors.grey),
      PurchaseOrderStatus.sent => ('Sent', Colors.blue),
      PurchaseOrderStatus.received => ('Received', Colors.green),
      PurchaseOrderStatus.cancelled => ('Cancelled', Colors.red),
    };
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 11)),
      backgroundColor: color.withValues(alpha: 0.15),
      side: BorderSide(color: color),
      labelStyle: TextStyle(color: color),
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}
