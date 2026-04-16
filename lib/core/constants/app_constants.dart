class AppConstants {
  static const String appName = 'Inventory System';
  static const String dbName = 'inventory.db';

  // SharedPreferences keys (non-sensitive)
  static const String keyDataSource = 'data_source';
  static const String keyThemeMode = 'theme_mode';
  static const String keyScheduledBackups = 'scheduled_backups';

  // SecureStorage keys (sensitive — never write to SharedPreferences)
  static const String keyCurrentUserId = 'current_user_id';
  static const String keySupabaseUrl = 'supabase_url';
  static const String keySupabaseAnonKey = 'supabase_anon_key';

  // Pagination
  static const List<int> rowsPerPageOptions = [10, 25, 50];
  static const int defaultRowsPerPage = 10;

  // Roles
  static const String roleSuperAdmin = 'super_admin';
  static const String roleAdmin = 'admin';
  static const String roleStaff = 'staff';
}
