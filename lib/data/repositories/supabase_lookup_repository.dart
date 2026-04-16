import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/app_lookup.dart';
import '../../domain/repositories/lookup_repository.dart';

class SupabaseLookupRepository implements LookupRepository {
  final SupabaseClient _client;

  SupabaseLookupRepository(this._client);

  AppLookup _map(Map<String, dynamic> r) => AppLookup(
        id: r['id'] as String,
        category: r['category'] as String,
        label: r['label'] as String,
        value: r['value'] as String,
        sortOrder: r['sort_order'] as int? ?? 0,
        isActive: r['is_active'] as bool? ?? true,
        createdAt: DateTime.parse(r['created_at'] as String),
      );

  @override
  Future<List<AppLookup>> getByCategory(String category) async {
    final rows = await _client
        .from('app_lookups')
        .select()
        .eq('category', category)
        .eq('is_active', true)
        .order('sort_order');
    return (rows as List).map((r) => _map(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<AppLookup> create(AppLookup lookup) async {
    final row = await _client.from('app_lookups').insert({
      'category': lookup.category,
      'label': lookup.label,
      'value': lookup.value,
      'sort_order': lookup.sortOrder,
      'is_active': lookup.isActive,
      'created_at': lookup.createdAt.toIso8601String(),
    }).select().single();
    return _map(row);
  }

  @override
  Future<AppLookup> update(AppLookup lookup) async {
    final row = await _client.from('app_lookups').update({
      'category': lookup.category,
      'label': lookup.label,
      'value': lookup.value,
      'sort_order': lookup.sortOrder,
      'is_active': lookup.isActive,
    }).eq('id', lookup.id).select().single();
    return _map(row);
  }

  @override
  Future<void> delete(String id) async {
    await _client.from('app_lookups').delete().eq('id', id);
  }
}
