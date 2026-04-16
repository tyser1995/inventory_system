import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_system/core/services/secure_storage_service.dart';
import 'package:inventory_system/data/local/dao/user_dao.dart';
import 'package:inventory_system/data/local/database/app_database.dart';
import 'package:inventory_system/data/repositories/local_auth_repository.dart';

late AppDatabase _db;
late LocalAuthRepository _repo;

void main() {
  setUp(() async {
    _db = AppDatabase.forTesting(NativeDatabase.memory());
    _repo = LocalAuthRepository(
      LocalUserDao(_db),
      SecureStorageService.forTesting(),
    );
  });

  tearDown(() => _db.close());

  group('createUser', () {
    test('stores and returns user with hashed password', () async {
      final user = await _repo.createUser(
        username: 'alice',
        email: 'alice@test.com',
        password: 'secret',
        role: 'admin',
      );
      expect(user.username, 'alice');
      expect(user.role, 'admin');
      // Password must not be stored as plaintext.
      expect(user.passwordHash, isNot('secret'));
      // bcrypt hashes always start with $2.
      expect(user.passwordHash, startsWith(r'$2'));
    });

    test('stores custom permissions', () async {
      final user = await _repo.createUser(
        username: 'bob',
        email: 'bob@test.com',
        password: 'pw',
        role: 'staff',
        customPermissions: ['viewProducts', 'viewTransactions'],
      );
      expect(user.customPermissions,
          containsAll(['viewProducts', 'viewTransactions']));
    });
  });

  group('login', () {
    setUp(() async {
      await _repo.createUser(
        username: 'alice',
        email: 'alice@test.com',
        password: 'secret',
        role: 'admin',
      );
    });

    test('succeeds with correct username + password', () async {
      final user = await _repo.login('alice', 'secret');
      expect(user.username, 'alice');
    });

    test('succeeds with email instead of username', () async {
      final user = await _repo.login('alice@test.com', 'secret');
      expect(user.email, 'alice@test.com');
    });

    test('throws on wrong password', () async {
      expect(
        () => _repo.login('alice', 'wrong'),
        throwsA(anything),
      );
    });

    test('throws on unknown user', () async {
      expect(
        () => _repo.login('nobody', 'secret'),
        throwsA(anything),
      );
    });

    test('error message is identical for wrong user and wrong password', () async {
      Object? err1, err2;
      try {
        await _repo.login('nobody', 'secret');
      } catch (e) {
        err1 = e;
      }
      try {
        await _repo.login('alice', 'wrong');
      } catch (e) {
        err2 = e;
      }
      expect(err1.toString(), equals(err2.toString()),
          reason: 'Different errors for unknown user vs wrong password '
              'enable username enumeration');
    });

    test('persists session to secure storage', () async {
      final secure = SecureStorageService.forTesting();
      final repo = LocalAuthRepository(LocalUserDao(_db), secure);
      // Create the user using the same repo so the hash matches.
      await repo.createUser(
          username: 'carol',
          email: 'carol@test.com',
          password: 'pw',
          role: 'staff');
      await repo.login('carol', 'pw');
      expect(secure.get('current_user_id'), isNotNull);
    });

    test('logout clears session from secure storage', () async {
      final secure = SecureStorageService.forTesting();
      final repo = LocalAuthRepository(LocalUserDao(_db), secure);
      await repo.createUser(
          username: 'dave',
          email: 'dave@test.com',
          password: 'pw',
          role: 'staff');
      await repo.login('dave', 'pw');
      await repo.logout();
      expect(secure.get('current_user_id'), isNull);
    });
  });

  group('getUsers / deleteUser', () {
    test('getUsers returns all created users', () async {
      await _repo.createUser(
          username: 'a', email: 'a@t.com', password: 'pw', role: 'staff');
      await _repo.createUser(
          username: 'b', email: 'b@t.com', password: 'pw', role: 'staff');
      final all = await _repo.getUsers();
      expect(all.length, 2);
    });

    test('deleteUser removes the record', () async {
      final u = await _repo.createUser(
        username: 'c',
        email: 'c@t.com',
        password: 'pw',
        role: 'staff',
      );
      await _repo.deleteUser(u.id);
      expect(await _repo.getUsers(), isEmpty);
    });
  });

  group('updateUser', () {
    test('changes role', () async {
      final u = await _repo.createUser(
        username: 'd',
        email: 'd@t.com',
        password: 'pw',
        role: 'staff',
      );
      await _repo.updateUser(u.copyWith(role: 'admin'));
      final all = await _repo.getUsers();
      expect(all.first.role, 'admin');
    });

    test('changes password when newPassword provided', () async {
      final u = await _repo.createUser(
        username: 'e',
        email: 'e@t.com',
        password: 'oldpw',
        role: 'staff',
      );
      await _repo.updateUser(u, newPassword: 'newpw');
      // New password must work; old password must not.
      final logged = await _repo.login('e', 'newpw');
      expect(logged.username, 'e');
      expect(() => _repo.login('e', 'oldpw'), throwsA(anything));
    });
  });
}
