import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_system/domain/entities/user.dart';

AppUser makeUser({String role = 'staff', List<String>? customPermissions}) =>
    AppUser(
      id: 'u1',
      username: 'alice',
      email: 'alice@test.com',
      role: role,
      passwordHash: 'hash',
      createdAt: DateTime(2024),
      customPermissions: customPermissions,
    );

void main() {
  group('AppUser role helpers', () {
    test('staff is not admin', () {
      final u = makeUser(role: 'staff');
      expect(u.isAdmin, isFalse);
      expect(u.isSuperAdmin, isFalse);
    });

    test('admin isAdmin but not isSuperAdmin', () {
      final u = makeUser(role: 'admin');
      expect(u.isAdmin, isTrue);
      expect(u.isSuperAdmin, isFalse);
    });

    test('super_admin satisfies both isAdmin and isSuperAdmin', () {
      final u = makeUser(role: 'super_admin');
      expect(u.isAdmin, isTrue);
      expect(u.isSuperAdmin, isTrue);
    });
  });

  group('AppUser.hasCustomPermissions', () {
    test('false when customPermissions is null', () {
      expect(makeUser().hasCustomPermissions, isFalse);
    });

    test('true when customPermissions is non-null', () {
      expect(makeUser(customPermissions: ['viewProducts']).hasCustomPermissions, isTrue);
    });

    test('true even for empty list', () {
      expect(makeUser(customPermissions: []).hasCustomPermissions, isTrue);
    });
  });

  group('AppUser.copyWith', () {
    test('clearCustomPermissions sets to null', () {
      final u = makeUser(customPermissions: ['viewProducts']);
      final cleared = u.copyWith(clearCustomPermissions: true);
      expect(cleared.customPermissions, isNull);
      expect(cleared.hasCustomPermissions, isFalse);
    });

    test('updating permissions does not affect other fields', () {
      final u = makeUser(role: 'admin');
      final updated = u.copyWith(customPermissions: ['manageProducts']);
      expect(updated.role, 'admin');
      expect(updated.customPermissions, ['manageProducts']);
    });
  });
}
