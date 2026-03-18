import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../domain/entities/product.dart';
import '../../providers/core_providers.dart';
import '../../providers/product_provider.dart';

class ProductFormScreen extends ConsumerStatefulWidget {
  final String? productId;
  const ProductFormScreen({super.key, this.productId});

  @override
  ConsumerState<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _skuCtrl = TextEditingController();
  final _thresholdCtrl = TextEditingController(text: '10');
  String? _selectedCategoryId;
  String? _selectedUnit;
  bool _isLoading = false;
  Product? _existing;

  bool get isEdit => widget.productId != null;

  @override
  void initState() {
    super.initState();
    if (isEdit) _loadProduct();
  }

  Future<void> _loadProduct() async {
    setState(() => _isLoading = true);
    final product = await ref
        .read(productRepositoryProvider)
        .getProductById(widget.productId!);
    if (product != null && mounted) {
      _existing = product;
      _nameCtrl.text = product.name;
      _descCtrl.text = product.description ?? '';
      _priceCtrl.text = product.price.toStringAsFixed(2);
      _qtyCtrl.text = '${product.quantity}';
      _skuCtrl.text = product.sku ?? '';
      _thresholdCtrl.text = '${product.lowStockThreshold}';
      _selectedCategoryId = product.categoryId;
      _selectedUnit = product.unit;
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    for (final c in [_nameCtrl, _descCtrl, _priceCtrl, _qtyCtrl, _skuCtrl, _thresholdCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final notifier = ref.read(productListProvider.notifier);
      final now = DateTime.now();
      final product = Product(
        id: _existing?.id ?? '',
        name: _nameCtrl.text.trim(),
        description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        categoryId: _selectedCategoryId!,
        price: double.parse(_priceCtrl.text),
        quantity: int.parse(_qtyCtrl.text),
        lowStockThreshold: int.parse(_thresholdCtrl.text),
        sku: _skuCtrl.text.trim().isEmpty ? null : _skuCtrl.text.trim(),
        unit: _selectedUnit,
        createdAt: _existing?.createdAt ?? now,
        updatedAt: now,
      );
      if (isEdit) {
        await notifier.updateProduct(product);
      } else {
        await notifier.createProduct(product);
      }
      if (mounted) context.go('/products');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoryListProvider);
    final unitsAsync = ref.watch(lookupProvider('unit_of_measure'));

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Product' : 'New Product'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _nameCtrl,
                          decoration: const InputDecoration(labelText: 'Product Name *'),
                          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _skuCtrl,
                          decoration: const InputDecoration(labelText: 'SKU'),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _descCtrl,
                          decoration: const InputDecoration(labelText: 'Description'),
                          maxLines: 3,
                        ),
                        const SizedBox(height: 16),
                        categories.when(
                          data: (cats) => DropdownButtonFormField<String>(
                            value: _selectedCategoryId,
                            decoration: const InputDecoration(labelText: 'Category *'),
                            items: cats
                                .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                                .toList(),
                            onChanged: (v) => setState(() => _selectedCategoryId = v),
                            validator: (v) => v == null ? 'Select a category' : null,
                          ),
                          loading: () => const CircularProgressIndicator(),
                          error: (_, __) => const Text('Error loading categories'),
                        ),
                        const SizedBox(height: 16),
                        unitsAsync.when(
                          data: (units) => DropdownButtonFormField<String>(
                            value: units.any((u) => u.value == _selectedUnit)
                                ? _selectedUnit
                                : null,
                            decoration: const InputDecoration(labelText: 'Unit of Measure'),
                            items: [
                              const DropdownMenuItem(value: null, child: Text('— None —')),
                              ...units.map((u) => DropdownMenuItem(
                                    value: u.value,
                                    child: Text(u.label),
                                  )),
                            ],
                            onChanged: (v) => setState(() => _selectedUnit = v),
                          ),
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => const SizedBox.shrink(),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _priceCtrl,
                                decoration: const InputDecoration(labelText: 'Price *', prefixText: '\$'),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Required';
                                  if (double.tryParse(v) == null) return 'Invalid number';
                                  return null;
                                },
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: TextFormField(
                                controller: _qtyCtrl,
                                decoration: const InputDecoration(labelText: 'Quantity *'),
                                keyboardType: TextInputType.number,
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Required';
                                  if (int.tryParse(v) == null) return 'Invalid number';
                                  return null;
                                },
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: TextFormField(
                                controller: _thresholdCtrl,
                                decoration: const InputDecoration(labelText: 'Low Stock At'),
                                keyboardType: TextInputType.number,
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Required';
                                  if (int.tryParse(v) == null) return 'Invalid number';
                                  return null;
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            OutlinedButton(
                              onPressed: () => context.go('/products'),
                              child: const Text('Cancel'),
                            ),
                            const SizedBox(width: 12),
                            FilledButton(
                              onPressed: _isLoading ? null : _submit,
                              child: Text(isEdit ? 'Update' : 'Create'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
