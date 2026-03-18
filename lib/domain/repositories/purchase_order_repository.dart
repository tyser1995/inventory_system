import '../entities/purchase_order.dart';

abstract class PurchaseOrderRepository {
  Future<List<PurchaseOrder>> getPurchaseOrders();
  Future<PurchaseOrder?> getPurchaseOrder(String id);
  Future<PurchaseOrder> createPurchaseOrder(
      PurchaseOrder order, List<PurchaseOrderItem> items);
  Future<void> updatePurchaseOrder(
      PurchaseOrder order, List<PurchaseOrderItem> items);
  /// Changes status. When status → received, auto-creates stock_in transactions.
  Future<void> updateStatus(String id, PurchaseOrderStatus status,
      {String? receivedByUserId});
  Future<void> deletePurchaseOrder(String id);
  Future<int> countOpen();
}
