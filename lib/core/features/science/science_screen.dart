import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:geoforestweb/shared/widgets/web_nav_bar.dart';

class ScienceScreen extends StatelessWidget {
  const ScienceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF023853);

    return Scaffold(
      // Substituímos o background padrão pelo Container com Gradiente
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color.fromARGB(255, 252, 248, 199), // Creme (Topo)
              Color.fromARGB(209, 216, 237, 255),     // Azul Navy (Fundo)
            ],
          ),
        ),
        child: Column(
          children: [
            const WebNavBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                children: [
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 800),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Metodologia Científica',
                            style: TextStyle(
                              fontSize: 36, 
                              fontWeight: FontWeight.bold, 
                              color: primaryNavy // Texto escuro sobre fundo claro
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Fundamentos matemáticos utilizados pelo GeoForest Analytics.',
                            style: TextStyle(
                              fontSize: 18, 
                              // MUDANÇA: Cor escura, pois o fundo aqui é Creme
                              color: primaryNavy 
                            ),
                          ),
                          const SizedBox(height: 50),

                          _buildCard(
                            '1. Cálculo de Volume (Smalian)',
                            'Para cubagem rigorosa, utilizamos o método de Smalian, que considera a média das áreas transversais das extremidades de cada seção.',
                            r'V_{tora} = \frac{g_{base} + g_{topo}}{2} \times L'
                          ),

                          _buildCard(
                            '2. Equação Volumétrica (Schumacher & Hall)',
                            'Ajustamos um modelo de regressão múltipla linearizando a relação entre Volume, DAP e Altura via logaritmos naturais.',
                            r'\ln(V) = \beta_0 + \beta_1 \ln(DAP) + \beta_2 \ln(H) + \varepsilon'
                          ),

                          _buildCard(
                            '3. Detecção de Outliers',
                            'Verificação estatística automática (Z-Score modificado) para alertar sobre árvores com medidas improváveis dentro da parcela.',
                            r'|x_i - \bar{x}| > 2.5 \sigma'
                          ),

                          _buildCard(
                            '4. Índice de Sítio (Projeção)',
                            'Estimativa da qualidade do local baseada na Altura Dominante projetada para uma idade de referência.',
                            r'S = h_{dom} \cdot \exp\left( \beta \left( \frac{1}{I_{atual}} - \frac{1}{I_{ref}} \right) \right)'
                          ),
                          
                          const SizedBox(height: 100),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(String title, String description, String latex) {
    return Card(
      elevation: 4, // Aumentei um pouco a sombra para destacar do fundo
      color: Colors.white, // MUDANÇA: Fundo branco sólido para leitura
      margin: const EdgeInsets.only(bottom: 30),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        // Removi a borda cinza pois o fundo branco já contrasta com o gradiente
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title, 
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF023853))
            ),
            const SizedBox(height: 12),
            Text(
              description, 
              style: const TextStyle(fontSize: 16, height: 1.5, color: Colors.black87)
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 10),
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F7FA), // Fundo cinza claro para a fórmula
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300)
              ),
              child: Center(
                child: Math.tex(
                  latex,
                  textStyle: const TextStyle(fontSize: 20, color: Colors.black),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}