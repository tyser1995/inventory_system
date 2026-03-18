import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../domain/entities/app_lookup.dart';
import '../../domain/repositories/lookup_repository.dart';
import '../local/dao/lookup_dao.dart';
import '../local/database/app_database.dart';

class LocalLookupRepository implements LookupRepository {
  final LocalLookupDao _dao;
  static const _uuid = Uuid();

  LocalLookupRepository(this._dao);

  @override
  Future<List<AppLookup>> getByCategory(String category) =>
      _dao.getByCategory(category);

  @override
  Future<AppLookup> create(AppLookup lookup) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final item = lookup.copyWith(id: id, createdAt: now);
    await _dao.upsert(AppLookupTableCompanion.insert(
      id: item.id,
      category: item.category,
      label: item.label,
      value: item.value,
      sortOrder: Value(item.sortOrder),
      isActive: Value(item.isActive),
      createdAt: item.createdAt,
    ));
    return item;
  }

  @override
  Future<AppLookup> update(AppLookup lookup) async {
    await _dao.upsert(AppLookupTableCompanion.insert(
      id: lookup.id,
      category: lookup.category,
      label: lookup.label,
      value: lookup.value,
      sortOrder: Value(lookup.sortOrder),
      isActive: Value(lookup.isActive),
      createdAt: lookup.createdAt,
    ));
    return lookup;
  }

  @override
  Future<void> delete(String id) => _dao.delete(id);
}
