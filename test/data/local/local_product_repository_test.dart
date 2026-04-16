import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_system/data/local/dao/category_dao.dart';
import 'package:inventory_system/data/local/dao/product_dao.dart';
import 'package:inventory_system/data/local/database/app_database.dart';
import 'package:inventory_system/data/repositories/local_product_repository.dart';
import 'package:inventory_system/domain/entities/category.dart';
import 'package:inventory_system/domain/entities/product.dart';

late AppDatabase _db;
late LocalProductRepository _repo;
late LocalCategoryRepository _catRepo;

Product makeProduct({
  String name = 'Widget',
  int quantity = 50,
  int lowStockThreshold = 10,
  double price = 9.99,
}) =>
    Product(
      id: '',
      name: name,
      categoryId: '',
      price: price,
      quantity: quantity,
      lowStockThreshold: lowStockThreshold,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

void main() {
  setUp(() async {
    _db = AppDatabase.forTesting(NativeDatabase.memory());
    _repo = LocalProductRepository(LocalProductDao(_db));
    _catRepo = LocalCategoryRepository(LocalCategoryDao(_db));
  });

  tearDown(() => _db.close());

  Future<Category> insertCat({String name = 'Electronics'}) =>
      _catRepo.createCategory(
        Category(id: '', name: name, createdAt: DateTime.now()),
      );

  group('createProduct', () {
    test('assigns id and timestamps', () async {
      final cat = await insertCat();
      final p = await _repo.createProduct(makeProduct().copyWith(categoryId: cat.id));
      expect(p.id, isNotEmpty);
      expect(p.categoryId, cat.id);
    });

    test('getProductById returns created product', () async {
      final cat = await insertCat();
      final created = await _repo.createProduct(makeProduct().copyWith(categoryId: cat.id));
      final fetched = await _repo.getProductById(created.id);
      expect(fetched?.name, 'Widget');
      expect(fetched?.price, 9.99);
    });

    test('returns null for unknown id', () async {
      final p = await _repo.getProductById('nonexistent');
      expect(p, isNull);
    });
  });

  group('updateProduct', () {
    test('changes name and updates updatedAt', () async {
      final cat = await insertCat();
      final created = await _repo.createProduct(makeProduct().copyWith(categoryId: cat.id));
      final original = created.updatedAt;

      await Future.delayed(const Duration(milliseconds: 2));
      final updated = await _repo.updateProduct(created.copyWith(name: 'Gadget'));

      expect(updated.name, 'Gadget');
      expect(updated.updatedAt.isAfter(original), isTrue);
    });
  });

  group('deleteProduct', () {
    test('removes product', () async {
      final cat = await insertCat();
      final p = await _repo.createProduct(makeProduct().copyWith(categoryId: cat.id));
      await _repo.deleteProduct(p.id);
      expect(await _repo.getProductById(p.id), isNull);
    });
  });

  group('getProducts pagination', () {
    test('returns correct page and total', () async {
      final cat = await insertCat();
      for (var i = 0; i < 15; i++) {
        await _repo.createProduct(
          makeProduct(name: 'Item $i').copyWith(categoryId: cat.id),
        );
      }
      final page0 = await _repo.getProducts(page: 0, pageSize: 10);
      final page1 = await _repo.getProducts(page: 1, pageSize: 10);

      expect(page0.totalCount, 15);
      expect(page0.items.length, 10);
      expect(page1.items.length, 5);
    });

    test('search filters by name', () async {
      final cat = await insertCat();
      await _repo.createProduct(makeProduct(name: 'Apple').copyWith(categoryId: cat.id));
      await _repo.createProduct(makeProduct(name: 'Banana').copyWith(categoryId: cat.id));

      final result = await _repo.getProducts(search: 'apple');
      expect(result.items.length, 1);
      expect(result.items.first.name, 'Apple');
    });

    test('filter by category', () async {
      final cat1 = await insertCat(name: 'Cat A');
      final cat2 = await insertCat(name: 'Cat B');
      await _repo.createProduct(makeProduct().copyWith(categoryId: cat1.id));
      await _repo.createProduct(makeProduct().copyWith(categoryId: cat2.id));

      final result = await _repo.getProducts(categoryId: cat2.id);
      expect(result.items.length, 1);
      expect(result.items.first.categoryId, cat2.id);
    });
  });

  group('getLowStockProducts', () {
    test('returns products at or below threshold', () async {
      final cat = await insertCat();
      await _repo.createProduct(
        makeProduct(quantity: 5, lowStockThreshold: 10).copyWith(categoryId: cat.id),
      );
      await _repo.createProduct(
        makeProduct(quantity: 20, lowStockThreshold: 10).copyWith(categoryId: cat.id),
      );

      final low = await _repo.getLowStockProducts();
      expect(low.length, 1);
      expect(low.first.isLowStock, isTrue);
    });
  });

  group('getTotalProductCount / getTotalStockValue', () {
    test('count matches number created', () async {
      final cat = await insertCat();
      await _repo.createProduct(makeProduct().copyWith(categoryId: cat.id));
      await _repo.createProduct(makeProduct().copyWith(categoryId: cat.id));

      expect(await _repo.getTotalProductCount(), 2);
    });

    test('stock value = sum of price * quantity', () async {
      final cat = await insertCat();
      // 2 * 10.0 + 3 * 5.0 = 35
      await _repo.createProduct(
        makeProduct(quantity: 2, price: 10.0).copyWith(categoryId: cat.id),
      );
      await _repo.createProduct(
        makeProduct(quantity: 3, price: 5.0).copyWith(categoryId: cat.id),
      );

      expect(await _repo.getTotalStockValue(), 35);
    });
  });
}
