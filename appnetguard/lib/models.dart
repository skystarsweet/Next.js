/// Data model shared between the Flutter UI and the native filter channel.
///
/// The Swift side (`ios/Shared/AppRule.swift`) is the source of truth; these
/// classes only mirror what comes over the method channel.
library;

enum FilterStatus { unknown, disabled, enabled, failed, unsupported }

extension FilterStatusX on FilterStatus {
  bool get isEnabled => this == FilterStatus.enabled;

  static FilterStatus parse(Object? raw) {
    switch (raw) {
      case 'enabled':
        return FilterStatus.enabled;
      case 'disabled':
        return FilterStatus.disabled;
      case 'failed':
        return FilterStatus.failed;
      case 'unsupported':
        return FilterStatus.unsupported;
      default:
        return FilterStatus.unknown;
    }
  }
}

class AppRule {
  const AppRule({
    required this.bundleIdentifier,
    required this.displayName,
    required this.isBlocked,
    required this.updatedAt,
  });

  final String bundleIdentifier;
  final String displayName;
  final bool isBlocked;
  final DateTime updatedAt;

  factory AppRule.fromMap(Map<Object?, Object?> map) {
    final millis = map['updatedAt'];
    return AppRule(
      bundleIdentifier: (map['bundleIdentifier'] as String?) ?? '',
      displayName: (map['displayName'] as String?) ?? '',
      isBlocked: (map['isBlocked'] as bool?) ?? false,
      updatedAt: millis is int
          ? DateTime.fromMillisecondsSinceEpoch(millis)
          : DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  Map<String, Object?> toMap() => {
    'bundleIdentifier': bundleIdentifier,
    'displayName': displayName,
    'isBlocked': isBlocked,
    'updatedAt': updatedAt.millisecondsSinceEpoch,
  };

  AppRule copyWith({bool? isBlocked}) => AppRule(
    bundleIdentifier: bundleIdentifier,
    displayName: displayName,
    isBlocked: isBlocked ?? this.isBlocked,
    updatedAt: updatedAt,
  );

  /// Mirrors `AppRule.normalize` in Swift.
  static String normalizeIdentifier(String identifier) =>
      identifier.trim().toLowerCase();

  /// Mirrors `AppRule.isValidIdentifier` in Swift.
  static bool isValidIdentifier(String identifier) {
    final value = normalizeIdentifier(identifier);
    if (value.length < 3 || !value.contains('.')) return false;
    return RegExp(r'^[a-z0-9._-]+$').hasMatch(value);
  }
}

class FilterState {
  const FilterState({
    this.status = FilterStatus.unknown,
    this.rules = const [],
    this.seenIdentifiers = const [],
    this.errorMessage,
  });

  final FilterStatus status;
  final List<AppRule> rules;
  final List<String> seenIdentifiers;
  final String? errorMessage;

  static const FilterState unsupported = FilterState(
    status: FilterStatus.unsupported,
    errorMessage:
        'The network filter is only available on a physical iOS device.',
  );

  factory FilterState.fromMap(Map<Object?, Object?> map) {
    final rawRules = (map['rules'] as List<Object?>?) ?? const [];
    final rawSeen = (map['seen'] as List<Object?>?) ?? const [];
    final rules =
        rawRules
            .whereType<Map<Object?, Object?>>()
            .map(AppRule.fromMap)
            .where((rule) => rule.bundleIdentifier.isNotEmpty)
            .toList()
          ..sort(
            (a, b) => a.displayName.toLowerCase().compareTo(
              b.displayName.toLowerCase(),
            ),
          );
    return FilterState(
      status: FilterStatusX.parse(map['filterStatus']),
      rules: rules,
      seenIdentifiers: rawSeen.whereType<String>().toList(),
      errorMessage: map['errorMessage'] as String?,
    );
  }

  int get blockedCount => rules.where((rule) => rule.isBlocked).length;

  bool hasRule(String bundleIdentifier) {
    final normalized = AppRule.normalizeIdentifier(bundleIdentifier);
    return rules.any((rule) => rule.bundleIdentifier == normalized);
  }
}
