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
    final colorScheme =
        ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.light,
        ).copyWith(
          // Pure white surfaces so the app reads as bright regardless of the
          // device's dark-mode setting.
          surface: Colors.white,
          surfaceContainerLowest: Colors.white,
          surfaceContainerLow: const Color(0xFFFCFCFC),
          surfaceContainer: const Color(0xFFF7F7F7),
        );
    return MaterialApp(
      title: 'AppNetGuard',
      debugShowCheckedModeBanner: false,
      // Always render the light theme; the app never switches to dark mode.
      themeMode: ThemeMode.light,
      theme: ThemeData(
        colorScheme: colorScheme,
        scaffoldBackgroundColor: Colors.white,
        useMaterial3: true,
        cardTheme: const CardThemeData(color: Colors.white),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
        ),
      ),
      home: HomeScreen(controller: _controller),
    );
  }
}
