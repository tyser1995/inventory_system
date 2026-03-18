import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../../domain/entities/supplier.dart';
import '../../domain/repositories/supplier_repository.dart';
import '../local/dao/supplier_dao.dart';
import '../local/database/app_database.dart';

class LocalSupplierRepository implements SupplierRepository {
  final LocalSupplierDao _dao;
  static const _uuid = Uuid();

  LocalSupplierRepository(this._dao);

  @override
  Future<List<Supplier>> getSuppliers() => _dao.getAll();

  @override
  Future<Supplier?> getSupplier(String id) => _dao.getById(id);

  @override
  Future<void> createSupplier(Supplier supplier) => _dao.upsert(
        SuppliersTableCompanion.insert(
          id: supplier.id.isEmpty ? _uuid.v4() : supplier.id,
          name: supplier.name,
          contactName: Value(supplier.contactName),
          email: Value(supplier.email),
          phone: Value(supplier.phone),
          address: Value(supplier.address),
          notes: Value(supplier.notes),
          createdAt: supplier.createdAt,
        ),
      );

  @override
  Future<void> updateSupplier(Supplier supplier) => _dao.upsert(
        SuppliersTableCompanion.insert(
          id: supplier.id,
          name: supplier.name,
          contactName: Value(supplier.contactName),
          email: Value(supplier.email),
          phone: Value(supplier.phone),
          address: Value(supplier.address),
          notes: Value(supplier.notes),
          createdAt: supplier.createdAt,
        ),
      );

  @override
  Future<void> deleteSupplier(String id) => _dao.delete(id);
}
