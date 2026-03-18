class AppConstants {
  static const String appName = 'Inventory System';
  static const String dbName = 'inventory.db';
  static const int dbVersion = 1;

  // SharedPreferences keys
  static const String keyDataSource = 'data_source';
  static const String keyThemeMode = 'theme_mode';
  static const String keySupabaseUrl = 'supabase_url';
  static const String keySupabaseAnonKey = 'supabase_anon_key';
  static const String keyScheduledBackups = 'scheduled_backups';
  static const String keyCurrentUserId = 'current_user_id';
  static const String keyCurrentUserRole = 'current_user_role';

  // Pagination
  static const List<int> rowsPerPageOptions = [10, 25, 50];
  static const int defaultRowsPerPage = 10;

  // Roles
  static const String roleSuperAdmin = 'super_admin';
  static const String roleAdmin = 'admin';
  static const String roleStaff = 'staff';
}
