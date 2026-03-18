enum SalesOrderStatus { pending, processing, completed, cancelled }

enum SalesChannel { retail, online, wholesale, other }

extension SalesChannelLabel on SalesChannel {
  String get label {
    switch (this) {
      case SalesChannel.retail:
        return 'Retail';
      case SalesChannel.online:
        return 'Online';
      case SalesChannel.wholesale:
        return 'Wholesale';
      case SalesChannel.other:
        return 'Other';
    }
  }

  static SalesChannel fromString(String v) {
    return SalesChannel.values.firstWhere(
      (e) => e.name == v,
      orElse: () => SalesChannel.other,
    );
  }
}

extension SalesOrderStatusLabel on SalesOrderStatus {
  String get label {
    switch (this) {
      case SalesOrderStatus.pending:
        return 'Pending';
      case SalesOrderStatus.processing:
        return 'Processing';
      case SalesOrderStatus.completed:
        return 'Completed';
      case SalesOrderStatus.cancelled:
        return 'Cancelled';
    }
  }

  static SalesOrderStatus fromString(String v) {
    return SalesOrderStatus.values.firstWhere(
      (e) => e.name == v,
      orElse: () => SalesOrderStatus.pending,
    );
  }
}

class SalesOrderItem {
  final String id;
  final String salesOrderId;
  final String productId;
  final String? productName;
  final int quantity;
  final double unitPrice;

  const SalesOrderItem({
    required this.id,
    required this.salesOrderId,
    required this.productId,
    this.productName,
    required this.quantity,
    required this.unitPrice,
  });

  double get subtotal => quantity * unitPrice;

  SalesOrderItem copyWith({
    String? id,
    String? salesOrderId,
    String? productId,
    String? productName,
    int? quantity,
    double? unitPrice,
  }) {
    return SalesOrderItem(
      id: id ?? this.id,
      salesOrderId: salesOrderId ?? this.salesOrderId,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
    );
  }
}

class SalesOrder {
  final String id;
  final String? customerName;
  final String channel; // dynamic value from AppLookupTable (sales_channel)
  final SalesOrderStatus status;
  final double total;
  final String? notes;
  final List<SalesOrderItem> items;
  final DateTime createdAt;
  final DateTime updatedAt;

  const SalesOrder({
    required this.id,
    this.customerName,
    required this.channel,
    required this.status,
    required this.total,
    this.notes,
    this.items = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  SalesOrder copyWith({
    String? id,
    String? customerName,
    String? channel,
    SalesOrderStatus? status,
    double? total,
    String? notes,
    List<SalesOrderItem>? items,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return SalesOrder(
      id: id ?? this.id,
      customerName: customerName ?? this.customerName,
      channel: channel ?? this.channel,
      status: status ?? this.status,
      total: total ?? this.total,
      notes: notes ?? this.notes,
      items: items ?? this.items,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
