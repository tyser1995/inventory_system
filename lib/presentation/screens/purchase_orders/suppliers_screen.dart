import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../domain/entities/supplier.dart';
import '../../providers/core_providers.dart';
import '../../providers/purchase_order_provider.dart';
import '../../widgets/common/confirm_dialog.dart';

class SuppliersScreen extends ConsumerWidget {
  const SuppliersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliersAsync = ref.watch(supplierListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Suppliers'),
        actions: [
          FilledButton.icon(
            icon: const Icon(Icons.add),
            label: const Text('Add Supplier'),
            onPressed: () => _showForm(context, ref, null),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: suppliersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (suppliers) {
          if (suppliers.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.business_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No suppliers yet'),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: suppliers.length,
            itemBuilder: (ctx, i) {
              final s = suppliers[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.business)),
                  title: Text(s.name),
                  subtitle: Text([
                    if (s.contactName != null) s.contactName!,
                    if (s.email != null) s.email!,
                    if (s.phone != null) s.phone!,
                  ].join(' · ')),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit_outlined),
                        onPressed: () => _showForm(context, ref, s),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline,
                            color: Colors.red),
                        onPressed: () async {
                          final ok = await showConfirmDialog(
                            context,
                            title: 'Delete Supplier',
                            content: 'Delete "${s.name}"?',
                            confirmColor: Colors.red,
                          );
                          if (ok) {
                            await ref
                                .read(supplierRepositoryProvider)
                                .deleteSupplier(s.id);
                            ref.invalidate(supplierListProvider);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showForm(BuildContext context, WidgetRef ref, Supplier? existing) {
    final nameCtrl = TextEditingController(text: existing?.name);
    final contactCtrl = TextEditingController(text: existing?.contactName);
    final emailCtrl = TextEditingController(text: existing?.email);
    final phoneCtrl = TextEditingController(text: existing?.phone);
    final addressCtrl = TextEditingController(text: existing?.address);
    final notesCtrl = TextEditingController(text: existing?.notes);
    final formKey = GlobalKey<FormState>();
    const uuid = Uuid();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(existing == null ? 'New Supplier' : 'Edit Supplier'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: nameCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Company Name *'),
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: contactCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Contact Name'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: emailCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Email'),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: phoneCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Phone'),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: addressCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Address'),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: notesCtrl,
                    decoration: const InputDecoration(labelText: 'Notes'),
                    maxLines: 2,
                  ),
                ],
              ),
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
              final repo = ref.read(supplierRepositoryProvider);
              final now = DateTime.now();
              final supplier = Supplier(
                id: existing?.id ?? uuid.v4(),
                name: nameCtrl.text.trim(),
                contactName: contactCtrl.text.trim().isEmpty
                    ? null
                    : contactCtrl.text.trim(),
                email: emailCtrl.text.trim().isEmpty
                    ? null
                    : emailCtrl.text.trim(),
                phone: phoneCtrl.text.trim().isEmpty
                    ? null
                    : phoneCtrl.text.trim(),
                address: addressCtrl.text.trim().isEmpty
                    ? null
                    : addressCtrl.text.trim(),
                notes: notesCtrl.text.trim().isEmpty
                    ? null
                    : notesCtrl.text.trim(),
                createdAt: existing?.createdAt ?? now,
              );
              if (existing == null) {
                await repo.createSupplier(supplier);
              } else {
                await repo.updateSupplier(supplier);
              }
              ref.invalidate(supplierListProvider);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: Text(existing == null ? 'Create' : 'Update'),
          ),
        ],
      ),
    );
  }
}
