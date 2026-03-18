/// One bar in the "stock value by category" chart.
class CategoryStockSummary {
  final String categoryName;
  final double totalValue;
  final int productCount;

  const CategoryStockSummary({
    required this.categoryName,
    required this.totalValue,
    required this.productCount,
  });
}

/// One point in the transaction-trend line chart (per day).
class TransactionTrendPoint {
  final DateTime date;
  final int stockIn;
  final int stockOut;

  const TransactionTrendPoint({
    required this.date,
    required this.stockIn,
    required this.stockOut,
  });
}

/// Volume forecast for one product.
class ForecastItem {
  final String productId;
  final String productName;
  final int currentQuantity;
  final int lowStockThreshold;
  final double avgDailyOutflow; // units/day over last 30 days
  /// Estimated days until stock hits the low-stock threshold.
  /// null when there is no recorded outflow.
  final int? daysUntilLowStock;

  const ForecastItem({
    required this.productId,
    required this.productName,
    required this.currentQuantity,
    required this.lowStockThreshold,
    required this.avgDailyOutflow,
    this.daysUntilLowStock,
  });
}

/// Aggregated sales by channel.
class SalesChannelSummary {
  final String channel;
  final int orderCount;
  final double revenue;

  const SalesChannelSummary({
    required this.channel,
    required this.orderCount,
    required this.revenue,
  });
}

/// All analytics data surfaced to the Reports screen.
class ReportData {
  final List<CategoryStockSummary> stockByCategory;
  final List<TransactionTrendPoint> transactionTrend;
  final List<ForecastItem> forecast;
  final List<SalesChannelSummary> salesByChannel;
  final int totalTransactions;
  final double totalRevenue;
  final int openPurchaseOrders;

  const ReportData({
    required this.stockByCategory,
    required this.transactionTrend,
    required this.forecast,
    required this.salesByChannel,
    required this.totalTransactions,
    required this.totalRevenue,
    required this.openPurchaseOrders,
  });
}
