import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../providers/product_provider.dart';
import '../../widgets/common/kpi_card.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(dashboardStatsProvider);
    final user = ref.watch(authProvider).valueOrNull;
    final currency = NumberFormat.currency(symbol: '\$');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(
              avatar: const Icon(Icons.person, size: 16),
              label: Text(user?.username ?? ''),
            ),
          ),
        ],
      ),
      body: stats.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(dashboardStatsProvider.future),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Overview', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 16),

                // KPI cards in a responsive wrap
                LayoutBuilder(builder: (context, constraints) {
                  final cols = constraints.maxWidth >= 800
                      ? 4
                      : constraints.maxWidth >= 500
                          ? 2
                          : 1;
                  final cardWidth = (constraints.maxWidth - (cols - 1) * 16) / cols;
                  return Wrap(
                    spacing: 16,
                    runSpacing: 16,
                    children: [
                      SizedBox(
                        width: cardWidth,
                        child: KpiCard(
                          title: 'Total Products',
                          value: '${data.totalProducts}',
                          icon: Icons.inventory_2,
                        ),
                      ),
                      SizedBox(
                        width: cardWidth,
                        child: KpiCard(
                          title: 'Low Stock',
                          value: '${data.lowStockCount}',
                          icon: Icons.warning_amber,
                          iconColor: Colors.orange,
                        ),
                      ),
                      SizedBox(
                        width: cardWidth,
                        child: KpiCard(
                          title: 'Stock Value',
                          value: currency.format(data.totalStockValue),
                          icon: Icons.attach_money,
                          iconColor: Colors.green,
                        ),
                      ),
                    ],
                  );
                }),

                const SizedBox(height: 24),

                if (data.lowStockProducts.isNotEmpty) ...[
                  Text('Low Stock Alerts',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Card(
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: data.lowStockProducts.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final p = data.lowStockProducts[i];
                        return ListTile(
                          leading: const Icon(Icons.warning, color: Colors.orange),
                          title: Text(p.name),
                          subtitle: Text('Category: ${p.categoryName ?? "—"}'),
                          trailing: Chip(
                            label: Text('Qty: ${p.quantity}'),
                            backgroundColor: Colors.orange.shade100,
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
