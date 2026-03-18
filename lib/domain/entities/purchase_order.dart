enum PurchaseOrderStatus { draft, sent, received, cancelled }

class PurchaseOrderItem {
  final String id;
  final String purchaseOrderId;
  final String productId;
  final String? productName;
  final int quantity;
  final double unitCost;

  const PurchaseOrderItem({
    required this.id,
    required this.purchaseOrderId,
    required this.productId,
    this.productName,
    required this.quantity,
    required this.unitCost,
  });

  double get subtotal => quantity * unitCost;

  PurchaseOrderItem copyWith({
    String? id,
    String? purchaseOrderId,
    String? productId,
    String? productName,
    int? quantity,
    double? unitCost,
  }) {
    return PurchaseOrderItem(
      id: id ?? this.id,
      purchaseOrderId: purchaseOrderId ?? this.purchaseOrderId,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      quantity: quantity ?? this.quantity,
      unitCost: unitCost ?? this.unitCost,
    );
  }
}

class PurchaseOrder {
  final String id;
  final String supplierId;
  final String? supplierName;
  final PurchaseOrderStatus status;
  final double total;
  final String? notes;
  final List<PurchaseOrderItem> items;
  final DateTime createdAt;
  final DateTime updatedAt;

  const PurchaseOrder({
    required this.id,
    required this.supplierId,
    this.supplierName,
    required this.status,
    required this.total,
    this.notes,
    this.items = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  PurchaseOrder copyWith({
    String? id,
    String? supplierId,
    String? supplierName,
    PurchaseOrderStatus? status,
    double? total,
    String? notes,
    List<PurchaseOrderItem>? items,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return PurchaseOrder(
      id: id ?? this.id,
      supplierId: supplierId ?? this.supplierId,
      supplierName: supplierName ?? this.supplierName,
      status: status ?? this.status,
      total: total ?? this.total,
      notes: notes ?? this.notes,
      items: items ?? this.items,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
