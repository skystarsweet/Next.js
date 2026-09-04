import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'filter_service.dart';
import 'models.dart';

/// UI-facing state holder. Every action goes through the native channel and
/// the returned [FilterState] replaces the current one wholesale.
class FilterController extends ChangeNotifier {
  FilterController({FilterService? service})
    : _service = service ?? FilterService() {
    _subscription = _service.changes.listen(_replace);
  }

  final FilterService _service;
  late final StreamSubscription<FilterState> _subscription;

  FilterState _state = const FilterState();
  bool _busy = false;
  String? _lastError;

  FilterState get state => _state;
  bool get isBusy => _busy;

  /// Last user-facing error. Cleared by [clearError].
  String? get lastError => _lastError;

  Future<void> refresh() => _run(_service.getState);

  Future<void> setFilterEnabled(bool enabled) =>
      _run(() => _service.setFilterEnabled(enabled));

  Future<void> addRule(String bundleIdentifier, {String displayName = ''}) =>
      _run(
        () => _service.addRule(
          bundleIdentifier: bundleIdentifier,
          displayName: displayName,
        ),
      );

  Future<void> setBlocked(AppRule rule, bool blocked) =>
      _run(() => _service.setBlocked(rule.bundleIdentifier, blocked));

  Future<void> remove(AppRule rule) =>
      _run(() => _service.removeRule(rule.bundleIdentifier));

  Future<void> setAllBlocked(bool blocked) =>
      _run(() => _service.setAllBlocked(blocked));

  Future<void> clearSeen() => _run(_service.clearSeen);

  void clearError() {
    if (_lastError == null) return;
    _lastError = null;
    notifyListeners();
  }

  Future<void> _run(Future<FilterState> Function() action) async {
    _busy = true;
    notifyListeners();
    try {
      _replace(await action());
      if (_state.status == FilterStatus.failed && _state.errorMessage != null) {
        _lastError = _state.errorMessage;
      }
    } on PlatformException catch (error) {
      _lastError = error.message ?? error.code;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  void _replace(FilterState next) {
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription.cancel();
    _service.dispose();
    super.dispose();
  }
}
