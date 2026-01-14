import 'package:flutter/material.dart';
import 'package:geoforestweb/shared/widgets/web_nav_bar.dart';

class DashboardPlaceholder extends StatelessWidget {
  const DashboardPlaceholder({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: Column(
        children: [
          const WebNavBar(),
          Expanded(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.construction, size: 80, color: Colors.grey),
                  const SizedBox(height: 20),
                  const Text(
                    'Área do Cliente',
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF023853)),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'O painel web está sendo preparado para você.',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                  const SizedBox(height: 30),
                  ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Voltar'),
                  )
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}