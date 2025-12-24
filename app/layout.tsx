import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link"; // Importante para navegação rápida
import { TreeDeciduous, CircleDollarSign, Users, LayoutDashboard } from "lucide-react"; // Ícones profissionais

export const metadata: Metadata = {
  title: "GeoForest Hub - ERP Florestal",
  description: "Gestão de inventário e silvicultura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
        {/* Menu Lateral Otimizado */}
        <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col border-r border-emerald-500/10">
          <div className="mb-8">
            <h2 className="text-xl font-black text-emerald-400 tracking-tighter uppercase">
              GeoForest Hub
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              ERP Florestal v1.0
            </p>
          </div>

          <nav className="space-y-2 flex-1">
            <Link 
              href="/projetos" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group"
            >
              <TreeDeciduous size={20} className="group-hover:scale-110 transition-transform" /> 
              Projetos
            </Link>

            {/* Itens desabilitados como Span para melhor semântica */}
            <div className="flex items-center gap-3 px-4 py-3 text-slate-500 cursor-not-allowed opacity-50 font-medium">
              <CircleDollarSign size={20} />
              Financeiro (Breve)
            </div>

            <div className="flex items-center gap-3 px-4 py-3 text-slate-500 cursor-not-allowed opacity-50 font-medium">
              <Users size={20} />
              Equipes (Breve)
            </div>
          </nav>

          {/* Rodapé do Menu (Opcional) */}
          <div className="pt-6 border-t border-slate-800 text-[10px] text-slate-500 font-medium italic">
            © 2025 GeoForest Tech
          </div>
        </aside>

        {/* Área de Conteúdo Principal */}
        <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}