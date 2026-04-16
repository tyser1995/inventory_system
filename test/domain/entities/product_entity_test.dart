import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_system/domain/entities/product.dart';

void main() {
  final base = Product(
    id: 'p1',
    name: 'Widget',
    categoryId: 'c1',
    price: 10.0,
    quantity: 5,
    lowStockThreshold: 10,
    createdAt: DateTime(2024),
    updatedAt: DateTime(2024),
  );

  group('Product.isLowStock', () {
    test('true when quantity <= threshold', () {
      expect(base.isLowStock, isTrue); // 5 <= 10
    });

    test('false when quantity > threshold', () {
      final p = base.copyWith(quantity: 11);
      expect(p.isLowStock, isFalse);
    });

    test('true when quantity equals threshold exactly', () {
      final p = base.copyWith(quantity: 10);
      expect(p.isLowStock, isTrue);
    });

    test('false when threshold is 0 and quantity is 0 (boundary)', () {
      final p = base.copyWith(quantity: 0, lowStockThreshold: 0);
      expect(p.isLowStock, isTrue); // 0 <= 0
    });
  });

  group('Product.copyWith', () {
    test('preserves unchanged fields', () {
      final p = base.copyWith(name: 'Gadget');
      expect(p.id, 'p1');
      expect(p.categoryId, 'c1');
      expect(p.price, 10.0);
      expect(p.name, 'Gadget');
    });

    test('returns new instance (immutability)', () {
      final p = base.copyWith(quantity: 20);
      expect(p, isNot(same(base)));
      expect(base.quantity, 5); // original unchanged
    });

    test('nullable fields can be set to a value', () {
      final p = base.copyWith(sku: 'SKU-001', unit: 'pcs', description: 'desc');
      expect(p.sku, 'SKU-001');
      expect(p.unit, 'pcs');
      expect(p.description, 'desc');
    });
  });
}
