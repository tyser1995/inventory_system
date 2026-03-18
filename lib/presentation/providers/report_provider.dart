import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/report_data.dart';
import '../../domain/entities/transaction.dart';
import 'core_providers.dart';

final reportProvider = FutureProvider<ReportData>((ref) async {
  final productRepo = ref.watch(productRepositoryProvider);
  final txRepo = ref.watch(transactionRepositoryProvider);
  final salesRepo = ref.watch(salesOrderRepositoryProvider);
  final poRepo = ref.watch(purchaseOrderRepositoryProvider);
  final categoryRepo = ref.watch(categoryRepositoryProvider);

  // All products + categories
  final allProducts =
      await productRepo.getProducts(page: 0, pageSize: 9999);
  final allCategories = await categoryRepo.getCategories();
  final categoryMap = {for (final c in allCategories) c.id: c.name};

  // ── Stock by category ────────────────────────────────────────────────────
  final categoryAgg = <String, _CategoryAgg>{};
  for (final p in allProducts.items) {
    final catName = categoryMap[p.categoryId] ?? 'Uncategorised';
    final agg = categoryAgg.putIfAbsent(catName, () => _CategoryAgg(catName));
    agg.totalValue += p.price * p.quantity;
    agg.productCount++;
  }
  final stockByCategory = categoryAgg.values
      .map((a) => CategoryStockSummary(
            categoryName: a.name,
            totalValue: a.totalValue,
            productCount: a.productCount,
          ))
      .toList()
    ..sort((a, b) => b.totalValue.compareTo(a.totalValue));

  // ── Transaction trend (last 30 days) ────────────────────────────────────
  final now = DateTime.now();
  final thirtyDaysAgo = now.subtract(const Duration(days: 30));
  final allTx = await txRepo.getAllTransactions();
  final recentTx = allTx
      .where((t) => t.createdAt.isAfter(thirtyDaysAgo))
      .toList();

  final trendMap = <String, _TrendAgg>{};
  for (final tx in recentTx) {
    final key =
        '${tx.createdAt.year}-${tx.createdAt.month.toString().padLeft(2, '0')}-${tx.createdAt.day.toString().padLeft(2, '0')}';
    final agg = trendMap.putIfAbsent(
        key, () => _TrendAgg(DateTime(tx.createdAt.year, tx.createdAt.month, tx.createdAt.day)));
    if (tx.type == TransactionType.stockIn) {
      agg.stockIn += tx.quantity;
    } else {
      agg.stockOut += tx.quantity;
    }
  }
  final trendPoints = trendMap.values
      .map((a) => TransactionTrendPoint(
            date: a.date,
            stockIn: a.stockIn,
            stockOut: a.stockOut,
          ))
      .toList()
    ..sort((a, b) => a.date.compareTo(b.date));

  // ── Volume forecasting ───────────────────────────────────────────────────
  // Average daily outflow per product over last 30 days
  final outflowMap = <String, int>{};
  for (final tx in recentTx.where((t) => t.type == TransactionType.stockOut)) {
    outflowMap[tx.productId] = (outflowMap[tx.productId] ?? 0) + tx.quantity;
  }

  final forecast = allProducts.items.map((p) {
    final total = outflowMap[p.id] ?? 0;
    final avgDaily = total / 30.0;
    int? daysUntilLow;
    if (avgDaily > 0) {
      final buffer = p.quantity - p.lowStockThreshold;
      daysUntilLow = buffer > 0 ? (buffer / avgDaily).floor() : 0;
    }
    return ForecastItem(
      productId: p.id,
      productName: p.name,
      currentQuantity: p.quantity,
      lowStockThreshold: p.lowStockThreshold,
      avgDailyOutflow: avgDaily,
      daysUntilLowStock: daysUntilLow,
    );
  }).toList()
    ..sort((a, b) {
      // Products with active consumption and fewer days come first
      if (a.daysUntilLowStock != null && b.daysUntilLowStock != null) {
        return a.daysUntilLowStock!.compareTo(b.daysUntilLowStock!);
      }
      if (a.daysUntilLowStock != null) return -1;
      if (b.daysUntilLowStock != null) return 1;
      return a.productName.compareTo(b.productName);
    });

  // ── Sales by channel ─────────────────────────────────────────────────────
  final completedOrders = await salesRepo.getSalesOrders();
  final channelAgg = <String, _ChannelAgg>{};
  for (final o in completedOrders) {
    final key = o.channel;
    final agg = channelAgg.putIfAbsent(key, () => _ChannelAgg(key));
    agg.orderCount++;
    agg.revenue += o.total;
  }
  final salesByChannel = channelAgg.values
      .map((a) => SalesChannelSummary(
            channel: a.channel,
            orderCount: a.orderCount,
            revenue: a.revenue,
          ))
      .toList()
    ..sort((a, b) => b.revenue.compareTo(a.revenue));

  final totalRevenue = salesByChannel.fold(0.0, (s, c) => s + c.revenue);
  final openPOs = await poRepo.countOpen();

  return ReportData(
    stockByCategory: stockByCategory,
    transactionTrend: trendPoints,
    forecast: forecast,
    salesByChannel: salesByChannel,
    totalTransactions: allTx.length,
    totalRevenue: totalRevenue,
    openPurchaseOrders: openPOs,
  );
});

// ── Private aggregation helpers ───────────────────────────────────────────────

class _CategoryAgg {
  final String name;
  double totalValue = 0;
  int productCount = 0;
  _CategoryAgg(this.name);
}

class _TrendAgg {
  final DateTime date;
  int stockIn = 0;
  int stockOut = 0;
  _TrendAgg(this.date);
}

class _ChannelAgg {
  final String channel;
  int orderCount = 0;
  double revenue = 0;
  _ChannelAgg(this.channel);
}
