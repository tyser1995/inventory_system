class Product {
  final String id;
  final String name;
  final String? description;
  final String categoryId;
  final String? categoryName;
  final double price;
  final int quantity;
  final int lowStockThreshold;
  final String? sku;
  final String? unit;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Product({
    required this.id,
    required this.name,
    this.description,
    required this.categoryId,
    this.categoryName,
    required this.price,
    required this.quantity,
    this.lowStockThreshold = 10,
    this.sku,
    this.unit,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isLowStock => quantity <= lowStockThreshold;

  Product copyWith({
    String? id,
    String? name,
    String? description,
    String? categoryId,
    String? categoryName,
    double? price,
    int? quantity,
    int? lowStockThreshold,
    String? sku,
    String? unit,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      categoryId: categoryId ?? this.categoryId,
      categoryName: categoryName ?? this.categoryName,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
      lowStockThreshold: lowStockThreshold ?? this.lowStockThreshold,
      sku: sku ?? this.sku,
      unit: unit ?? this.unit,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
