import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:geoforestweb/core/features/home/home_screen.dart';
import 'package:geoforestweb/core/features/manuals/manuals_screen.dart';
import 'package:geoforestweb/core/features/science/science_screen.dart';
import 'package:geoforestweb/core/features/dashboard/dashboard_placeholder.dart'; 

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        name: 'home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/manuais',
        name: 'manuais',
        builder: (context, state) => const ManualsScreen(),
      ),
      GoRoute(
        path: '/cientifico',
        name: 'cientifico',
        builder: (context, state) => const ScienceScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        name: 'dashboard',
        builder: (context, state) => const DashboardPlaceholder(),
      ),
    ],
    errorBuilder: (context, state) => const Scaffold(
      body: Center(child: Text('Página não encontrada')),
    ),
  );
});