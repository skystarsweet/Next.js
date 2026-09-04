import 'package:flutter/material.dart';

import 'filter_controller.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const AppNetGuardApp());
}

class AppNetGuardApp extends StatefulWidget {
  const AppNetGuardApp({super.key, this.controller});

  /// Injectable for tests; a real controller is created when null.
  final FilterController? controller;

  @override
  State<AppNetGuardApp> createState() => _AppNetGuardAppState();
}

class _AppNetGuardAppState extends State<AppNetGuardApp> {
  late final FilterController _controller;
  late final bool _ownsController;

  @override
  void initState() {
    super.initState();
    _ownsController = widget.controller == null;
    _controller = widget.controller ?? FilterController();
  }

  @override
  void dispose() {
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFFE64D66);
    return MaterialApp(
      title: 'AppNetGuard',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: HomeScreen(controller: _controller),
    );
  }
}
