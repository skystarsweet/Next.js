import 'dart:async';

import 'package:flutter/services.dart';

import 'models.dart';

/// Thin wrapper over the platform channel implemented in
/// `ios/Runner/FilterChannel.swift`.
class FilterService {
  FilterService({MethodChannel? channel})
    : _channel = channel ?? const MethodChannel(channelName) {
    _channel.setMethodCallHandler(_onNativeCall);
  }

  static const String channelName = 'com.skystarsweet.appnetguard/filter';

  final MethodChannel _channel;
  final StreamController<FilterState> _changes =
      StreamController<FilterState>.broadcast();

  /// Emits whenever iOS reports that the filter configuration changed outside
  /// the app (for example from Settings or an MDM profile).
  Stream<FilterState> get changes => _changes.stream;

  Future<FilterState> getState() => _invoke('getState');

  Future<FilterState> setFilterEnabled(bool enabled) =>
      _invoke('setFilterEnabled', {'enabled': enabled});

  Future<FilterState> addRule({
    required String bundleIdentifier,
    String displayName = '',
  }) => _invoke('addRule', {
    'bundleIdentifier': bundleIdentifier,
    'displayName': displayName,
  });

  Future<FilterState> setBlocked(String bundleIdentifier, bool blocked) =>
      _invoke('setBlocked', {
        'bundleIdentifier': bundleIdentifier,
        'blocked': blocked,
      });

  Future<FilterState> removeRule(String bundleIdentifier) =>
      _invoke('removeRule', {'bundleIdentifier': bundleIdentifier});

  Future<FilterState> setAllBlocked(bool blocked) =>
      _invoke('setAllBlocked', {'blocked': blocked});

  Future<FilterState> clearSeen() => _invoke('clearSeen');

  Future<FilterState> _invoke(
    String method, [
    Map<String, Object?>? args,
  ]) async {
    try {
      final raw = await _channel.invokeMethod<Map<Object?, Object?>>(
        method,
        args,
      );
      if (raw == null) return const FilterState();
      return FilterState.fromMap(raw);
    } on MissingPluginException {
      // Running somewhere without the native side (tests, other platforms).
      return FilterState.unsupported;
    }
  }

  Future<Object?> _onNativeCall(MethodCall call) async {
    if (call.method == 'stateChanged' &&
        call.arguments is Map<Object?, Object?>) {
      _changes.add(
        FilterState.fromMap(call.arguments as Map<Object?, Object?>),
      );
    }
    return null;
  }

  void dispose() {
    _changes.close();
  }
}

/// Thrown by [FilterController] when the native side rejects a request.
class FilterException implements Exception {
  const FilterException(this.message);

  final String message;

  @override
  String toString() => message;
}
