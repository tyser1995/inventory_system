import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/purchase_order.dart';
import 'core_providers.dart';

final purchaseOrderListProvider = FutureProvider<List<PurchaseOrder>>((ref) {
  return ref.watch(purchaseOrderRepositoryProvider).getPurchaseOrders();
});

final supplierListProvider = FutureProvider((ref) {
  return ref.watch(supplierRepositoryProvider).getSuppliers();
});
