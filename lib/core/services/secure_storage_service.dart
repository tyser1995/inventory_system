import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';

/// A synchronously-readable cache over [FlutterSecureStorage].
///
/// Call [init] once at app startup (awaited in `main`), then inject the
/// returned instance via [ProviderScope]. All [get] calls are synchronous
/// from the pre-loaded cache; [set] and [remove] update both the cache and
/// the encrypted store.
///
/// Use [forTesting] in unit tests to provide an in-memory-only instance that
/// never touches encrypted storage.
class SecureStorageService {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  final Map<String, String?> _cache;
  final bool _isTest;

  SecureStorageService._(this._cache, {bool isTest = false})
      : _isTest = isTest;

  /// Preloads all known sensitive keys from encrypted storage and returns
  /// a ready-to-use [SecureStorageService].
  static Future<SecureStorageService> init() async {
    const keys = [
      AppConstants.keyCurrentUserId,
      AppConstants.keySupabaseUrl,
      AppConstants.keySupabaseAnonKey,
    ];
    final cache = <String, String?>{};
    for (final key in keys) {
      cache[key] = await _storage.read(key: key);
    }
    return SecureStorageService._(cache);
  }

  /// Creates an in-memory-only instance for unit tests — never writes to
  /// encrypted storage.
  factory SecureStorageService.forTesting([Map<String, String?> values = const {}]) =>
      SecureStorageService._(Map.of(values), isTest: true);

  /// Synchronously reads a value from the cache (populated at startup).
  String? get(String key) => _cache[key];

  /// Writes [value] to both the in-memory cache and encrypted storage.
  Future<void> set(String key, String value) async {
    _cache[key] = value;
    if (!_isTest) {
      await _storage.write(key: key, value: value);
    }
  }

  /// Removes [key] from both the in-memory cache and encrypted storage.
  Future<void> remove(String key) async {
    _cache.remove(key);
    if (!_isTest) {
      await _storage.delete(key: key);
    }
  }
}
