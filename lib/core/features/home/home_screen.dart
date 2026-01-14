import 'package:flutter/material.dart';
import 'package:geoforestweb/shared/widgets/web_nav_bar.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  Future<void> _launchLink(String url) async {
    final Uri uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      debugPrint('Não foi possível abrir $url');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Detecta se é mobile para ajustar layout da página principal
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 800;

    const String whatsappUrl = "https://wa.me/5515981409153?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20Geo%20Forest%20Analytics.";
    const String instagramUrl = "https://www.instagram.com/geoforestcoletor/";  
    const String emailUrl = "mailto:geoforestanalytics@gmail.com";

    // Definição da cor Principal
    const primaryNavy = Color(0xFF023853);

    final List<Map<String, dynamic>> features = [
      {
        'icon': Icons.analytics_outlined,
        'title': 'Análise Precisa',
        'desc': 'Cálculos volumétricos exatos.',
        'details': 'Dentro do app, basta acessar o menu "Cálculos", selecionar o talhão desejado e escolher o método de cubagem. O sistema gera os gráficos instantaneamente.'
      },
      {
        'icon': Icons.offline_bolt_outlined,
        'title': 'Modo Offline',
        'desc': 'Colete dados sem internet.',
        'details': 'O app entrará automaticamente em "Modo Campo" quando perder o sinal, permitindo lançar árvores e alturas. Assim que reconectar, tudo é enviado para a nuvem.'
      },
      {
        'icon': Icons.cloud_sync_outlined,
        'title': 'Sincronização',
        'desc': 'Backup automático na nuvem.',
        'details': 'Nosso sistema garante que cada árvore lançada seja salva no servidor seguro. Comece o inventário no tablet e termine a análise no computador.'
      },
      {
        'icon': Icons.map_outlined,
        'title': 'GPS Integrado',
        'desc': 'Mapeamento de alta precisão.',
        'details': 'Utilizamos a API de geolocalização do dispositivo para marcar o ponto exato de cada parcela e visualizar o caminhamento realizado.'
      },
      {
        'icon': Icons.table_chart_outlined,
        'title': 'Exportação CSV',
        'desc': 'Relatórios prontos em .csv.',
        'details': 'Com um clique, o sistema gera uma planilha formatada contendo abas para: Dados Brutos, Resumo por Parcela e Resumo por Talhão.'
      },
      {
        'icon': Icons.security_outlined,
        'title': 'Segurança',
        'desc': 'Seus dados protegidos.',
        'details': 'Seus dados são criptografados. Oferecemos gestão de níveis de acesso (Gerente vs Equipe) para proteger as informações críticas.'
      },
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          const WebNavBar(),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  // ==========================================
                  // HERO SECTION
                  // ==========================================
                  SizedBox(
                    height: isMobile ? 500 : 600, // Hero um pouco menor no mobile
                    width: double.infinity,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: Image.asset(
                            'assets/images/azul_forest.jpg',
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => Container(color: primaryNavy),
                          ),
                        ),
                        Positioned.fill(
                          child: Container(color: primaryNavy.withOpacity(0.7)),
                        ),
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: EdgeInsets.all(isMobile ? 10 : 15),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 5))
                                    ]
                                  ),
                                  child: Image.asset(
                                    'assets/images/icon_azul.png',
                                    height: isMobile ? 80 : 100,
                                    errorBuilder: (context, error, stackTrace) => const Icon(Icons.forest, size: 150, color: primaryNavy),
                                  ),
                                )
                                .animate()
                                .scale(duration: 600.ms, curve: Curves.easeOutBack)
                                .shimmer(delay: 1000.ms, duration: 1500.ms),

                                SizedBox(height: isMobile ? 30 : 60),
                                
                                Text(
                                  'Revolucione seu Inventário Florestal',
                                  style: TextStyle(
                                    fontSize: isMobile ? 32 : 48, // Fonte menor no mobile
                                    fontWeight: FontWeight.bold, 
                                    color: Colors.white
                                  ),
                                  textAlign: TextAlign.center,
                                ).animate().slideY(begin: 0.3, end: 0).fadeIn(),
                                
                                const SizedBox(height: 20),
                                
                                Text(
                                  'Tecnologia avançada para engenharia florestal.',
                                  style: TextStyle(
                                    fontSize: isMobile ? 16 : 20, 
                                    color: Colors.white
                                  ), 
                                  textAlign: TextAlign.center,
                                ).animate().fadeIn(delay: 500.ms),

                                const SizedBox(height: 40),
                                
                                ElevatedButton(
                                  onPressed: () => _launchLink(whatsappUrl),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 20)
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.message, color: primaryNavy),
                                      SizedBox(width: 10),
                                      Text('COMEÇAR AGORA', style: TextStyle(color: primaryNavy, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                )
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ==========================================
                  // SEÇÃO DE FUNCIONALIDADES
                  // ==========================================
                  Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color.fromARGB(255, 252, 248, 199),          
                          Color.fromARGB(255, 3, 58, 94),
                        ],
                      ),
                    ),
                    padding: EdgeInsets.symmetric(vertical: isMobile ? 40 : 80, horizontal: 20),
                    child: Column(
                      children: [
                         Text(
                           "Por que escolher o Geo Forest?", 
                           style: TextStyle(
                             fontSize: isMobile ? 24 : 32, 
                             fontWeight: FontWeight.bold, 
                             color: primaryNavy
                           ),
                           textAlign: TextAlign.center,
                         ),
                         const SizedBox(height: 10),
                         const Text(
                           "Toque nos cards para ver detalhes técnicos", 
                           style: TextStyle(fontSize: 16, color: Color.fromARGB(255, 11, 4, 44))
                         ),
                         const SizedBox(height: 60),
                         
                         Center(
                           child: ConstrainedBox(
                             constraints: const BoxConstraints(maxWidth: 1200),
                             child: Wrap(
                              // Espaçamento menor no mobile para caber melhor
                              spacing: isMobile ? 15 : 30,
                              runSpacing: isMobile ? 15 : 30,
                              alignment: WrapAlignment.center,
                              children: features.map((feat) {
                                return _InteractiveFeatureCard(data: feat);
                              }).toList(),
                             ),
                           ),
                         )
                      ],
                    ),
                  ),

                  // ==========================================
                  // RODAPÉ
                  // ==========================================
                  Container(
                    width: double.infinity,
                    color: primaryNavy,
                    padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 20),
                    child: Column(
                      children: [
                        const Text(
                          "Entre em Contato",
                          style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 30),
                        Wrap(
                          spacing: 40,
                          runSpacing: 20,
                          alignment: WrapAlignment.center,
                          children: [
                            _ContactItem(
                              icon: Icons.email_outlined, 
                              text: "geoforestanalytics@gmail.com",
                              onTap: () => _launchLink(emailUrl),
                            ),
                            _ContactItem(
                              icon: Icons.phone_android_outlined, 
                              text: "+55 15 98140-9153",
                              onTap: () => _launchLink(whatsappUrl),
                            ),
                            _ContactItem(
                              icon: Icons.camera_alt_outlined, 
                              text: "@geoforest.coletor",
                              onTap: () => _launchLink(instagramUrl),
                            ),
                          ],
                        ),
                        const SizedBox(height: 60),
                        const Divider(color: Colors.white24),
                        const SizedBox(height: 20),
                        const Text(
                          "© 2025 Geo Forest Analytics. Todos os direitos reservados.",
                          style: TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ==========================================
// WIDGETS AUXILIARES
// ==========================================

class _ContactItem extends StatefulWidget {
  final IconData icon;
  final String text;
  final VoidCallback onTap;

  const _ContactItem({required this.icon, required this.text, required this.onTap});

  @override
  State<_ContactItem> createState() => _ContactItemState();
}

class _ContactItemState extends State<_ContactItem> {
  bool isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => isHovered = true),
      onExit: (_) => setState(() => isHovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: isHovered ? Colors.white.withOpacity(0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: isHovered ? Colors.white70 : Colors.transparent)
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(widget.icon, color: Colors.white, size: 24),
              const SizedBox(width: 10),
              Text(widget.text, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
}

// =================================================================
// CARD INTERATIVO COM REDIMENSIONAMENTO PARA MOBILE
// =================================================================
class _InteractiveFeatureCard extends StatefulWidget {
  final Map<String, dynamic> data;
  const _InteractiveFeatureCard({required this.data});

  @override
  State<_InteractiveFeatureCard> createState() => _InteractiveFeatureCardState();
}

class _InteractiveFeatureCardState extends State<_InteractiveFeatureCard> {
  bool isHovered = false;
  static const primaryNavy = Color(0xFF023853);

  void _showDetails() {
    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Container(
            width: 500,
            padding: const EdgeInsets.all(30),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(widget.data['icon'], size: 30, color: primaryNavy),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Text(
                        widget.data['title'],
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: primaryNavy),
                      ),
                    ),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context))
                  ],
                ),
                const Divider(height: 30),
                Text("Como funciona:", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey[800])),
                const SizedBox(height: 10),
                Text(widget.data['details'], style: const TextStyle(fontSize: 16, height: 1.5, color: Colors.black87)),
                const SizedBox(height: 30),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(backgroundColor: primaryNavy, padding: const EdgeInsets.symmetric(vertical: 15), foregroundColor: Colors.white),
                    child: const Text("Entendi"),
                  ),
                )
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // Detecta largura da tela dentro do componente
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 700;

    // Ajustes de tamanho baseados no dispositivo
    // Mobile: Card responsivo (90% da tela se for muito pequeno, ou fixo em 280 se for tablet pequeno)
    // Desktop: Card fixo em 320
    final double cardWidth = isMobile ? (width > 350 ? 280 : width * 0.85) : 320;
    
    // Padding interno reduzido no mobile
    final double cardPadding = isMobile ? 20 : 30;

    // Tamanho das fontes reduzido no mobile
    final double titleSize = isMobile ? 18 : 20;
    final double descSize = isMobile ? 14 : 15;
    final double iconSize = isMobile ? 32 : 40;

    return MouseRegion(
      onEnter: (_) => setState(() => isHovered = true),
      onExit: (_) => setState(() => isHovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: _showDetails,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: cardWidth,
          padding: EdgeInsets.all(cardPadding),
          transform: isHovered ? (Matrix4.identity()..scale(1.03)) : Matrix4.identity(), // Efeito hover mais sutil no mobile
          decoration: BoxDecoration(
            color: isHovered ? primaryNavy : Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isHovered ? 0.3 : 0.08),
                blurRadius: isHovered ? 25 : 15,
                offset: const Offset(0, 5)
              )
            ],
            border: Border.all(color: isHovered ? Colors.transparent : Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isHovered ? Colors.white.withOpacity(0.1) : primaryNavy.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  widget.data['icon'], 
                  size: iconSize, 
                  color: isHovered ? Colors.white : primaryNavy
                ),
              ),
              const SizedBox(height: 20),
              Text(
                widget.data['title'], 
                style: TextStyle(
                  fontWeight: FontWeight.bold, 
                  fontSize: titleSize, 
                  color: isHovered ? Colors.white : primaryNavy
                )
              ),
              const SizedBox(height: 10),
              Text(
                widget.data['desc'], 
                style: TextStyle(
                  fontSize: descSize, 
                  color: isHovered ? Colors.white70 : Colors.grey[600],
                  height: 1.5
                )
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Text(
                    "Ver detalhes", 
                    style: TextStyle(
                      fontSize: isMobile ? 12 : 14, 
                      fontWeight: FontWeight.bold, 
                      color: isHovered ? Colors.white : Colors.blue.shade900
                    )
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    Icons.arrow_forward, 
                    size: 16, 
                    color: isHovered ? Colors.white : Colors.blue.shade900
                  )
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}