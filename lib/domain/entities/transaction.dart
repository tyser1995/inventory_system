enum TransactionType { stockIn, stockOut }

class InventoryTransaction {
  final String id;
  final String productId;
  final String? productName;
  final TransactionType type;
  final int quantity;
  final String? notes;
  final String userId;
  final String? userName;
  final DateTime createdAt;

  const InventoryTransaction({
    required this.id,
    required this.productId,
    this.productName,
    required this.type,
    required this.quantity,
    this.notes,
    required this.userId,
    this.userName,
    required this.createdAt,
  });

  InventoryTransaction copyWith({
    String? id,
    String? productId,
    String? productName,
    TransactionType? type,
    int? quantity,
    String? notes,
    String? userId,
    String? userName,
    DateTime? createdAt,
  }) {
    return InventoryTransaction(
      id: id ?? this.id,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      type: type ?? this.type,
      quantity: quantity ?? this.quantity,
      notes: notes ?? this.notes,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
