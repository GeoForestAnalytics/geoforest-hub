import 'package:flutter/material.dart';
import 'package:geoforestweb/shared/widgets/web_nav_bar.dart';
import 'package:url_launcher/url_launcher.dart';

// --- MODELOS DE DADOS ---
class ScreenshotData {
  final String path;
  final String label;
  ScreenshotData(this.path, this.label);
}

class VideoData {
  final String title;
  final String description;
  final String thumbnailPath; // Caminho da imagem de capa
  final String videoUrl;      // Link do YouTube
  VideoData({
    required this.title, 
    required this.description, 
    required this.thumbnailPath, 
    required this.videoUrl
  });
}

class ManualsScreen extends StatelessWidget {
  const ManualsScreen({super.key});

  // --- DADOS (Configure aqui seus vídeos e imagens) ---
  
  static final List<ScreenshotData> _screenshots = [
    ScreenshotData('assets/images/screen.jpeg', 'Tela Inicial'),
    ScreenshotData('assets/images/login.jpeg', 'Login'),
    ScreenshotData('assets/images/criar_conta.jpeg', 'Criar Conta'),
    ScreenshotData('assets/images/menu_light.jpeg', 'Menu (Claro)'),
    ScreenshotData('assets/images/menu_dark.jpeg', 'Menu (Escuro)'),
  ];

  static final List<VideoData> _videos = [
    VideoData(
      title: 'Primeiros Passos',
      description: 'Configurando equipe e criando o primeiro projeto.',
      thumbnailPath: 'assets/images/screen.jpeg', // Usei uma imagem existente como capa
      videoUrl: 'https://www.youtube.com/watch?v=SEU_ID_AQUI',
    ),
    VideoData(
      title: 'Coleta de Dados',
      description: 'Lançando árvores, validação de CAP e GPS.',
      thumbnailPath: 'assets/images/menu_light.jpeg',
      videoUrl: 'https://www.youtube.com/watch?v=SEU_ID_AQUI',
    ),
    VideoData(
      title: 'Sincronização',
      description: 'Como enviar dados offline para a nuvem.',
      thumbnailPath: 'assets/images/menu_dark.jpeg',
      videoUrl: 'https://www.youtube.com/watch?v=SEU_ID_AQUI',
    ),
  ];

  static const String _manualPdfUrl = "https://seusite.com/manual_geoforest_v1.pdf"; // Link do PDF

  // --- LÓGICA ---

  Future<void> _abrirLink(String url) async {
    final Uri uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      debugPrint('Erro ao abrir $url');
    }
  }

  void _abrirGaleria(BuildContext context, List<ScreenshotData> images, int initialIndex) {
    final PageController pageController = PageController(initialPage: initialIndex);

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            int currentPage = pageController.hasClients ? pageController.page!.round() : initialIndex;

            return Dialog(
              backgroundColor: Colors.transparent,
              insetPadding: EdgeInsets.zero,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // 1. Fundo Escuro
                  GestureDetector(
                    onTap: () => Navigator.of(ctx).pop(),
                    child: Container(
                      width: double.infinity,
                      height: double.infinity,
                      color: Colors.black.withOpacity(0.9),
                    ),
                  ),

                  // 2. Visualizador
                  PageView.builder(
                    controller: pageController,
                    itemCount: images.length,
                    onPageChanged: (index) {
                      setDialogState(() {
                        currentPage = index;
                      });
                    },
                    itemBuilder: (context, index) {
                      return InteractiveViewer(
                        minScale: 0.5,
                        maxScale: 4.0,
                        child: Center(
                          child: Hero(
                            tag: images[index].label,
                            child: Image.asset(
                              images[index].path,
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                      );
                    },
                  ),

                  // 3. Fechar
                  Positioned(
                    top: 40,
                    right: 30,
                    child: IconButton(
                      icon: const Icon(Icons.close, color: Colors.white, size: 35),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ),

                  // 4. Seta Esquerda
                  if (currentPage > 0)
                    Positioned(
                      left: 20,
                      child: IconButton(
                        icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 50),
                        onPressed: () {
                          pageController.previousPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        },
                      ),
                    ),

                  // 5. Seta Direita
                  if (currentPage < images.length - 1)
                    Positioned(
                      right: 20,
                      child: IconButton(
                        icon: const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 50),
                        onPressed: () {
                          pageController.nextPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        },
                      ),
                    ),

                  // 6. Legenda
                  Positioned(
                    bottom: 40,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        images[currentPage].label,
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF023853);
    const accentGold = Color.fromARGB(255, 255, 255, 255);

    // Cores para os títulos baseadas no gradiente (mais escuras embaixo)
    const titleColorTop = Color.fromARGB(186, 2, 20, 80);
    const titleColorMiddle = Color.fromARGB(255, 1, 42, 66);
    const titleColorBottom = Color.fromARGB(255, 3, 11, 82);
    const lineColor = Color.fromARGB(161, 5, 118, 138);

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color.fromARGB(255, 252, 248, 199), // Creme
              Color.fromARGB(209, 216, 237, 255), // Azul Claro
            ],
          ),
        ),
        child: Column(
          children: [
            const WebNavBar(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1200),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // --- 1. Cabeçalho ---
                        Center(
                          child: Column(
                            children: [
                              const Icon(Icons.school_outlined, size: 60, color: Color.fromARGB(255, 4, 3, 65)),
                              const SizedBox(height: 10),
                              const Text(
                                'Tutoriais e Documentação',
                                style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color.fromARGB(255, 4, 3, 65)),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'Domine o GeoForest Analytics com nossos guias visuais.',
                                style: TextStyle(fontSize: 16, color: const Color.fromARGB(255, 4, 3, 65).withOpacity(0.8)),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: 60),

                        // --- 2. Seção de Vídeos ---
                        _buildSectionTitle('Vídeos Explicativos', textColor: titleColorTop, lineColor: lineColor),
                        const SizedBox(height: 20),
                        Wrap(
                          spacing: 20,
                          runSpacing: 20,
                          alignment: WrapAlignment.start,
                          children: _videos.map((video) => _buildVideoCard(
                            data: video,
                            onTap: () => _abrirLink(video.videoUrl)
                          )).toList(),
                        ),

                        const SizedBox(height: 60),

                        // --- 3. Seção Galeria (Grid) ---
                        _buildSectionTitle('Capturas de Tela', textColor: titleColorMiddle, lineColor: lineColor),
                        const SizedBox(height: 30),
                        Center(
                          child: Wrap(
                            spacing: 40,    
                            runSpacing: 40, 
                            alignment: WrapAlignment.center,
                            children: List.generate(_screenshots.length, (index) {
                              return _buildPhoneScreenshotItem(
                                context, 
                                _screenshots, 
                                index
                              );
                            }),
                          ),
                        ),

                        const SizedBox(height: 60),

                        // --- 4. Seção PDF ---
                        _buildSectionTitle('Manuais em PDF', textColor: titleColorBottom, lineColor: lineColor),
                        const SizedBox(height: 20),
                        Card(
                          elevation: 4,
                          color: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Colors.white.withOpacity(0.5))
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(20),
                            leading: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                              child: const Icon(Icons.picture_as_pdf, color: Colors.red, size: 30),
                            ),
                            title: const Text('Manual Completo de Operação v1.0', style: TextStyle(fontWeight: FontWeight.bold, color: primaryNavy)),
                            subtitle: const Text('PDF - 2.5MB - Atualizado em Dez/2023', style: TextStyle(color: Colors.grey)),
                            trailing: ElevatedButton.icon(
                              onPressed: () => _abrirLink(_manualPdfUrl), // Link configurado
                              icon: const Icon(Icons.download),
                              label: const Text('Baixar Manual'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: primaryNavy,
                                foregroundColor: accentGold
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, {required Color textColor, required Color lineColor}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: textColor),
        ),
        const SizedBox(height: 5),
        Container(width: 50, height: 4, color: lineColor),
      ],
    );
  }

  // --- WIDGET DE VÍDEO ATUALIZADO ---
  // Agora aceita o objeto VideoData para mostrar a capa correta
  Widget _buildVideoCard({required VideoData data, required VoidCallback onTap}) {
    const primaryNavy = Color(0xFF023853);
    
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 350,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail do Vídeo com botão Play sobreposto
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  height: 200,
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                  ),
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                    child: Image.asset(
                      data.thumbnailPath,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => const Center(child: Icon(Icons.video_library, color: Colors.white54)),
                    ),
                  ),
                ),
                // Overlay Escuro para destacar o Play
                Container(
                  height: 200,
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.3),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                  ),
                ),
                // Ícone de Play
                const Icon(Icons.play_circle_fill, size: 64, color: Colors.white),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(data.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryNavy)),
                  const SizedBox(height: 8),
                  Text(data.description, style: TextStyle(color: Colors.grey[600], height: 1.5)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhoneScreenshotItem(BuildContext context, List<ScreenshotData> allImages, int index) {
    final item = allImages[index];
    
    return Column(
      children: [
        MouseRegion(
          cursor: SystemMouseCursors.click,
          child: GestureDetector(
            onTap: () => _abrirGaleria(context, allImages, index),
            child: Hero(
              tag: item.label, 
              child: Container(
                width: 220,
                height: 440,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white.withOpacity(0.3), width: 6),
                  borderRadius: BorderRadius.circular(30),
                  color: Colors.black38,
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 5))]
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Image.asset(
                    item.path,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return const Center(child: Icon(Icons.broken_image, color: Colors.white54, size: 50));
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 15),
        Text(
          item.label, 
          style: const TextStyle(
            fontWeight: FontWeight.bold, 
            color: Color(0xFF023853),
            fontSize: 16
          )
        ),
      ],
    );
  }
}