import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'core/router/app_router.dart';

void main() {
  runApp(const ProviderScope(child: GeoForestWeb()));
}

class GeoForestWeb extends ConsumerWidget {
  const GeoForestWeb({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    // Cores extraídas do App Mobile
    const primaryNavy = Color(0xFF023853);
    const accentGold = Color.fromARGB(255, 243, 243, 239);

    return MaterialApp.router(
      title: 'Geo Forest Analytics',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: Color(0xFF023853),
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryNavy,
          primary: primaryNavy,
          secondary: accentGold,
          background: Colors.white,
        ),
        textTheme: GoogleFonts.montserratTextTheme().apply(
          bodyColor: primaryNavy,
          displayColor: primaryNavy,
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: primaryNavy,
          foregroundColor: Colors.white,
          centerTitle: true,
          titleTextStyle: GoogleFonts.montserrat(
            fontSize: 20, 
            fontWeight: FontWeight.bold,
            color: accentGold
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryNavy,
            foregroundColor: accentGold,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: GoogleFonts.montserrat(fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }
}