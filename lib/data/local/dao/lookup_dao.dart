import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/app_lookup.dart';

extension _LookupMapper on AppLookupTableData {
  AppLookup toEntity() => AppLookup(
        id: id,
        category: category,
        label: label,
        value: value,
        sortOrder: sortOrder,
        isActive: isActive,
        createdAt: createdAt,
      );
}

class LocalLookupDao {
  final AppDatabase _db;
  LocalLookupDao(this._db);

  Future<List<AppLookup>> getByCategory(String category) async {
    final rows = await (_db.select(_db.appLookupTable)
          ..where((t) => t.category.equals(category) & t.isActive.equals(true))
          ..orderBy([
            (t) => OrderingTerm.asc(t.sortOrder),
            (t) => OrderingTerm.asc(t.label),
          ]))
        .get();
    return rows.map((r) => r.toEntity()).toList();
  }

  Future<List<AppLookup>> getAllByCategory(String category) async {
    final rows = await (_db.select(_db.appLookupTable)
          ..where((t) => t.category.equals(category))
          ..orderBy([
            (t) => OrderingTerm.asc(t.sortOrder),
            (t) => OrderingTerm.asc(t.label),
          ]))
        .get();
    return rows.map((r) => r.toEntity()).toList();
  }

  Future<void> upsert(AppLookupTableCompanion companion) async {
    await _db.into(_db.appLookupTable).insertOnConflictUpdate(companion);
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.appLookupTable)..where((t) => t.id.equals(id))).go();
  }
}
