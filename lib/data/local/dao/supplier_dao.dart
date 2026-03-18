import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/supplier.dart';

extension SupplierMapper on SuppliersTableData {
  Supplier toEntity() => Supplier(
        id: id,
        name: name,
        contactName: contactName,
        email: email,
        phone: phone,
        address: address,
        notes: notes,
        createdAt: createdAt,
      );
}

class LocalSupplierDao {
  final AppDatabase _db;
  LocalSupplierDao(this._db);

  Future<List<Supplier>> getAll() async {
    final rows = await (_db.select(_db.suppliersTable)
          ..orderBy([(t) => OrderingTerm.asc(t.name)]))
        .get();
    return rows.map((r) => r.toEntity()).toList();
  }

  Future<Supplier?> getById(String id) async {
    final row = await (_db.select(_db.suppliersTable)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();
    return row?.toEntity();
  }

  Future<void> upsert(SuppliersTableCompanion companion) async {
    await _db.into(_db.suppliersTable).insertOnConflictUpdate(companion);
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.suppliersTable)..where((t) => t.id.equals(id))).go();
  }
}
