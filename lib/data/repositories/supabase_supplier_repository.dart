import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/supplier.dart';
import '../../domain/repositories/supplier_repository.dart';

class SupabaseSupplierRepository implements SupplierRepository {
  final SupabaseClient _client;

  SupabaseSupplierRepository(this._client);

  Supplier _map(Map<String, dynamic> r) => Supplier(
        id: r['id'] as String,
        name: r['name'] as String,
        contactName: r['contact_name'] as String?,
        email: r['email'] as String?,
        phone: r['phone'] as String?,
        address: r['address'] as String?,
        notes: r['notes'] as String?,
        createdAt: DateTime.parse(r['created_at'] as String),
      );

  @override
  Future<List<Supplier>> getSuppliers() async {
    final rows = await _client.from('suppliers').select().order('name');
    return (rows as List).map((r) => _map(r as Map<String, dynamic>)).toList();
  }

  @override
  Future<Supplier?> getSupplier(String id) async {
    final row = await _client.from('suppliers').select().eq('id', id).maybeSingle();
    return row == null ? null : _map(row);
  }

  @override
  Future<void> createSupplier(Supplier supplier) async {
    await _client.from('suppliers').insert({
      'name': supplier.name,
      'contact_name': supplier.contactName,
      'email': supplier.email,
      'phone': supplier.phone,
      'address': supplier.address,
      'notes': supplier.notes,
      'created_at': supplier.createdAt.toIso8601String(),
    });
  }

  @override
  Future<void> updateSupplier(Supplier supplier) async {
    await _client.from('suppliers').update({
      'name': supplier.name,
      'contact_name': supplier.contactName,
      'email': supplier.email,
      'phone': supplier.phone,
      'address': supplier.address,
      'notes': supplier.notes,
    }).eq('id', supplier.id);
  }

  @override
  Future<void> deleteSupplier(String id) async {
    await _client.from('suppliers').delete().eq('id', id);
  }
}
