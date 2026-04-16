import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:inventory_system/core/services/secure_storage_service.dart';
import 'package:inventory_system/data/local/database/app_database.dart';
import 'package:inventory_system/data/repositories/local_product_repository.dart';
import 'package:inventory_system/data/repositories/supabase_product_repository.dart';
import 'package:inventory_system/presentation/providers/core_providers.dart';

// makeContainer is async because SharedPreferences.getInstance is async.
Future<ProviderContainer> makeContainer({
  Map<String, Object> prefValues = const {},
  Map<String, String?> secureValues = const {},
  AppDatabase? db,
}) async {
  SharedPreferences.setMockInitialValues(prefValues);
  final prefs = await SharedPreferences.getInstance();
  final database = db ?? AppDatabase.forTesting(NativeDatabase.memory());
  return ProviderContainer(
    overrides: [
      appDatabaseProvider.overrideWithValue(database),
      sharedPreferencesProvider.overrideWithValue(prefs),
      secureStorageProvider.overrideWithValue(
        SecureStorageService.forTesting(secureValues),
      ),
    ],
  );
}

void main() {
  group('productRepositoryProvider source switching', () {
    test('returns LocalProductRepository when data_source = local', () async {
      SharedPreferences.setMockInitialValues({'data_source': 'local'});
      final prefs = await SharedPreferences.getInstance();
      final db = AppDatabase.forTesting(NativeDatabase.memory());

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          sharedPreferencesProvider.overrideWithValue(prefs),
          secureStorageProvider.overrideWithValue(
            SecureStorageService.forTesting(),
          ),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(db.close);

      final repo = container.read(productRepositoryProvider);
      expect(repo, isA<LocalProductRepository>());
    });

    test('falls back to LocalProductRepository when supabase_url is not set',
        () async {
      SharedPreferences.setMockInitialValues({'data_source': 'supabase'});
      final prefs = await SharedPreferences.getInstance();
      final db = AppDatabase.forTesting(NativeDatabase.memory());

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          sharedPreferencesProvider.overrideWithValue(prefs),
          // No supabase credentials in secure storage → falls back to local.
          secureStorageProvider.overrideWithValue(
            SecureStorageService.forTesting(),
          ),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(db.close);

      final repo = container.read(productRepositoryProvider);
      expect(repo, isA<LocalProductRepository>());
    });

    test('returns SupabaseProductRepository when credentials are present',
        () async {
      SharedPreferences.setMockInitialValues({'data_source': 'supabase'});
      final prefs = await SharedPreferences.getInstance();
      final db = AppDatabase.forTesting(NativeDatabase.memory());

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          sharedPreferencesProvider.overrideWithValue(prefs),
          secureStorageProvider.overrideWithValue(
            SecureStorageService.forTesting({
              'supabase_url': 'https://example.supabase.co',
              'supabase_anon_key': 'anon-key-placeholder',
            }),
          ),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(db.close);

      final repo = container.read(productRepositoryProvider);
      expect(repo, isA<SupabaseProductRepository>());
    });
  });

  group('supabaseClientProvider', () {
    test('returns null when credentials are empty', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final db = AppDatabase.forTesting(NativeDatabase.memory());

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          sharedPreferencesProvider.overrideWithValue(prefs),
          secureStorageProvider.overrideWithValue(
            SecureStorageService.forTesting({
              'supabase_url': '',
              'supabase_anon_key': '',
            }),
          ),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(db.close);

      expect(container.read(supabaseClientProvider), isNull);
    });

    test('returns SupabaseClient when valid credentials present', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final db = AppDatabase.forTesting(NativeDatabase.memory());

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          sharedPreferencesProvider.overrideWithValue(prefs),
          secureStorageProvider.overrideWithValue(
            SecureStorageService.forTesting({
              'supabase_url': 'https://example.supabase.co',
              'supabase_anon_key': 'anon-key',
            }),
          ),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(db.close);

      expect(container.read(supabaseClientProvider), isNotNull);
    });
  });
}
