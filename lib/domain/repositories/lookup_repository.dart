import '../entities/app_lookup.dart';

abstract class LookupRepository {
  Future<List<AppLookup>> getByCategory(String category);
  Future<AppLookup> create(AppLookup lookup);
  Future<AppLookup> update(AppLookup lookup);
  Future<void> delete(String id);
}
