import 'package:flutter/material.dart';

/// Breakpoint below which tables switch to card layout.
const double kTableMobileBreakpoint = 650.0;

/// Standard card shell used for mobile row cards across all list screens.
/// Provides consistent border, padding, and action footer styling.
class AppTableCard extends StatelessWidget {
  final Widget child;
  final List<Widget>? actions;

  const AppTableCard({super.key, required this.child, this.actions});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            child,
            if (actions != null && actions!.isNotEmpty) ...[
              const Divider(height: 12, thickness: 0.5),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: actions!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Single labelled field row used inside AppTableCard.
class AppCardField extends StatelessWidget {
  final String label;
  final Widget value;
  final bool inline;

  const AppCardField({
    super.key,
    required this.label,
    required this.value,
    this.inline = true,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final labelStyle = Theme.of(context)
        .textTheme
        .labelSmall
        ?.copyWith(color: cs.outline, letterSpacing: 0.3);

    if (inline) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            SizedBox(
              width: 100,
              child: Text(label, style: labelStyle),
            ),
            Expanded(child: value),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: labelStyle),
          const SizedBox(height: 2),
          value,
        ],
      ),
    );
  }
}
