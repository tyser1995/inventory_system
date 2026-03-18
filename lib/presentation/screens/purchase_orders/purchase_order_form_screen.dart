import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../../../domain/entities/purchase_order.dart';
import '../../../domain/entities/supplier.dart';
import '../../providers/core_providers.dart';
import '../../providers/product_provider.dart';
import '../../providers/purchase_order_provider.dart';

class PurchaseOrderFormScreen extends ConsumerStatefulWidget {
  final String? purchaseOrderId;
  const PurchaseOrderFormScreen({super.key, this.purchaseOrderId});

  @override
  ConsumerState<PurchaseOrderFormScreen> createState() =>
      _PurchaseOrderFormScreenState();
}

class _PurchaseOrderFormScreenState
    extends ConsumerState<PurchaseOrderFormScreen> {
  final _notesCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  static const _uuid = Uuid();

  String? _selectedSupplierId;
  List<Supplier> _suppliers = [];
  PurchaseOrderStatus _status = PurchaseOrderStatus.draft;
  final List<_ItemRow> _items = [];
  bool _loading = false;
  bool _initialized = false;

  @override
  void dispose() {
    _notesCtrl.dispose();
    for (final r in _items) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _init(List<Supplier> suppliers) async {
    if (_initialized) return;
    _initialized = true;
    if (widget.purchaseOrderId != null) {
      final po = await ref
          .read(purchaseOrderRepositoryProvider)
          .getPurchaseOrder(widget.purchaseOrderId!);
      if (po != null && mounted) {
        setState(() {
          _selectedSupplierId = po.supplierId;
          _status = po.status;
          _notesCtrl.text = po.notes ?? '';
          _items.addAll(po.items.map((item) => _ItemRow(
                id: item.id,
                productId: item.productId,
                productName: item.productName ?? '',
                qty: item.quantity,
                cost: item.unitCost,
              )));
        });
      }
    }
  }

  double get _total =>
      _items.fold(0.0, (s, r) => s + r.qty * (double.tryParse(r.costCtrl.text) ?? 0));

  @override
  Widget build(BuildContext context) {
    final suppliersAsync = ref.watch(supplierListProvider);
    final productsAsync = ref.watch(productListProvider);
    final currency = NumberFormat.currency(symbol: '\$');
    final isEdit = widget.purchaseOrderId != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Purchase Order' : 'New Purchase Order'),
      ),
      body: suppliersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (suppliers) {
          _suppliers = suppliers;
          _init(suppliers);
          final products = productsAsync.items;

          // No suppliers yet — show a prompt instead of a broken form
          if (suppliers.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.business_outlined, size: 64, color: Colors.grey),
                    const SizedBox(height: 16),
                    const Text(
                      'No suppliers found',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Add at least one supplier before creating a purchase order.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      icon: const Icon(Icons.add_business),
                      label: const Text('Go to Suppliers'),
                      onPressed: () => context.push('/suppliers'),
                    ),
                  ],
                ),
              ),
            );
          }

          return Form(
            key: _formKey,
            child: Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Supplier ────────────────────────────────────────
                        DropdownButtonFormField<String>(
                          value: _selectedSupplierId,
                          decoration: const InputDecoration(
                              labelText: 'Supplier *',
                              border: OutlineInputBorder()),
                          items: suppliers
                              .map((s) => DropdownMenuItem(
                                    value: s.id,
                                    child: Text(s.name),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedSupplierId = v),
                          validator: (v) =>
                              v == null ? 'Select a supplier' : null,
                        ),
                        const SizedBox(height: 12),

                        // ── Status ──────────────────────────────────────────
                        DropdownButtonFormField<PurchaseOrderStatus>(
                          value: _status,
                          decoration: const InputDecoration(
                              labelText: 'Status',
                              border: OutlineInputBorder()),
                          items: PurchaseOrderStatus.values
                              .map((s) => DropdownMenuItem(
                                    value: s,
                                    child: Text(s.name
                                        .replaceAll('_', ' ')
                                        .toUpperCase()),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _status = v!),
                        ),
                        const SizedBox(height: 12),

                        // ── Notes ───────────────────────────────────────────
                        TextFormField(
                          controller: _notesCtrl,
                          decoration: const InputDecoration(
                              labelText: 'Notes',
                              border: OutlineInputBorder()),
                          maxLines: 2,
                        ),
                        const SizedBox(height: 24),

                        // ── Line items ──────────────────────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Line Items',
                                style: Theme.of(context).textTheme.titleMedium),
                            TextButton.icon(
                              icon: const Icon(Icons.add),
                              label: const Text('Add Item'),
                              onPressed: () => setState(() =>
                                  _items.add(_ItemRow(id: _uuid.v4()))),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),

                        ..._items.asMap().entries.map((e) {
                          final row = e.value;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                children: [
                                  DropdownButtonFormField<String>(
                                    value: row.productId.isEmpty
                                        ? null
                                        : row.productId,
                                    decoration: const InputDecoration(
                                        labelText: 'Product *',
                                        isDense: true),
                                    items: products
                                        .map((p) => DropdownMenuItem(
                                              value: p.id,
                                              child: Text(p.name),
                                            ))
                                        .toList(),
                                    onChanged: (v) => setState(() {
                                      row.productId = v ?? '';
                                      row.productName = products
                                          .firstWhere((p) => p.id == v,
                                              orElse: () => products.first)
                                          .name;
                                    }),
                                    validator: (v) =>
                                        v == null || v.isEmpty
                                            ? 'Required'
                                            : null,
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: TextFormField(
                                          controller: row.qtyCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Qty *',
                                              isDense: true),
                                          keyboardType: TextInputType.number,
                                          onChanged: (_) => setState(() {}),
                                          validator: (v) {
                                            final n = int.tryParse(v ?? '');
                                            if (n == null || n <= 0)
                                              return 'Required';
                                            return null;
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: TextFormField(
                                          controller: row.costCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Unit Cost *',
                                              prefixText: '\$',
                                              isDense: true),
                                          keyboardType: const TextInputType
                                              .numberWithOptions(decimal: true),
                                          onChanged: (_) => setState(() {}),
                                          validator: (v) {
                                            final n = double.tryParse(v ?? '');
                                            if (n == null || n < 0)
                                              return 'Required';
                                            return null;
                                          },
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(
                                            Icons.delete_outline,
                                            color: Colors.red),
                                        onPressed: () => setState(
                                            () => _items.removeAt(e.key)),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),

                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            'Total: ${currency.format(_total)}',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // ── Footer save button ─────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          onPressed: _loading ? null : () => _save(context),
                          child: _loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white),
                                )
                              : Text(isEdit ? 'Update' : 'Create'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _save(BuildContext context) async {
    if (!_formKey.currentState!.validate()) return;
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one item')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final repo = ref.read(purchaseOrderRepositoryProvider);
      final supplier = _suppliers.firstWhere((s) => s.id == _selectedSupplierId);
      final items = _items
          .map((r) => PurchaseOrderItem(
                id: r.id,
                purchaseOrderId: widget.purchaseOrderId ?? '',
                productId: r.productId,
                productName: r.productName,
                quantity: int.tryParse(r.qtyCtrl.text) ?? 1,
                unitCost: double.tryParse(r.costCtrl.text) ?? 0,
              ))
          .toList();

      final order = PurchaseOrder(
        id: widget.purchaseOrderId ?? '',
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: _status,
        total: _total,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      if (widget.purchaseOrderId == null) {
        await repo.createPurchaseOrder(order, items);
      } else {
        await repo.updatePurchaseOrder(order, items);
      }

      if (context.mounted) context.pop();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _ItemRow {
  String id;
  String productId;
  String productName;
  int qty;
  double cost;
  late final TextEditingController qtyCtrl;
  late final TextEditingController costCtrl;

  _ItemRow({
    required this.id,
    this.productId = '',
    this.productName = '',
    this.qty = 1,
    this.cost = 0,
  }) {
    qtyCtrl = TextEditingController(text: qty > 0 ? '$qty' : '');
    costCtrl = TextEditingController(text: cost > 0 ? '$cost' : '');
  }

  void dispose() {
    qtyCtrl.dispose();
    costCtrl.dispose();
  }
}
