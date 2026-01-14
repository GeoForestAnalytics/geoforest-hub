// Arquivo: lib/shared/widgets/web_nav_bar.dart

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class WebNavBar extends StatelessWidget {
  const WebNavBar({super.key});

  @override
  Widget build(BuildContext context) {
    // Detecta se é uma tela pequena (Mobile) ou grande (Web Desktop)
    final isMobile = MediaQuery.of(context).size.width < 600;

    return Container(
      height: 80,
      padding: const EdgeInsets.symmetric(horizontal: 32),
      color: const Color(0xFF023853), // Cor primária (Navy)
      child: Row(
        children: [
          // LOGO / TÍTULO
          MouseRegion(
            cursor: SystemMouseCursors.click,
            child: GestureDetector(
              onTap: () => context.go('/'),
              child: Text(
                'Geo Forest',
                style: GoogleFonts.montserrat(
                  color: const Color.fromARGB(255, 196, 234, 236), // Cor secundária (Gold)
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          
          const Spacer(),

          // MENU DE NAVEGAÇÃO
          if (!isMobile) ...[
            _NavLink(label: 'Início', path: '/'),
            const SizedBox(width: 20),
            _NavLink(label: 'Manuais', path: '/manuais'),
            const SizedBox(width: 20),
            _NavLink(label: 'Científico', path: '/cientifico'),
            const SizedBox(width: 30),
            ElevatedButton(
              onPressed: () => context.go('/dashboard'), // Rota futura
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromARGB(255, 171, 215, 235),
                foregroundColor: const Color(0xFF023853),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
                textStyle: const TextStyle(fontWeight: FontWeight.bold),
              ),
              child: const Text('Área do Cliente'),
            )
          ] else ...[
            // Ícone de menu para celular (Lógica de Drawer ficaria aqui)
            IconButton(
              icon: const Icon(Icons.menu, color: Colors.white),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Menu mobile em construção')),
                );
              },
            )
          ]
        ],
      ),
    );
  }
}

// Widget auxiliar para os links de texto
class _NavLink extends StatelessWidget {
  final String label;
  final String path;

  const _NavLink({required this.label, required this.path});

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: () => context.go(path),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}