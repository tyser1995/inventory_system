import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../../../domain/entities/sales_order.dart';
import '../../providers/core_providers.dart';
import '../../providers/product_provider.dart';

class SalesOrderFormScreen extends ConsumerStatefulWidget {
  final String? salesOrderId;
  const SalesOrderFormScreen({super.key, this.salesOrderId});

  @override
  ConsumerState<SalesOrderFormScreen> createState() =>
      _SalesOrderFormScreenState();
}

class _SalesOrderFormScreenState extends ConsumerState<SalesOrderFormScreen> {
  final _customerCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  static const _uuid = Uuid();

  String? _channel;
  SalesOrderStatus _status = SalesOrderStatus.pending;
  final List<_ItemRow> _items = [];
  bool _loading = false;
  bool _initialized = false;

  @override
  void dispose() {
    _customerCtrl.dispose();
    _notesCtrl.dispose();
    for (final r in _items) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _init() async {
    if (_initialized) return;
    _initialized = true;
    if (widget.salesOrderId != null) {
      final order = await ref
          .read(salesOrderRepositoryProvider)
          .getSalesOrder(widget.salesOrderId!);
      if (order != null && mounted) {
        setState(() {
          _customerCtrl.text = order.customerName ?? '';
          _notesCtrl.text = order.notes ?? '';
          _channel = order.channel;
          _status = order.status;
          _items.addAll(order.items.map((item) => _ItemRow(
                id: item.id,
                productId: item.productId,
                productName: item.productName ?? '',
                qty: item.quantity,
                price: item.unitPrice,
              )));
        });
      }
    }
  }

  double get _total =>
      _items.fold(0.0, (s, r) => s + r.qty * (double.tryParse(r.priceCtrl.text) ?? 0));

  @override
  Widget build(BuildContext context) {
    _init();
    final productsState = ref.watch(productListProvider);
    final products = productsState.items;
    final channelsAsync = ref.watch(lookupProvider('sales_channel'));
    final currency = NumberFormat.currency(symbol: '\$');
    final isEdit = widget.salesOrderId != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Sales Order' : 'New Sales Order'),
      ),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Customer ─────────────────────────────────────────
                    TextFormField(
                      controller: _customerCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Customer Name',
                          border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),

                    // ── Channel ──────────────────────────────────────────
                    channelsAsync.when(
                      data: (channels) {
                        // Auto-select first channel if not set
                        if (_channel == null && channels.isNotEmpty) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted && _channel == null) {
                              setState(() => _channel = channels.first.value);
                            }
                          });
                        }
                        return DropdownButtonFormField<String>(
                          value: channels.any((c) => c.value == _channel)
                              ? _channel
                              : null,
                          decoration: const InputDecoration(
                              labelText: 'Sales Channel *',
                              border: OutlineInputBorder()),
                          items: channels
                              .map((c) => DropdownMenuItem(
                                    value: c.value,
                                    child: Text(c.label),
                                  ))
                              .toList(),
                          onChanged: (v) => setState(() => _channel = v),
                          validator: (v) =>
                              v == null ? 'Select a channel' : null,
                        );
                      },
                      loading: () => const LinearProgressIndicator(),
                      error: (_, __) => const Text('Error loading channels'),
                    ),
                    const SizedBox(height: 12),

                    // ── Status ───────────────────────────────────────────
                    DropdownButtonFormField<SalesOrderStatus>(
                      value: _status,
                      decoration: const InputDecoration(
                          labelText: 'Status',
                          border: OutlineInputBorder()),
                      items: SalesOrderStatus.values
                          .map((s) => DropdownMenuItem(
                                value: s,
                                child: Text(s.label),
                              ))
                          .toList(),
                      onChanged: (v) => setState(() => _status = v!),
                    ),
                    const SizedBox(height: 12),

                    // ── Notes ────────────────────────────────────────────
                    TextFormField(
                      controller: _notesCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Notes',
                          border: OutlineInputBorder()),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 24),

                    // ── Line items ───────────────────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Order Items',
                            style: Theme.of(context).textTheme.titleMedium),
                        TextButton.icon(
                          icon: const Icon(Icons.add),
                          label: const Text('Add Item'),
                          onPressed: () =>
                              setState(() => _items.add(_ItemRow(id: _uuid.v4()))),
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
                                value: row.productId.isEmpty ? null : row.productId,
                                decoration: const InputDecoration(
                                    labelText: 'Product *', isDense: true),
                                items: products
                                    .map((p) => DropdownMenuItem(
                                          value: p.id,
                                          child: Text(
                                              '${p.name} (${p.quantity} in stock)'),
                                        ))
                                    .toList(),
                                onChanged: (v) => setState(() {
                                  row.productId = v ?? '';
                                  final product = products.firstWhere(
                                      (p) => p.id == v,
                                      orElse: () => products.first);
                                  row.productName = product.name;
                                  if (row.priceCtrl.text.isEmpty) {
                                    row.priceCtrl.text =
                                        product.price.toStringAsFixed(2);
                                  }
                                }),
                                validator: (v) =>
                                    v == null || v.isEmpty ? 'Required' : null,
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextFormField(
                                      controller: row.qtyCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Qty *', isDense: true),
                                      keyboardType: TextInputType.number,
                                      onChanged: (_) => setState(() {}),
                                      validator: (v) {
                                        final n = int.tryParse(v ?? '');
                                        if (n == null || n <= 0) return 'Required';
                                        return null;
                                      },
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: TextFormField(
                                      controller: row.priceCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Unit Price *',
                                          prefixText: '\$',
                                          isDense: true),
                                      keyboardType:
                                          const TextInputType.numberWithOptions(
                                              decimal: true),
                                      onChanged: (_) => setState(() {}),
                                      validator: (v) {
                                        final n = double.tryParse(v ?? '');
                                        if (n == null || n < 0) return 'Required';
                                        return null;
                                      },
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline,
                                        color: Colors.red),
                                    onPressed: () =>
                                        setState(() => _items.removeAt(e.key)),
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

            // ── Footer ──────────────────────────────────────────────────
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
      final repo = ref.read(salesOrderRepositoryProvider);
      final items = _items
          .map((r) => SalesOrderItem(
                id: r.id,
                salesOrderId: widget.salesOrderId ?? '',
                productId: r.productId,
                productName: r.productName,
                quantity: int.tryParse(r.qtyCtrl.text) ?? 1,
                unitPrice: double.tryParse(r.priceCtrl.text) ?? 0,
              ))
          .toList();

      final order = SalesOrder(
        id: widget.salesOrderId ?? '',
        customerName: _customerCtrl.text.trim().isEmpty
            ? null
            : _customerCtrl.text.trim(),
        channel: _channel ?? 'retail',
        status: _status,
        total: _total,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      if (widget.salesOrderId == null) {
        await repo.createSalesOrder(order, items);
      } else {
        await repo.updateSalesOrder(order, items);
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
  double price;
  late final TextEditingController qtyCtrl;
  late final TextEditingController priceCtrl;

  _ItemRow({
    required this.id,
    this.productId = '',
    this.productName = '',
    this.qty = 1,
    this.price = 0,
  }) {
    qtyCtrl = TextEditingController(text: qty > 0 ? '$qty' : '');
    priceCtrl =
        TextEditingController(text: price > 0 ? price.toStringAsFixed(2) : '');
  }

  void dispose() {
    qtyCtrl.dispose();
    priceCtrl.dispose();
  }
}
