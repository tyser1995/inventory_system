import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/constants/permissions.dart';
import '../../../domain/entities/warehouse.dart';
import '../../providers/core_providers.dart';
import '../../providers/permission_provider.dart';
import '../../providers/warehouse_provider.dart';
import '../../providers/product_provider.dart';
import '../../widgets/common/confirm_dialog.dart';

class WarehousesScreen extends ConsumerWidget {
  const WarehousesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage =
        ref.watch(permissionProvider.notifier).can(AppPermission.manageWarehouses);
    final warehousesAsync = ref.watch(warehouseListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Warehouses'),
        actions: [
          if (canManage)
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Add Warehouse'),
              onPressed: () => _showForm(context, ref, null),
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: warehousesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (warehouses) {
          if (warehouses.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.warehouse_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No warehouses yet'),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: warehouses.length,
            itemBuilder: (ctx, i) {
              final w = warehouses[i];
              return _WarehouseCard(
                warehouse: w,
                canManage: canManage,
                onEdit: () => _showForm(context, ref, w),
                onDelete: () async {
                  final ok = await showConfirmDialog(
                    context,
                    title: 'Delete Warehouse',
                    content: 'Delete "${w.name}"? All stock records will be removed.',
                    confirmColor: Colors.red,
                  );
                  if (ok) {
                    await ref
                        .read(warehouseRepositoryProvider)
                        .deleteWarehouse(w.id);
                    ref.invalidate(warehouseListProvider);
                  }
                },
                onSetDefault: () async {
                  await ref
                      .read(warehouseRepositoryProvider)
                      .setDefault(w.id);
                  ref.invalidate(warehouseListProvider);
                },
              );
            },
          );
        },
      ),
    );
  }

  void _showForm(BuildContext context, WidgetRef ref, Warehouse? existing) {
    final nameCtrl = TextEditingController(text: existing?.name);
    final addressCtrl = TextEditingController(text: existing?.address);
    final notesCtrl = TextEditingController(text: existing?.notes);
    final formKey = GlobalKey<FormState>();
    const uuid = Uuid();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(existing == null ? 'New Warehouse' : 'Edit Warehouse'),
        content: SizedBox(
          width: 400,
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Name *'),
                  validator: (v) =>
                      v == null || v.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: addressCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Address'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: notesCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Notes'),
                  maxLines: 2,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              final repo = ref.read(warehouseRepositoryProvider);
              final now = DateTime.now();
              final warehouse = Warehouse(
                id: existing?.id ?? uuid.v4(),
                name: nameCtrl.text.trim(),
                address: addressCtrl.text.trim().isEmpty
                    ? null
                    : addressCtrl.text.trim(),
                notes:
                    notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
                isDefault: existing?.isDefault ?? false,
                createdAt: existing?.createdAt ?? now,
              );
              if (existing == null) {
                await repo.createWarehouse(warehouse);
              } else {
                await repo.updateWarehouse(warehouse);
              }
              ref.invalidate(warehouseListProvider);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: Text(existing == null ? 'Create' : 'Update'),
          ),
        ],
      ),
    );
  }
}

class _WarehouseCard extends ConsumerWidget {
  final Warehouse warehouse;
  final bool canManage;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onSetDefault;

  const _WarehouseCard({
    required this.warehouse,
    required this.canManage,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stockAsync = ref.watch(warehouseStockProvider(warehouse.id));
    final productsState = ref.watch(productListProvider);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor:
              warehouse.isDefault ? Colors.green.shade100 : null,
          child: Icon(
            Icons.warehouse,
            color: warehouse.isDefault ? Colors.green : null,
          ),
        ),
        title: Row(
          children: [
            Text(warehouse.name),
            if (warehouse.isDefault) ...[
              const SizedBox(width: 8),
              const Chip(
                label: Text('Default', style: TextStyle(fontSize: 10)),
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ],
        ),
        subtitle: warehouse.address != null ? Text(warehouse.address!) : null,
        trailing: canManage
            ? PopupMenuButton<String>(
                onSelected: (v) {
                  switch (v) {
                    case 'edit':
                      onEdit();
                    case 'default':
                      onSetDefault();
                    case 'delete':
                      onDelete();
                  }
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(
                      value: 'edit', child: Text('Edit')),
                  if (!warehouse.isDefault)
                    const PopupMenuItem(
                        value: 'default', child: Text('Set as Default')),
                  const PopupMenuItem(
                      value: 'delete',
                      child:
                          Text('Delete', style: TextStyle(color: Colors.red))),
                ],
              )
            : null,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (warehouse.notes != null)
                  Text(warehouse.notes!,
                      style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 12),
                Text('Stock Levels',
                    style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 8),
                stockAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Error: $e'),
                  data: (stocks) {
                    if (stocks.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.all(8),
                        child: Row(
                          children: [
                            const Text('No stock assigned. '),
                            if (canManage)
                              TextButton(
                                onPressed: () => _showTransferDialog(
                                    context, ref, warehouse, productsState.items),
                                child: const Text('Assign stock'),
                              ),
                          ],
                        ),
                      );
                    }
                    return Column(
                      children: [
                        ...stocks.map((s) => ListTile(
                              dense: true,
                              title: Text(s.productName),
                              subtitle: s.sku != null ? Text('SKU: ${s.sku}') : null,
                              trailing: Chip(
                                label: Text('${s.quantity}'),
                                visualDensity: VisualDensity.compact,
                              ),
                            )),
                        if (canManage)
                          TextButton.icon(
                            icon: const Icon(Icons.compare_arrows),
                            label: const Text('Transfer Stock'),
                            onPressed: () => _showTransferDialog(
                                context, ref, warehouse, productsState.items),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showTransferDialog(BuildContext context, WidgetRef ref,
      Warehouse fromWarehouse, List products) {
    showDialog(
      context: context,
      builder: (ctx) => _TransferDialog(
        fromWarehouse: fromWarehouse,
        products: products,
        onTransfer: (productId, toWarehouseId, qty) async {
          await ref.read(warehouseRepositoryProvider).transferStock(
                productId: productId,
                fromWarehouseId: fromWarehouse.id,
                toWarehouseId: toWarehouseId,
                qty: qty,
              );
          ref.invalidate(warehouseStockProvider(fromWarehouse.id));
          ref.invalidate(warehouseStockProvider(toWarehouseId));
        },
      ),
    );
  }
}

class _TransferDialog extends ConsumerStatefulWidget {
  final Warehouse fromWarehouse;
  final List products;
  final Future<void> Function(String productId, String toWarehouseId, int qty)
      onTransfer;

  const _TransferDialog({
    required this.fromWarehouse,
    required this.products,
    required this.onTransfer,
  });

  @override
  ConsumerState<_TransferDialog> createState() => _TransferDialogState();
}

class _TransferDialogState extends ConsumerState<_TransferDialog> {
  String? _productId;
  String? _toWarehouseId;
  final _qtyCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _qtyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final warehousesAsync = ref.watch(warehouseListProvider);

    return AlertDialog(
      title: const Text('Transfer Stock'),
      content: warehousesAsync.when(
        loading: () => const CircularProgressIndicator(),
        error: (e, _) => Text('Error: $e'),
        data: (warehouses) {
          final destinations = warehouses
              .where((w) => w.id != widget.fromWarehouse.id)
              .toList();
          return SizedBox(
            width: 360,
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    decoration:
                        const InputDecoration(labelText: 'Product *'),
                    items: widget.products
                        .map<DropdownMenuItem<String>>((p) =>
                            DropdownMenuItem(value: p.id, child: Text(p.name)))
                        .toList(),
                    onChanged: (v) => setState(() => _productId = v),
                    validator: (v) =>
                        v == null ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    decoration:
                        const InputDecoration(labelText: 'To Warehouse *'),
                    items: destinations
                        .map((w) =>
                            DropdownMenuItem(value: w.id, child: Text(w.name)))
                        .toList(),
                    onChanged: (v) => setState(() => _toWarehouseId = v),
                    validator: (v) =>
                        v == null ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _qtyCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Quantity *'),
                    keyboardType: TextInputType.number,
                    validator: (v) {
                      final n = int.tryParse(v ?? '');
                      if (n == null || n <= 0) return 'Enter a positive number';
                      return null;
                    },
                  ),
                ],
              ),
            ),
          );
        },
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () async {
            if (!_formKey.currentState!.validate()) return;
            await widget.onTransfer(
                _productId!, _toWarehouseId!, int.parse(_qtyCtrl.text));
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('Transfer'),
        ),
      ],
    );
  }
}
