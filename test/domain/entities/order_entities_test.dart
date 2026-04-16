import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_system/domain/entities/purchase_order.dart';
import 'package:inventory_system/domain/entities/sales_order.dart';

void main() {
  group('PurchaseOrderItem', () {
    const item = PurchaseOrderItem(
      id: 'i1',
      purchaseOrderId: 'po1',
      productId: 'p1',
      quantity: 3,
      unitCost: 25.0,
    );

    test('subtotal = quantity * unitCost', () {
      expect(item.subtotal, 75.0);
    });

    test('subtotal is zero when quantity is 0', () {
      expect(item.copyWith(quantity: 0).subtotal, 0.0);
    });

    test('copyWith updates quantity, preserves other fields', () {
      final updated = item.copyWith(quantity: 10);
      expect(updated.subtotal, 250.0);
      expect(updated.productId, 'p1');
    });
  });

  group('SalesOrderItem', () {
    const item = SalesOrderItem(
      id: 'si1',
      salesOrderId: 'so1',
      productId: 'p1',
      quantity: 4,
      unitPrice: 15.5,
    );

    test('subtotal = quantity * unitPrice', () {
      expect(item.subtotal, 62.0);
    });

    test('copyWith updates unitPrice, recalculates subtotal', () {
      final updated = item.copyWith(unitPrice: 20.0);
      expect(updated.subtotal, 80.0);
    });
  });

  group('PurchaseOrderStatus enum parsing', () {
    test('all statuses are unique names', () {
      final names = PurchaseOrderStatus.values.map((s) => s.name).toSet();
      expect(names.length, PurchaseOrderStatus.values.length);
    });

    test('draft is first status', () {
      expect(PurchaseOrderStatus.values.first, PurchaseOrderStatus.draft);
    });
  });

  group('SalesOrderStatus fromString', () {
    test('parses valid status', () {
      expect(SalesOrderStatusLabel.fromString('completed'), SalesOrderStatus.completed);
      expect(SalesOrderStatusLabel.fromString('pending'), SalesOrderStatus.pending);
    });

    test('falls back to pending for unknown string', () {
      expect(SalesOrderStatusLabel.fromString('unknown'), SalesOrderStatus.pending);
    });
  });

  group('SalesChannel fromString', () {
    test('parses all known channels', () {
      for (final channel in SalesChannel.values) {
        expect(SalesChannelLabel.fromString(channel.name), channel);
      }
    });

    test('falls back to other for unknown string', () {
      expect(SalesChannelLabel.fromString('bogus'), SalesChannel.other);
    });
  });
}
