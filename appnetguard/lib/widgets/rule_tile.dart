import 'package:flutter/material.dart';

import '../models.dart';

/// One row in the app list: name, bundle identifier and the block switch.
/// Swipe left to delete.
class RuleTile extends StatelessWidget {
  const RuleTile({
    super.key,
    required this.rule,
    required this.onChanged,
    required this.onDelete,
  });

  final AppRule rule;
  final ValueChanged<bool> onChanged;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Dismissible(
      key: ValueKey('dismiss-${rule.bundleIdentifier}'),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDelete(),
      background: Container(
        color: colors.error,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Icon(Icons.delete_outline, color: colors.onError),
      ),
      child: SwitchListTile(
        secondary: Icon(
          rule.isBlocked ? Icons.wifi_off : Icons.wifi,
          color: rule.isBlocked ? colors.error : colors.primary,
        ),
        title: Text(rule.displayName),
        subtitle: Text(
          rule.bundleIdentifier,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
        ),
        value: rule.isBlocked,
        activeTrackColor: colors.error,
        onChanged: onChanged,
      ),
    );
  }
}
