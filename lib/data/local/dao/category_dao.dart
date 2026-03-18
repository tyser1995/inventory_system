import 'package:drift/drift.dart';
import '../database/app_database.dart';
import '../../../domain/entities/category.dart';

extension CategoryMapper on CategoriesTableData {
  Category toEntity() => Category(
        id: id,
        name: name,
        description: description,
        createdAt: createdAt,
      );
}

class LocalCategoryDao {
  final AppDatabase _db;
  LocalCategoryDao(this._db);

  Future<List<Category>> getAll({String? search}) async {
    final query = _db.select(_db.categoriesTable);
    if (search != null && search.isNotEmpty) {
      query.where((t) => t.name.contains(search));
    }
    query.orderBy([(t) => OrderingTerm.asc(t.name)]);
    final rows = await query.get();
    return rows.map((r) => r.toEntity()).toList();
  }

  Future<Category?> getById(String id) async {
    final row = await (_db.select(_db.categoriesTable)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();
    return row?.toEntity();
  }

  Future<void> upsert(CategoriesTableCompanion companion) async {
    await _db.into(_db.categoriesTable).insertOnConflictUpdate(companion);
  }

  Future<void> delete(String id) async {
    await (_db.delete(_db.categoriesTable)
          ..where((t) => t.id.equals(id)))
        .go();
  }
}
