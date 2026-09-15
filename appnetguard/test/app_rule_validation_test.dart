import 'dart:convert';
import 'dart:io';

import 'package:appnetguard/models.dart';
import 'package:flutter_test/flutter_test.dart';

/// `AppRule` exists twice — here in Dart and in `ios/Shared/AppRule.swift` — with
/// nothing linking the two implementations. `ios/RunnerTests/AppRuleValidationTests.swift`
/// runs this same fixture against the Swift copy, so tightening or loosening one
/// side without the other fails a test instead of shipping a silent mismatch.
void main() {
  final fixture = File('test/fixtures/identifier_cases.json');

  if (!fixture.existsSync()) {
    test('shared identifier fixture is present', () {
      fail(
        'Missing ${fixture.absolute.path}. '
        'Run `flutter test` from the appnetguard package root.',
      );
    });
    return;
  }

  final decoded = jsonDecode(fixture.readAsStringSync()) as Map<String, Object?>;
  final cases = (decoded['cases']! as List<Object?>)
      .map((entry) => (entry! as Map).cast<String, Object?>())
      .toList();

  group('AppRule.normalizeIdentifier', () {
    for (final testCase in cases) {
      final input = testCase['input']! as String;
      final normalized = testCase['normalized']! as String;

      test('${jsonEncode(input)} -> ${jsonEncode(normalized)}', () {
        expect(
          AppRule.normalizeIdentifier(input),
          normalized,
          reason: testCase['note'] as String?,
        );
      });
    }
  });

  group('AppRule.isValidIdentifier', () {
    for (final testCase in cases) {
      final input = testCase['input']! as String;
      final valid = testCase['valid']! as bool;

      test('${jsonEncode(input)} -> $valid', () {
        expect(
          AppRule.isValidIdentifier(input),
          valid,
          reason: testCase['note'] as String?,
        );
      });
    }
  });

  test('fixture covers both outcomes', () {
    expect(cases.where((c) => c['valid'] == true), isNotEmpty);
    expect(cases.where((c) => c['valid'] == false), isNotEmpty);
  });
}
