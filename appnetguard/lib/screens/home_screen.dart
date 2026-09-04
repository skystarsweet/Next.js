import 'package:flutter/material.dart';

import '../filter_controller.dart';
import '../models.dart';
import '../widgets/rule_tile.dart';
import 'add_app_sheet.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller});

  final FilterController controller;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  FilterController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller.addListener(_onControllerChanged);
    controller.refresh();
  }

  @override
  void dispose() {
    controller.removeListener(_onControllerChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) controller.refresh();
  }

  void _onControllerChanged() {
    final error = controller.lastError;
    if (error == null || !mounted) return;
    controller.clearError();
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(error)));
  }

  Future<void> _openAddSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => AddAppSheet(controller: controller),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final state = controller.state;
        return Scaffold(
          appBar: AppBar(
            title: const Text('AppNetGuard'),
            actions: [
              if (state.rules.isNotEmpty)
                PopupMenuButton<bool>(
                  tooltip: 'Bulk actions',
                  onSelected: controller.setAllBlocked,
                  itemBuilder: (_) => const [
                    PopupMenuItem(
                      value: true,
                      child: ListTile(
                        leading: Icon(Icons.wifi_off),
                        title: Text('Block all'),
                      ),
                    ),
                    PopupMenuItem(
                      value: false,
                      child: ListTile(
                        leading: Icon(Icons.wifi),
                        title: Text('Allow all'),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: _openAddSheet,
            icon: const Icon(Icons.add),
            label: const Text('Add app'),
          ),
          body: RefreshIndicator(
            onRefresh: controller.refresh,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                _FilterCard(state: state, controller: controller),
                _RulesHeader(state: state),
                if (state.rules.isEmpty)
                  const _EmptyRules()
                else
                  for (final rule in state.rules)
                    RuleTile(
                      key: ValueKey(rule.bundleIdentifier),
                      rule: rule,
                      onChanged: (blocked) =>
                          controller.setBlocked(rule, blocked),
                      onDelete: () => controller.remove(rule),
                    ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FilterCard extends StatelessWidget {
  const _FilterCard({required this.state, required this.controller});

  final FilterState state;
  final FilterController controller;

  String get _subtitle {
    switch (state.status) {
      case FilterStatus.unknown:
        return 'Checking…';
      case FilterStatus.disabled:
        return 'Off. All apps can reach the internet.';
      case FilterStatus.enabled:
        return 'On. ${state.blockedCount} app(s) cut off.';
      case FilterStatus.failed:
        return 'Not installed.';
      case FilterStatus.unsupported:
        return 'Unavailable on this device.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final enabled = state.status.isEnabled;
    final canToggle =
        !controller.isBusy &&
        state.status != FilterStatus.unsupported &&
        state.status != FilterStatus.unknown;

    return Card(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SwitchListTile(
            secondary: Icon(
              enabled ? Icons.shield : Icons.shield_outlined,
              color: enabled ? colors.primary : colors.outline,
            ),
            title: const Text('Network filter'),
            subtitle: Text(_subtitle),
            value: enabled,
            onChanged: canToggle ? controller.setFilterEnabled : null,
          ),
          if (state.status == FilterStatus.failed ||
              state.status == FilterStatus.unsupported)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    color: colors.error,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      state.errorMessage ??
                          'The content filter could not be installed.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Text(
              'While the filter is on, every connection from a blocked app is dropped. Apps you have not listed are unaffected.',
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: colors.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}

class _RulesHeader extends StatelessWidget {
  const _RulesHeader({required this.state});

  final FilterState state;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.titleSmall;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 4),
      child: Row(
        children: [
          Text('Apps', style: style),
          const Spacer(),
          if (state.rules.isNotEmpty)
            Text(
              '${state.blockedCount} of ${state.rules.length} blocked',
              style: Theme.of(context).textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

class _EmptyRules extends StatelessWidget {
  const _EmptyRules();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      child: Column(
        children: [
          Icon(Icons.apps_outlined, size: 48, color: colors.outline),
          const SizedBox(height: 12),
          Text('No apps yet', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Tap “Add app” to choose an app whose internet access you want to control.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: colors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
