import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class WebNavBar extends StatelessWidget {
  const WebNavBar({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    const double breakPoint = 850;
    
    // Apenas a cor Azul Principal
    const primaryNavy = Color(0xFF023853);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
      color: primaryNavy,
      child: Row(
        children: [
          // Logo e Título
          Expanded(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    'Geo Forest Analytics',
                    style: GoogleFonts.montserrat(
                      color: Colors.white, // MUDANÇA: Agora é branco puro
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.2,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          // Menu Desktop
          if (width > breakPoint) ...[
            const Spacer(),
            const _NavLink(label: 'Início', path: '/'),
            const _NavLink(label: 'Manuais & Vídeos', path: '/manuais'),
            const _NavLink(label: 'Metodologia', path: '/cientifico'),
            const SizedBox(width: 20),
            ElevatedButton.icon(
              onPressed: () => context.go('/dashboard'),
              icon: const Icon(Icons.login_rounded, size: 18),
              label: const Text('Área do Cliente'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white, // MUDANÇA: Fundo branco
                foregroundColor: primaryNavy, // MUDANÇA: Texto azul
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                )
              ),
            )
          ]
          // Menu Mobile
          else ...[
            PopupMenuButton<String>(
              icon: const Icon(Icons.menu, color: Colors.white, size: 30), // Ícone branco
              color: primaryNavy,
              onSelected: (value) => context.go(value),
              itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                _buildPopupItem('Início', '/'),
                _buildPopupItem('Manuais & Vídeos', '/manuais'),
                _buildPopupItem('Metodologia', '/cientifico'),
                const PopupMenuDivider(height: 1),
                _buildPopupItem('Área do Cliente', '/dashboard', icon: Icons.login),
              ],
            ),
          ]
        ],
      ),
    );
  }

  PopupMenuItem<String> _buildPopupItem(String label, String path, {IconData? icon}) {
    return PopupMenuItem<String>(
      value: path,
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, color: Colors.white, size: 18), const SizedBox(width: 8)],
          Text(label, style: const TextStyle(color: Colors.white)),
        ],
      ),
    );
  }
}

class _NavLink extends StatelessWidget {
  final String label;
  final String path;
  const _NavLink({required this.label, required this.path});

  @override
  Widget build(BuildContext context) {
    final String location = GoRouterState.of(context).matchedLocation;
    final bool isActive = location == path;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: TextButton(
        onPressed: () => context.go(path),
        style: TextButton.styleFrom(
          // MUDANÇA: Branco forte se ativo, branco transparente se inativo
          foregroundColor: isActive ? Colors.white : Colors.white70,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            fontSize: 16,
          ),
        ),
      ),
    );
  }
}