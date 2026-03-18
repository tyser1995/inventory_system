class Warehouse {
  final String id;
  final String name;
  final String? address;
  final String? notes;
  final bool isDefault;
  final DateTime createdAt;

  const Warehouse({
    required this.id,
    required this.name,
    this.address,
    this.notes,
    this.isDefault = false,
    required this.createdAt,
  });

  Warehouse copyWith({
    String? id,
    String? name,
    String? address,
    String? notes,
    bool? isDefault,
    DateTime? createdAt,
  }) {
    return Warehouse(
      id: id ?? this.id,
      name: name ?? this.name,
      address: address ?? this.address,
      notes: notes ?? this.notes,
      isDefault: isDefault ?? this.isDefault,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class WarehouseStock {
  final String productId;
  final String productName;
  final String? sku;
  final String warehouseId;
  final String warehouseName;
  final int quantity;

  const WarehouseStock({
    required this.productId,
    required this.productName,
    this.sku,
    required this.warehouseId,
    required this.warehouseName,
    required this.quantity,
  });
}
