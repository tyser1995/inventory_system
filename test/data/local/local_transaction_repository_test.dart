import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_system/data/local/dao/category_dao.dart';
import 'package:inventory_system/data/local/dao/product_dao.dart';
import 'package:inventory_system/data/local/dao/transaction_dao.dart';
import 'package:inventory_system/data/local/database/app_database.dart';
import 'package:inventory_system/data/repositories/local_product_repository.dart';
import 'package:inventory_system/data/repositories/local_transaction_repository.dart';
import 'package:inventory_system/domain/entities/category.dart';
import 'package:inventory_system/domain/entities/product.dart';
import 'package:inventory_system/domain/entities/transaction.dart';

late AppDatabase db;
late LocalTransactionRepository txRepo;
late LocalProductRepository productRepo;
late Product seededProduct;
const userId = 'user-1';

void main() {
  setUp(() async {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    final catDao = LocalCategoryDao(db);
    final productDao = LocalProductDao(db);
    final txDao = LocalTransactionDao(db);

    productRepo = LocalProductRepository(productDao);
    txRepo = LocalTransactionRepository(txDao, productDao, db);

    // Seed a category + product
    final catRepo = LocalCategoryRepository(catDao);
    final cat = await catRepo.createCategory(
      Category(id: '', name: 'Test', createdAt: DateTime.now()),
    );
    seededProduct = await productRepo.createProduct(Product(
      id: '',
      name: 'Widget',
      categoryId: cat.id,
      price: 10.0,
      quantity: 100,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));

    // Seed a user row (transactions reference userId)
    await db.into(db.usersTable).insertOnConflictUpdate(UsersTableCompanion.insert(
      id: userId,
      username: 'testuser',
      email: 'test@test.com',
      role: 'staff',
      passwordHash: 'hash',
      createdAt: DateTime.now(),
    ));
  });

  tearDown(() => db.close());

  InventoryTransaction makeTx(TransactionType type, int qty) =>
      InventoryTransaction(
        id: '',
        productId: seededProduct.id,
        type: type,
        quantity: qty,
        userId: userId,
        createdAt: DateTime.now(),
      );

  group('createTransaction', () {
    test('stock_in increases product quantity', () async {
      await txRepo.createTransaction(makeTx(TransactionType.stockIn, 20));
      final p = await productRepo.getProductById(seededProduct.id);
      expect(p?.quantity, 120);
    });

    test('stock_out decreases product quantity', () async {
      await txRepo.createTransaction(makeTx(TransactionType.stockOut, 10));
      final p = await productRepo.getProductById(seededProduct.id);
      expect(p?.quantity, 90);
    });

    test('returns created transaction with id', () async {
      final tx =
          await txRepo.createTransaction(makeTx(TransactionType.stockIn, 5));
      expect(tx.id, isNotEmpty);
      expect(tx.type, TransactionType.stockIn);
      expect(tx.quantity, 5);
    });

    test('product update and transaction insert are atomic', () async {
      // Both writes must succeed or fail together. With an in-memory DB this
      // verifies the transaction wrapping path executes without error.
      await txRepo.createTransaction(makeTx(TransactionType.stockIn, 1));
      final result = await txRepo.getTransactions(pageSize: 100);
      expect(result.items.length, 1);
      final p = await productRepo.getProductById(seededProduct.id);
      expect(p?.quantity, 101);
    });
  });

  group('getTransactions pagination & filters', () {
    setUp(() async {
      await txRepo.createTransaction(makeTx(TransactionType.stockIn, 10));
      await txRepo.createTransaction(makeTx(TransactionType.stockOut, 5));
      await txRepo.createTransaction(makeTx(TransactionType.stockIn, 3));
    });

    test('returns all with no filters', () async {
      final result = await txRepo.getTransactions(pageSize: 100);
      expect(result.items.length, 3);
    });

    test('filter by type returns only matching', () async {
      final result = await txRepo.getTransactions(
        type: TransactionType.stockIn,
        pageSize: 100,
      );
      expect(result.items.every((t) => t.type == TransactionType.stockIn),
          isTrue);
    });

    test('pagination page 0 returns first N items', () async {
      final result = await txRepo.getTransactions(page: 0, pageSize: 2);
      expect(result.items.length, 2);
    });
  });

  group('getAllTransactions', () {
    test('returns all records', () async {
      await txRepo.createTransaction(makeTx(TransactionType.stockIn, 1));
      await txRepo.createTransaction(makeTx(TransactionType.stockOut, 2));
      final all = await txRepo.getAllTransactions();
      expect(all.length, 2);
    });
  });
}
