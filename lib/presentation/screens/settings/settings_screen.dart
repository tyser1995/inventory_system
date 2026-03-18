import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../../core/constants/permissions.dart';
import '../../../domain/entities/app_lookup.dart';
import '../../../domain/repositories/settings_repository.dart';
import '../../providers/core_providers.dart';
import '../../providers/permission_provider.dart';
import '../../providers/settings_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(permissionProvider.notifier);
    final canSystemSettings = perms.can(AppPermission.systemSettings);
    final settingsAsync = ref.watch(settingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (settings) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ─── Theme ──────────────────────────────────────────────
            _Section(
              title: 'Appearance',
              children: [
                ListTile(
                  title: const Text('Theme'),
                  trailing: DropdownButton<String>(
                    value: settings.themeMode,
                    underline: const SizedBox.shrink(),
                    items: const [
                      DropdownMenuItem(value: 'system', child: Text('System')),
                      DropdownMenuItem(value: 'light', child: Text('Light')),
                      DropdownMenuItem(value: 'dark', child: Text('Dark')),
                    ],
                    onChanged: (v) {
                      if (v != null) {
                        ref.read(settingsProvider.notifier).saveSettings(
                              settings.copyWith(themeMode: v),
                            );
                      }
                    },
                  ),
                ),
              ],
            ),

            // ─── Data Source ────────────────────────────────────────
            _Section(
              title: 'Data Source',
              children: [
                SwitchListTile(
                  title: const Text('Use Supabase (Online Mode)'),
                  subtitle: Text(settings.dataSource == DataSource.supabase
                      ? 'Currently: Supabase'
                      : 'Currently: Local SQLite'),
                  value: settings.dataSource == DataSource.supabase,
                  onChanged: canSystemSettings
                      ? (v) {
                          ref.read(settingsProvider.notifier).saveSettings(
                                settings.copyWith(
                                  dataSource: v ? DataSource.supabase : DataSource.local,
                                ),
                              );
                        }
                      : null,
                ),
              ],
            ),

            // ─── Supabase Config ─────────────────────────────────────
            if (canSystemSettings)
              _Section(
                title: 'Supabase Configuration',
                children: [
                  _SupabaseConfigTile(settings: settings),
                ],
              ),

            // ─── Backup & Restore (super_admin only) ─────────────────
            if (canSystemSettings) ...[
              _Section(
                title: 'Backup & Restore',
                children: [
                  ListTile(
                    leading: const Icon(Icons.upload),
                    title: const Text('Export Backup (JSON)'),
                    onTap: () => _exportBackup(context, ref),
                  ),
                  ListTile(
                    leading: const Icon(Icons.download),
                    title: const Text('Import Backup (JSON)'),
                    onTap: () => _importBackup(context, ref),
                  ),
                ],
              ),

              // ─── Scheduled Backups ─────────────────────────────────
              _Section(
                title: 'Scheduled Backups',
                children: [
                  _ScheduledBackupTile(settings: settings),
                ],
              ),
            ],

            // ─── Manage Lists (visible to admin+) ───────────────────
            if (canSystemSettings)
              const _Section(
                title: 'Manage Lists',
                children: [
                  _ManageListsTile(
                    category: 'sales_channel',
                    categoryLabel: 'Sales Channels',
                  ),
                  _ManageListsTile(
                    category: 'unit_of_measure',
                    categoryLabel: 'Units of Measure',
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportBackup(BuildContext context, WidgetRef ref) async {
    try {
      final repo = ref.read(settingsRepositoryProvider);
      final data = await repo.exportBackup();
      final json = const JsonEncoder.withIndent('  ').convert(data);

      // Save to downloads / documents
      final dir = await getApplicationDocumentsDirectory();
      final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-').substring(0, 19);
      final file = File('${dir.path}/inventory_backup_$timestamp.json');
      await file.writeAsString(json);

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Backup saved to ${file.path}')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _importBackup(BuildContext context, WidgetRef ref) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['json'],
      );
      if (result == null || result.files.single.path == null) return;

      final file = File(result.files.single.path!);
      final content = await file.readAsString();
      jsonDecode(content) as Map<String, dynamic>; // validated; restore TBD

      // TODO: implement full restore via BackupService
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Import loaded — restore not yet implemented')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Import failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: Theme.of(context).colorScheme.primary)),
        ),
        Card(
          child: Column(children: children),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _SupabaseConfigTile extends ConsumerStatefulWidget {
  final AppSettings settings;
  const _SupabaseConfigTile({required this.settings});

  @override
  ConsumerState<_SupabaseConfigTile> createState() => _SupabaseConfigTileState();
}

class _SupabaseConfigTileState extends ConsumerState<_SupabaseConfigTile> {
  final _urlCtrl = TextEditingController();
  final _keyCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _urlCtrl.text = widget.settings.supabaseUrl ?? '';
    _keyCtrl.text = widget.settings.supabaseAnonKey ?? '';
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _keyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            TextFormField(
              controller: _urlCtrl,
              decoration: const InputDecoration(labelText: 'Supabase URL'),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _keyCtrl,
              decoration: const InputDecoration(labelText: 'Anon Key'),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () async {
                  if (!_formKey.currentState!.validate()) return;
                  final notifier = ref.read(settingsProvider.notifier);
                  await notifier.saveSettings(widget.settings.copyWith(
                    supabaseUrl: _urlCtrl.text.trim(),
                    supabaseAnonKey: _keyCtrl.text.trim(),
                  ));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Supabase settings saved')),
                    );
                  }
                },
                child: const Text('Save'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScheduledBackupTile extends ConsumerStatefulWidget {
  final AppSettings settings;
  const _ScheduledBackupTile({required this.settings});

  @override
  ConsumerState<_ScheduledBackupTile> createState() => _ScheduledBackupTileState();
}

class _ScheduledBackupTileState extends ConsumerState<_ScheduledBackupTile> {
  late List<String> _times;

  @override
  void initState() {
    super.initState();
    _times = List.from(widget.settings.scheduledBackupTimes);
  }

  Future<void> _addTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (picked == null) return;
    final str = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    if (!_times.contains(str)) {
      setState(() { _times.add(str); _times.sort(); });
      await _save();
    }
  }

  Future<void> _save() async {
    final notifier = ref.read(settingsProvider.notifier);
    await notifier.saveSettings(widget.settings.copyWith(scheduledBackupTimes: _times));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ..._times.map((t) => ListTile(
              leading: const Icon(Icons.schedule),
              title: Text(t),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red),
                onPressed: () async {
                  setState(() => _times.remove(t));
                  await _save();
                },
              ),
            )),
        ListTile(
          leading: const Icon(Icons.add_alarm),
          title: const Text('Add Backup Time'),
          onTap: _addTime,
        ),
      ],
    );
  }
}

// ─── Manage Lists tile ────────────────────────────────────────────────────────

class _ManageListsTile extends ConsumerWidget {
  final String category;
  final String categoryLabel;
  const _ManageListsTile(
      {required this.category, required this.categoryLabel});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lookupsAsync = ref.watch(lookupProvider(category));
    return ExpansionTile(
      leading: const Icon(Icons.list_alt),
      title: Text(categoryLabel),
      children: [
        lookupsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Error: $e'),
          ),
          data: (items) => Column(
            children: [
              ...items.map((item) => ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 24),
                    title: Text(item.label),
                    subtitle: Text(item.value,
                        style: Theme.of(context).textTheme.bodySmall),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.edit_outlined),
                          onPressed: () =>
                              _showForm(context, ref, existing: item),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline,
                              color: Colors.red),
                          onPressed: () async {
                            final ok = await showDialog<bool>(
                              context: context,
                              builder: (dlgCtx) => AlertDialog(
                                title: const Text('Delete entry'),
                                content: Text(
                                    'Remove "${item.label}" from $categoryLabel?'),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(dlgCtx, false),
                                    child: const Text('Cancel'),
                                  ),
                                  FilledButton(
                                    style: FilledButton.styleFrom(
                                        backgroundColor: Colors.red),
                                    onPressed: () =>
                                        Navigator.pop(dlgCtx, true),
                                    child: const Text('Delete'),
                                  ),
                                ],
                              ),
                            );
                            if (ok == true) {
                              await ref
                                  .read(lookupRepositoryProvider)
                                  .delete(item.id);
                              ref.invalidate(lookupProvider(category));
                            }
                          },
                        ),
                      ],
                    ),
                  )),
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 24),
                leading: const Icon(Icons.add),
                title: Text('Add to $categoryLabel'),
                onTap: () => _showForm(context, ref),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _showForm(BuildContext context, WidgetRef ref,
      {AppLookup? existing}) async {
    final labelCtrl =
        TextEditingController(text: existing?.label ?? '');
    final valueCtrl =
        TextEditingController(text: existing?.value ?? '');
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        title: Text(existing == null ? 'Add Entry' : 'Edit Entry'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: labelCtrl,
                decoration: const InputDecoration(labelText: 'Label *'),
                validator: (v) =>
                    v == null || v.isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: valueCtrl,
                decoration: const InputDecoration(
                    labelText: 'Value * (stored in DB)',
                    hintText: 'e.g. retail, kg'),
                validator: (v) =>
                    v == null || v.isEmpty ? 'Required' : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              final repo = ref.read(lookupRepositoryProvider);
              if (existing == null) {
                await repo.create(AppLookup(
                  id: const Uuid().v4(),
                  category: category,
                  label: labelCtrl.text.trim(),
                  value: valueCtrl.text.trim().toLowerCase(),
                  createdAt: DateTime.now(),
                ));
              } else {
                await repo.update(existing.copyWith(
                  label: labelCtrl.text.trim(),
                  value: valueCtrl.text.trim().toLowerCase(),
                ));
              }
              ref.invalidate(lookupProvider(category));
              if (dlgCtx.mounted) Navigator.pop(dlgCtx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );

    labelCtrl.dispose();
    valueCtrl.dispose();
  }
}
