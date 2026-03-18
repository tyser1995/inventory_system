import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/sales_order.dart';
import 'core_providers.dart';

final salesOrderListProvider = FutureProvider<List<SalesOrder>>((ref) {
  return ref.watch(salesOrderRepositoryProvider).getSalesOrders();
});
