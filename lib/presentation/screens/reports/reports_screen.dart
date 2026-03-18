import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/report_data.dart';
import '../../providers/report_provider.dart';

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportAsync = ref.watch(reportProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports & Analytics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(reportProvider),
          ),
        ],
      ),
      body: reportAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (data) => _ReportBody(data: data),
      ),
    );
  }
}

class _ReportBody extends StatelessWidget {
  final ReportData data;
  const _ReportBody({required this.data});

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(symbol: '\$');
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── KPI row ──────────────────────────────────────────────────────
          LayoutBuilder(builder: (ctx, bc) {
            final cols = bc.maxWidth >= 800 ? 3 : bc.maxWidth >= 500 ? 2 : 1;
            final w = (bc.maxWidth - (cols - 1) * 12) / cols;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _KpiTile(
                  width: w,
                  icon: Icons.swap_horiz,
                  label: 'Total Transactions',
                  value: '${data.totalTransactions}',
                  color: Colors.blue,
                ),
                _KpiTile(
                  width: w,
                  icon: Icons.monetization_on,
                  label: 'Total Revenue',
                  value: currency.format(data.totalRevenue),
                  color: Colors.green,
                ),
                _KpiTile(
                  width: w,
                  icon: Icons.receipt_long,
                  label: 'Open Purchase Orders',
                  value: '${data.openPurchaseOrders}',
                  color: Colors.orange,
                ),
              ],
            );
          }),
          const SizedBox(height: 24),

          // ── Transaction trend ─────────────────────────────────────────────
          _Section(
            title: 'Transaction Trend (Last 30 Days)',
            child: SizedBox(
              height: 220,
              child: data.transactionTrend.isEmpty
                  ? const Center(child: Text('No transaction data yet'))
                  : _TrendChart(points: data.transactionTrend),
            ),
          ),
          const SizedBox(height: 16),

          // ── Stock by category ─────────────────────────────────────────────
          _Section(
            title: 'Stock Value by Category',
            child: SizedBox(
              height: 220,
              child: data.stockByCategory.isEmpty
                  ? const Center(child: Text('No products yet'))
                  : _CategoryBarChart(summaries: data.stockByCategory),
            ),
          ),
          const SizedBox(height: 16),

          // ── Sales by channel ──────────────────────────────────────────────
          if (data.salesByChannel.isNotEmpty) ...[
            _Section(
              title: 'Sales by Channel',
              child: SizedBox(
                height: 200,
                child: _ChannelPieChart(summaries: data.salesByChannel),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── Volume forecast ───────────────────────────────────────────────
          _Section(
            title: 'Volume Forecast',
            child: _ForecastTable(items: data.forecast),
          ),
        ],
      ),
    );
  }
}

// ── Transaction trend line chart ──────────────────────────────────────────────

class _TrendChart extends StatelessWidget {
  final List<TransactionTrendPoint> points;
  const _TrendChart({required this.points});

  @override
  Widget build(BuildContext context) {
    final inSpots = <FlSpot>[];
    final outSpots = <FlSpot>[];
    for (var i = 0; i < points.length; i++) {
      inSpots.add(FlSpot(i.toDouble(), points[i].stockIn.toDouble()));
      outSpots.add(FlSpot(i.toDouble(), points[i].stockOut.toDouble()));
    }

    return LineChart(
      LineChartData(
        gridData: const FlGridData(show: true),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true, reservedSize: 36),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 24,
              interval: (points.length / 5).ceilToDouble().clamp(1, 999),
              getTitlesWidget: (v, _) {
                final idx = v.toInt();
                if (idx < 0 || idx >= points.length) return const SizedBox();
                final d = points[idx].date;
                return Text('${d.month}/${d.day}',
                    style: const TextStyle(fontSize: 10));
              },
            ),
          ),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: true),
        lineBarsData: [
          LineChartBarData(
            spots: inSpots,
            isCurved: true,
            color: Colors.green,
            dotData: const FlDotData(show: false),
            barWidth: 2,
          ),
          LineChartBarData(
            spots: outSpots,
            isCurved: true,
            color: Colors.red,
            dotData: const FlDotData(show: false),
            barWidth: 2,
          ),
        ],
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (spots) => spots
                .map((s) => LineTooltipItem(
                      '${s.barIndex == 0 ? "In" : "Out"}: ${s.y.toInt()}',
                      TextStyle(
                          color: s.barIndex == 0 ? Colors.green : Colors.red),
                    ))
                .toList(),
          ),
        ),
      ),
    );
  }
}

// ── Stock by category bar chart ───────────────────────────────────────────────

class _CategoryBarChart extends StatelessWidget {
  final List<CategoryStockSummary> summaries;
  const _CategoryBarChart({required this.summaries});

  @override
  Widget build(BuildContext context) {
    final top = summaries.take(6).toList();
    const palette = [
      Colors.blue,
      Colors.teal,
      Colors.orange,
      Colors.purple,
      Colors.pink,
      Colors.cyan,
    ];

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        titlesData: FlTitlesData(
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 32,
              getTitlesWidget: (v, _) {
                final idx = v.toInt();
                if (idx < 0 || idx >= top.length) return const SizedBox();
                final name = top[idx].categoryName;
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    name.length > 8 ? '${name.substring(0, 7)}…' : name,
                    style: const TextStyle(fontSize: 10),
                  ),
                );
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 48,
              getTitlesWidget: (v, _) => Text(
                '\$${(v / 1000).toStringAsFixed(0)}k',
                style: const TextStyle(fontSize: 10),
              ),
            ),
          ),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        barGroups: top.asMap().entries.map((e) {
          return BarChartGroupData(
            x: e.key,
            barRods: [
              BarChartRodData(
                toY: e.value.totalValue,
                color: palette[e.key % palette.length],
                width: 20,
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(4)),
              ),
            ],
          );
        }).toList(),
        gridData: const FlGridData(show: true),
        borderData: FlBorderData(show: false),
      ),
    );
  }
}

// ── Sales by channel pie chart ────────────────────────────────────────────────

class _ChannelPieChart extends StatefulWidget {
  final List<SalesChannelSummary> summaries;
  const _ChannelPieChart({required this.summaries});

  @override
  State<_ChannelPieChart> createState() => _ChannelPieChartState();
}

class _ChannelPieChartState extends State<_ChannelPieChart> {
  int _touched = -1;

  @override
  Widget build(BuildContext context) {
    const palette = [Colors.blue, Colors.teal, Colors.orange, Colors.purple];
    final total =
        widget.summaries.fold(0.0, (s, c) => s + c.revenue);
    final currency = NumberFormat.currency(symbol: '\$');

    return Row(
      children: [
        Expanded(
          child: PieChart(
            PieChartData(
              pieTouchData: PieTouchData(
                touchCallback: (event, response) {
                  setState(() {
                    _touched = response?.touchedSection?.touchedSectionIndex ?? -1;
                  });
                },
              ),
              sections: widget.summaries.asMap().entries.map((e) {
                final pct = total > 0 ? e.value.revenue / total * 100 : 0;
                final isTouched = e.key == _touched;
                return PieChartSectionData(
                  color: palette[e.key % palette.length],
                  value: e.value.revenue,
                  radius: isTouched ? 70 : 55,
                  title: '${pct.toStringAsFixed(0)}%',
                  titleStyle: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.bold,
                      color: Colors.white),
                );
              }).toList(),
              centerSpaceRadius: 40,
            ),
          ),
        ),
        const SizedBox(width: 16),
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: widget.summaries.asMap().entries.map((e) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: palette[e.key % palette.length],
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${e.value.channel}\n${e.value.orderCount} orders · ${currency.format(e.value.revenue)}',
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

// ── Volume forecast table ─────────────────────────────────────────────────────

class _ForecastTable extends StatelessWidget {
  final List<ForecastItem> items;
  const _ForecastTable({required this.items});

  @override
  Widget build(BuildContext context) {
    final active = items.where((i) => i.avgDailyOutflow > 0).take(15).toList();
    if (active.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('No outflow data yet to generate forecasts.'),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Product')),
          DataColumn(label: Text('In Stock')),
          DataColumn(label: Text('Avg Daily Out')),
          DataColumn(label: Text('Days to Low Stock')),
        ],
        rows: active.map((item) {
          final urgency = item.daysUntilLowStock != null
              ? (item.daysUntilLowStock! <= 7
                  ? Colors.red
                  : item.daysUntilLowStock! <= 14
                      ? Colors.orange
                      : Colors.green)
              : Colors.green;
          return DataRow(cells: [
            DataCell(Text(item.productName)),
            DataCell(Text('${item.currentQuantity}')),
            DataCell(Text(item.avgDailyOutflow.toStringAsFixed(1))),
            DataCell(
              item.daysUntilLowStock != null
                  ? Chip(
                      label: Text('${item.daysUntilLowStock} days'),
                      backgroundColor: urgency.withValues(alpha: 0.15),
                      labelStyle: TextStyle(color: urgency),
                      side: BorderSide(color: urgency),
                    )
                  : const Text('—'),
            ),
          ]);
        }).toList(),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: child)),
      ],
    );
  }
}

class _KpiTile extends StatelessWidget {
  final double width;
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _KpiTile({
    required this.width,
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.15),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: Theme.of(context).textTheme.labelSmall),
                    Text(value,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
