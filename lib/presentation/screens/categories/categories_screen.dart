import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/constants/permissions.dart';
import '../../../domain/entities/category.dart';
import '../../providers/core_providers.dart';
import '../../providers/permission_provider.dart';
import '../../providers/product_provider.dart';
import '../../widgets/common/confirm_dialog.dart';
import '../../widgets/common/debounced_search_field.dart';
import '../../widgets/tables/app_table_card.dart';

class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});

  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  String? _search;

  @override
  Widget build(BuildContext context) {
    final canManage = ref.watch(permissionProvider.notifier).can(AppPermission.manageCategories);
    final categoriesAsync = ref.watch(categoryListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Categories'),
        actions: [
          if (canManage)
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Add Category'),
              onPressed: () => _showForm(context, ref, null),
            ),
          const SizedBox(width: 16),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            DebouncedSearchField(
              hint: 'Search categories...',
              onChanged: (v) => setState(() => _search = v),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: categoriesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Error: $e')),
                data: (cats) {
                  final filtered = _search != null && _search!.isNotEmpty
                      ? cats
                          .where((c) =>
                              c.name.toLowerCase().contains(_search!.toLowerCase()))
                          .toList()
                      : cats;

                  if (filtered.isEmpty) {
                    return const Center(child: Text('No categories found'));
                  }

                  return LayoutBuilder(
                    builder: (ctx, constraints) {
                      if (constraints.maxWidth < kTableMobileBreakpoint) {
                        return ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final cat = filtered[i];
                            return AppTableCard(
                              actions: canManage
                                  ? [
                                      IconButton(
                                        icon: const Icon(Icons.edit_outlined),
                                        onPressed: () => _showForm(context, ref, cat),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline,
                                            color: Colors.red),
                                        onPressed: () async {
                                          final ok = await showConfirmDialog(
                                            context,
                                            title: 'Delete Category',
                                            content: 'Delete "${cat.name}"?',
                                            confirmColor: Colors.red,
                                          );
                                          if (ok) {
                                            await ref
                                                .read(categoryRepositoryProvider)
                                                .deleteCategory(cat.id);
                                            ref.invalidate(categoryListProvider);
                                          }
                                        },
                                      ),
                                    ]
                                  : null,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    cat.name,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(fontWeight: FontWeight.w600),
                                  ),
                                  if (cat.description != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      cat.description!,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .outline),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        );
                      }

                      // Desktop: DataTable
                      final th = Theme.of(context);
                      return ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(minWidth: constraints.maxWidth),
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
                            DataColumn(label: Text('Name')),
                            DataColumn(label: Text('Description')),
                            DataColumn(label: Text('Actions')),
                          ],
                          rows: filtered
                              .map((cat) => DataRow(cells: [
                                    DataCell(Text(cat.name)),
                                    DataCell(Text(cat.description ?? '—')),
                                    DataCell(Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (canManage) ...[
                                          IconButton(
                                            icon: const Icon(Icons.edit_outlined),
                                            onPressed: () =>
                                                _showForm(context, ref, cat),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.delete_outline,
                                                color: Colors.red),
                                            onPressed: () async {
                                              final ok = await showConfirmDialog(
                                                context,
                                                title: 'Delete Category',
                                                content: 'Delete "${cat.name}"?',
                                                confirmColor: Colors.red,
                                              );
                                              if (ok) {
                                                await ref
                                                    .read(categoryRepositoryProvider)
                                                    .deleteCategory(cat.id);
                                                ref.invalidate(categoryListProvider);
                                              }
                                            },
                                          ),
                                        ],
                                      ],
                                    )),
                                  ]))
                              .toList(),
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
      ),
    );
  }

  void _showForm(BuildContext context, WidgetRef ref, Category? existing) {
    final nameCtrl = TextEditingController(text: existing?.name);
    final descCtrl = TextEditingController(text: existing?.description);
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(existing == null ? 'New Category' : 'Edit Category'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Name *'),
                validator: (v) => v == null || v.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: descCtrl,
                decoration: const InputDecoration(labelText: 'Description'),
              ),
            ],
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
              final repo = ref.read(categoryRepositoryProvider);
              final now = DateTime.now();
              final cat = Category(
                id: existing?.id ?? const Uuid().v4(),
                name: nameCtrl.text.trim(),
                description: descCtrl.text.trim().isEmpty ? null : descCtrl.text.trim(),
                createdAt: existing?.createdAt ?? now,
              );
              if (existing == null) {
                await repo.createCategory(cat);
              } else {
                await repo.updateCategory(cat);
              }
              ref.invalidate(categoryListProvider);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: Text(existing == null ? 'Create' : 'Update'),
          ),
        ],
      ),
    );
  }
}
