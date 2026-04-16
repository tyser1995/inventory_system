import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:uuid/uuid.dart';

// Platform-conditional connection factory
import 'db_connection_stub.dart'
    if (dart.library.js_interop) 'db_connection_web.dart';

part 'app_database.g.dart';

// ─── Tables ─────────────────────────────────────────────────────────────────

class UsersTable extends Table {
  TextColumn get id => text()();
  TextColumn get username => text().unique()();
  TextColumn get email => text().unique()();
  TextColumn get role => text()();
  TextColumn get passwordHash => text()();
  DateTimeColumn get createdAt => dateTime()();
  /// JSON-encoded list of AppPermission names, or null to use role defaults.
  TextColumn get customPermissions => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class CategoriesTable extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class ProductsTable extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  TextColumn get categoryId => text().references(CategoriesTable, #id)();
  RealColumn get price => real()();
  IntColumn get quantity => integer()();
  IntColumn get lowStockThreshold => integer().withDefault(const Constant(10))();
  TextColumn get sku => text().nullable()();
  TextColumn get unit => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class TransactionsTable extends Table {
  TextColumn get id => text()();
  TextColumn get productId => text().references(ProductsTable, #id)();
  TextColumn get type => text()(); // 'stock_in' | 'stock_out'
  IntColumn get quantity => integer()();
  TextColumn get notes => text().nullable()();
  TextColumn get userId => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class SettingsTable extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {key};
}

// ─── Supplier tables ─────────────────────────────────────────────────────────

class SuppliersTable extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get contactName => text().nullable()();
  TextColumn get email => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get address => text().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

// ─── Purchase order tables ────────────────────────────────────────────────────

class PurchaseOrdersTable extends Table {
  TextColumn get id => text()();
  TextColumn get supplierId => text().references(SuppliersTable, #id)();
  TextColumn get status => text()(); // draft | sent | received | cancelled
  RealColumn get total => real().withDefault(const Constant(0.0))();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class PurchaseOrderItemsTable extends Table {
  TextColumn get id => text()();
  TextColumn get purchaseOrderId =>
      text().references(PurchaseOrdersTable, #id)();
  TextColumn get productId => text().references(ProductsTable, #id)();
  IntColumn get quantity => integer()();
  RealColumn get unitCost => real()();

  @override
  Set<Column> get primaryKey => {id};
}

// ─── Warehouse tables ─────────────────────────────────────────────────────────

class WarehousesTable extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get address => text().nullable()();
  TextColumn get notes => text().nullable()();
  BoolColumn get isDefault =>
      boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class ProductWarehouseStockTable extends Table {
  TextColumn get productId => text().references(ProductsTable, #id)();
  TextColumn get warehouseId => text().references(WarehousesTable, #id)();
  IntColumn get quantity => integer().withDefault(const Constant(0))();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {productId, warehouseId};
}

// ─── Sales order tables ───────────────────────────────────────────────────────

class SalesOrdersTable extends Table {
  TextColumn get id => text()();
  TextColumn get customerName => text().nullable()();
  TextColumn get channel => text()(); // retail | online | wholesale | other
  TextColumn get status => text()(); // pending | processing | completed | cancelled
  RealColumn get total => real().withDefault(const Constant(0.0))();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class SalesOrderItemsTable extends Table {
  TextColumn get id => text()();
  TextColumn get salesOrderId =>
      text().references(SalesOrdersTable, #id)();
  TextColumn get productId => text().references(ProductsTable, #id)();
  IntColumn get quantity => integer()();
  RealColumn get unitPrice => real()();

  @override
  Set<Column> get primaryKey => {id};
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

class AppLookupTable extends Table {
  TextColumn get id => text()();
  TextColumn get category => text()(); // e.g. 'sales_channel', 'unit_of_measure'
  TextColumn get label => text()();
  TextColumn get value => text()();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

// ─── Database ────────────────────────────────────────────────────────────────

@DriftDatabase(tables: [
  UsersTable,
  CategoriesTable,
  ProductsTable,
  TransactionsTable,
  SettingsTable,
  SuppliersTable,
  PurchaseOrdersTable,
  PurchaseOrderItemsTable,
  WarehousesTable,
  ProductWarehouseStockTable,
  SalesOrdersTable,
  SalesOrderItemsTable,
  AppLookupTable,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  /// Used by the web worker (web/drift_worker.dart) — no web parameter needed there.
  AppDatabase.forWorker() : super(driftDatabase(name: 'inventory.db'));

  /// Used in unit tests — pass NativeDatabase.memory() for an in-memory SQLite instance.
  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      await m.createAll();
      await _seedDefaultLookups();
    },
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        await m.addColumn(usersTable, usersTable.customPermissions);
      }
      if (from < 3) {
        await m.createTable(suppliersTable);
        await m.createTable(purchaseOrdersTable);
        await m.createTable(purchaseOrderItemsTable);
        await m.createTable(warehousesTable);
        await m.createTable(productWarehouseStockTable);
        await m.createTable(salesOrdersTable);
        await m.createTable(salesOrderItemsTable);
      }
      if (from < 4) {
        await m.createTable(appLookupTable);
        await m.addColumn(productsTable, productsTable.unit);
        await _seedDefaultLookups();
      }
    },
  );

  Future<void> _seedDefaultLookups() async {
    // Skip if already seeded
    final existing = await (select(appLookupTable)
          ..where((t) => t.category.equals('sales_channel'))
          ..limit(1))
        .get();
    if (existing.isNotEmpty) return;

    const uuid = Uuid();
    final now = DateTime.now();

    final entries = [
      ('sales_channel', 'Retail', 'retail', 0),
      ('sales_channel', 'Online', 'online', 1),
      ('sales_channel', 'Wholesale', 'wholesale', 2),
      ('sales_channel', 'B2B', 'b2b', 3),
      ('sales_channel', 'Direct', 'direct', 4),
      ('sales_channel', 'Other', 'other', 5),
      ('unit_of_measure', 'Piece', 'pcs', 0),
      ('unit_of_measure', 'Box', 'box', 1),
      ('unit_of_measure', 'Kg', 'kg', 2),
      ('unit_of_measure', 'Liter', 'ltr', 3),
      ('unit_of_measure', 'Meter', 'mtr', 4),
      ('unit_of_measure', 'Pair', 'pair', 5),
    ];

    for (final (cat, lbl, val, order) in entries) {
      await into(appLookupTable).insertOnConflictUpdate(
        AppLookupTableCompanion.insert(
          id: uuid.v4(),
          category: cat,
          label: lbl,
          value: val,
          sortOrder: Value(order),
          createdAt: now,
        ),
      );
    }
  }

  static QueryExecutor _openConnection() {
    return openDriftConnection('inventory.db');
  }
}
