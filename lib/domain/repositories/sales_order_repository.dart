import '../entities/sales_order.dart';

abstract class SalesOrderRepository {
  Future<List<SalesOrder>> getSalesOrders({SalesOrderStatus? status});
  Future<SalesOrder?> getSalesOrder(String id);
  Future<SalesOrder> createSalesOrder(
      SalesOrder order, List<SalesOrderItem> items);
  Future<void> updateSalesOrder(SalesOrder order, List<SalesOrderItem> items);
  /// Changes status. When status → completed, auto-creates stock_out transactions.
  Future<void> updateStatus(String id, SalesOrderStatus status,
      {String? processedByUserId});
  Future<void> deleteSalesOrder(String id);
}
