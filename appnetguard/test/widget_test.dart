import 'package:appnetguard/filter_controller.dart';
import 'package:appnetguard/filter_service.dart';
import 'package:appnetguard/main.dart';
import 'package:appnetguard/models.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Fakes the Swift side of the method channel with an in-memory rule store so
/// the Flutter UI can be exercised without a device.
class FakeNativeFilter {
  FakeNativeFilter({this.status = 'disabled'});

  String status;
  final List<Map<String, Object?>> rules = [];
  final List<String> seen = [];
  final List<MethodCall> calls = [];

  Map<String, Object?> get state => {
    'filterStatus': status,
    'rules': rules,
    'seen': seen,
  };

  Future<Object?> handle(MethodCall call) async {
    calls.add(call);
    final args = (call.arguments as Map?)?.cast<String, Object?>() ?? {};
    switch (call.method) {
      case 'getState':
        break;
      case 'setFilterEnabled':
        status = (args['enabled'] as bool) ? 'enabled' : 'disabled';
      case 'addRule':
        rules.add({
          'bundleIdentifier': args['bundleIdentifier'],
          'displayName': args['displayName'],
          'isBlocked': true,
          'updatedAt': 0,
        });
      case 'setBlocked':
        for (final rule in rules) {
          if (rule['bundleIdentifier'] == args['bundleIdentifier']) {
            rule['isBlocked'] = args['blocked'];
          }
        }
      case 'removeRule':
        rules.removeWhere(
          (rule) => rule['bundleIdentifier'] == args['bundleIdentifier'],
        );
      case 'setAllBlocked':
        for (final rule in rules) {
          rule['isBlocked'] = args['blocked'];
        }
      case 'clearSeen':
        seen.clear();
      default:
        throw MissingPluginException(call.method);
    }
    return state;
  }
}

void main() {
  const channel = MethodChannel(FilterService.channelName);
  late FakeNativeFilter native;

  setUp(() {
    native = FakeNativeFilter();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, native.handle);
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  Future<FilterController> pumpApp(WidgetTester tester) async {
    final controller = FilterController();
    await tester.pumpWidget(AppNetGuardApp(controller: controller));
    await tester.pumpAndSettle();
    addTearDown(controller.dispose);
    return controller;
  }

  testWidgets('shows empty state and filter off', (tester) async {
    await pumpApp(tester);

    expect(find.text('No apps yet'), findsOneWidget);
    expect(find.text('Off. All apps can reach the internet.'), findsOneWidget);
  });

  testWidgets('toggling the filter calls setFilterEnabled', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.byType(SwitchListTile).first);
    await tester.pumpAndSettle();

    expect(native.calls.map((c) => c.method), contains('setFilterEnabled'));
    expect(native.status, 'enabled');
    expect(find.text('On. 0 app(s) cut off.'), findsOneWidget);
  });

  testWidgets('lists rules and toggles a rule', (tester) async {
    native.status = 'enabled';
    native.rules.add({
      'bundleIdentifier': 'com.google.ios.youtube',
      'displayName': 'YouTube',
      'isBlocked': true,
      'updatedAt': 0,
    });
    await pumpApp(tester);

    expect(find.text('YouTube'), findsOneWidget);
    expect(find.text('1 of 1 blocked'), findsOneWidget);

    final ruleSwitch = find.widgetWithText(SwitchListTile, 'YouTube');
    expect(tester.widget<SwitchListTile>(ruleSwitch).value, isTrue);

    await tester.tap(ruleSwitch);
    await tester.pumpAndSettle();

    final setBlocked = native.calls
        .where((c) => c.method == 'setBlocked')
        .toList();
    expect(setBlocked, hasLength(1));
    expect(
      (setBlocked.single.arguments as Map)['bundleIdentifier'],
      'com.google.ios.youtube',
    );
    expect((setBlocked.single.arguments as Map)['blocked'], isFalse);
    expect(find.text('0 of 1 blocked'), findsOneWidget);
  });

  testWidgets('adds an app from the popular list', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.text('Add app'));
    await tester.pumpAndSettle();

    // Narrow the list with the search field so the preset is on screen.
    await tester.enterText(find.byType(TextField).first, 'insta');
    await tester.pumpAndSettle();

    await tester.tap(find.text('Instagram'));
    await tester.pumpAndSettle();

    expect(native.rules.single['bundleIdentifier'], 'com.burbn.instagram');
    expect(find.text('Instagram'), findsOneWidget);
    expect(find.text('No apps yet'), findsNothing);
  });

  test('bundle identifier validation mirrors the Swift rules', () {
    expect(AppRule.isValidIdentifier('com.example.app'), isTrue);
    expect(AppRule.isValidIdentifier('  Com.Example.App '), isTrue);
    expect(AppRule.isValidIdentifier('pinterest'), isFalse);
    expect(AppRule.isValidIdentifier('com.example app'), isFalse);
    expect(AppRule.isValidIdentifier('a.'), isFalse);
  });

  test('falls back to an unsupported state without the native side', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
    final service = FilterService();
    addTearDown(service.dispose);

    final state = await service.getState();
    expect(state.status, FilterStatus.unsupported);
  });
}
