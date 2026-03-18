enum DataSource { local, supabase }

class AppSettings {
  final DataSource dataSource;
  final String themeMode; // 'light', 'dark', 'system'
  final String? supabaseUrl;
  final String? supabaseAnonKey;
  final List<String> scheduledBackupTimes; // e.g. ['12:00', '18:00']

  const AppSettings({
    this.dataSource = DataSource.local,
    this.themeMode = 'system',
    this.supabaseUrl,
    this.supabaseAnonKey,
    this.scheduledBackupTimes = const [],
  });

  AppSettings copyWith({
    DataSource? dataSource,
    String? themeMode,
    String? supabaseUrl,
    String? supabaseAnonKey,
    List<String>? scheduledBackupTimes,
  }) {
    return AppSettings(
      dataSource: dataSource ?? this.dataSource,
      themeMode: themeMode ?? this.themeMode,
      supabaseUrl: supabaseUrl ?? this.supabaseUrl,
      supabaseAnonKey: supabaseAnonKey ?? this.supabaseAnonKey,
      scheduledBackupTimes: scheduledBackupTimes ?? this.scheduledBackupTimes,
    );
  }
}

abstract class SettingsRepository {
  Future<AppSettings> getSettings();
  Future<void> saveSettings(AppSettings settings);
  Future<Map<String, dynamic>> exportBackup();
  Future<void> importBackup(Map<String, dynamic> data);
}
