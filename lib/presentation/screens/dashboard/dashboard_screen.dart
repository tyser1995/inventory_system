import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
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
    final today = DateFormat('EEEE, MMMM d').format(DateTime.now());

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Dashboard'),
            Text(
              today,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w400,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
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
                // ── Hero banner ──────────────────────────────────────────────
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, Color(0xFF6366F1)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.inventory_2, color: Colors.white, size: 28),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome back, ${user?.username ?? 'User'}',
                              style: GoogleFonts.inter(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Here\'s your inventory overview.',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Overview label ───────────────────────────────────────────
                _SectionTitle('Overview'),
                const SizedBox(height: 12),

                // ── KPI grid ─────────────────────────────────────────────────
                LayoutBuilder(builder: (context, constraints) {
                  final twoCol = constraints.maxWidth >= 480;
                  if (twoCol) {
                    return Row(
                      children: [
                        Expanded(
                          child: KpiCard(
                            title: 'Total Products',
                            value: '${data.totalProducts}',
                            icon: Icons.inventory_2_outlined,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: KpiCard(
                            title: 'Low Stock Items',
                            value: '${data.lowStockCount}',
                            icon: Icons.warning_amber_outlined,
                            iconColor: AppColors.warning,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: KpiCard(
                            title: 'Stock Value',
                            value: currency.format(data.totalStockValue),
                            icon: Icons.attach_money_outlined,
                            iconColor: AppColors.success,
                          ),
                        ),
                      ],
                    );
                  }
                  return Column(
                    children: [
                      KpiCard(
                        title: 'Total Products',
                        value: '${data.totalProducts}',
                        icon: Icons.inventory_2_outlined,
                      ),
                      const SizedBox(height: 12),
                      KpiCard(
                        title: 'Low Stock Items',
                        value: '${data.lowStockCount}',
                        icon: Icons.warning_amber_outlined,
                        iconColor: AppColors.warning,
                      ),
                      const SizedBox(height: 12),
                      KpiCard(
                        title: 'Stock Value',
                        value: currency.format(data.totalStockValue),
                        icon: Icons.attach_money_outlined,
                        iconColor: AppColors.success,
                      ),
                    ],
                  );
                }),
                const SizedBox(height: 20),

                // ── Quick links ───────────────────────────────────────────────
                _SectionTitle('Quick Access'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _QuickLink(icon: Icons.add_box_outlined, label: 'Add Product', color: AppColors.primary, onTap: () => context.go('/products/new'))),
                    const SizedBox(width: 10),
                    Expanded(child: _QuickLink(icon: Icons.swap_horiz_outlined, label: 'New Transaction', color: AppColors.info, onTap: () => context.go('/transactions/new'))),
                    const SizedBox(width: 10),
                    Expanded(child: _QuickLink(icon: Icons.receipt_long_outlined, label: 'Purchase Order', color: AppColors.success, onTap: () => context.go('/purchase-orders/new'))),
                    const SizedBox(width: 10),
                    Expanded(child: _QuickLink(icon: Icons.bar_chart_outlined, label: 'Reports', color: AppColors.warning, onTap: () => context.go('/reports'))),
                  ],
                ),

                // ── Low stock alerts ──────────────────────────────────────────
                if (data.lowStockProducts.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _SectionTitle('Low Stock Alerts'),
                  const SizedBox(height: 12),
                  Card(
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: data.lowStockProducts.length,
                      separatorBuilder: (context, index) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final p = data.lowStockProducts[i];
                        return InkWell(
                          borderRadius: i == 0
                              ? const BorderRadius.vertical(top: Radius.circular(12))
                              : i == data.lowStockProducts.length - 1
                                  ? const BorderRadius.vertical(bottom: Radius.circular(12))
                                  : BorderRadius.zero,
                          onTap: () => context.go('/products'),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: AppColors.warning.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.warning_amber, color: AppColors.warning, size: 18),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        p.name,
                                        style: GoogleFonts.inter(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        p.categoryName ?? '—',
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppColors.warning.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: AppColors.warning.withValues(alpha: 0.4),
                                    ),
                                  ),
                                  child: Text(
                                    'Qty: ${p.quantity}',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.warning,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],

                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Local components ─────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickLink({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
