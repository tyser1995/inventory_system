class AppLookup {
  final String id;
  final String category;
  final String label;
  final String value;
  final int sortOrder;
  final bool isActive;
  final DateTime createdAt;

  const AppLookup({
    required this.id,
    required this.category,
    required this.label,
    required this.value,
    this.sortOrder = 0,
    this.isActive = true,
    required this.createdAt,
  });

  AppLookup copyWith({
    String? id,
    String? category,
    String? label,
    String? value,
    int? sortOrder,
    bool? isActive,
    DateTime? createdAt,
  }) {
    return AppLookup(
      id: id ?? this.id,
      category: category ?? this.category,
      label: label ?? this.label,
      value: value ?? this.value,
      sortOrder: sortOrder ?? this.sortOrder,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
