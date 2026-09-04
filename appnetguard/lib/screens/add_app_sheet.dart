import 'package:flutter/material.dart';

import '../app_catalog.dart';
import '../filter_controller.dart';
import '../models.dart';

/// Bottom sheet for adding an app: by preset, by an identifier the filter has
/// already observed, or by typing a bundle identifier.
class AddAppSheet extends StatefulWidget {
  const AddAppSheet({super.key, required this.controller});

  final FilterController controller;

  @override
  State<AddAppSheet> createState() => _AddAppSheetState();
}

class _AddAppSheetState extends State<AddAppSheet> {
  final _name = TextEditingController();
  final _identifier = TextEditingController();
  final _search = TextEditingController();

  FilterController get controller => widget.controller;

  @override
  void dispose() {
    _name.dispose();
    _identifier.dispose();
    _search.dispose();
    super.dispose();
  }

  bool get _canSave => AppRule.isValidIdentifier(_identifier.text);

  List<CatalogEntry> get _filteredCatalog {
    final query = _search.text.trim().toLowerCase();
    if (query.isEmpty) return appCatalog;
    return appCatalog
        .where(
          (entry) =>
              entry.displayName.toLowerCase().contains(query) ||
              entry.bundleIdentifier.toLowerCase().contains(query),
        )
        .toList();
  }

  List<String> get _filteredSeen {
    final query = _search.text.trim().toLowerCase();
    final state = controller.state;
    return state.seenIdentifiers
        .where((id) => !state.hasRule(id))
        .where((id) => query.isEmpty || id.toLowerCase().contains(query))
        .toList();
  }

  Widget? _catalogSubtitle(String bundleIdentifier) {
    final name = catalogNameFor(bundleIdentifier);
    return name == null ? null : Text(name);
  }

  Future<void> _add(String identifier, String name) async {
    await controller.addRule(identifier, displayName: name);
    if (!mounted) return;
    if (controller.lastError == null) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final seen = _filteredSeen;
        final catalog = _filteredCatalog;
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.9,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                  child: Row(
                    children: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Cancel'),
                      ),
                      Expanded(
                        child: Text(
                          'Add app',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.titleMedium,
                        ),
                      ),
                      FilledButton(
                        onPressed: _canSave && !controller.isBusy
                            ? () => _add(_identifier.text, _name.text)
                            : null,
                        child: const Text('Add'),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Search apps or identifiers',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.only(bottom: 24),
                    children: [
                      const _SectionLabel('Manual'),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            TextField(
                              controller: _name,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(
                                labelText: 'Name (optional)',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _identifier,
                              onChanged: (_) => setState(() {}),
                              autocorrect: false,
                              keyboardType: TextInputType.url,
                              textCapitalization: TextCapitalization.none,
                              style: const TextStyle(fontFamily: 'monospace'),
                              decoration: const InputDecoration(
                                labelText: 'Bundle identifier',
                                hintText: 'com.example.app',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'The bundle identifier is the app’s code-signing ID. Once the filter has been on for a while, apps that made connections appear under “Recently seen”.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (seen.isNotEmpty) ...[
                        _SectionLabel(
                          'Recently seen',
                          trailing: TextButton(
                            onPressed: controller.clearSeen,
                            child: const Text('Clear'),
                          ),
                        ),
                        for (final id in seen)
                          ListTile(
                            leading: const Icon(Icons.history),
                            title: Text(
                              id,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontFamily: 'monospace'),
                            ),
                            subtitle: _catalogSubtitle(id),
                            onTap: () => _add(id, catalogNameFor(id) ?? ''),
                          ),
                      ],
                      const _SectionLabel('Popular apps'),
                      for (final entry in catalog)
                        _CatalogTile(
                          entry: entry,
                          alreadyAdded: controller.state.hasRule(
                            entry.bundleIdentifier,
                          ),
                          onTap: () =>
                              _add(entry.bundleIdentifier, entry.displayName),
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text, {this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 8, 4),
      child: Row(
        children: [
          Text(text, style: Theme.of(context).textTheme.titleSmall),
          const Spacer(),
          ?trailing,
        ],
      ),
    );
  }
}

class _CatalogTile extends StatelessWidget {
  const _CatalogTile({
    required this.entry,
    required this.alreadyAdded,
    required this.onTap,
  });

  final CatalogEntry entry;
  final bool alreadyAdded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      enabled: !alreadyAdded,
      title: Text(entry.displayName),
      subtitle: Text(
        entry.bundleIdentifier,
        style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
      ),
      trailing: alreadyAdded ? const Icon(Icons.check) : null,
      onTap: alreadyAdded ? null : onTap,
    );
  }
}
