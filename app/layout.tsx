import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { 
  TreeDeciduous, 
  CircleDollarSign, 
  Users, 
  Car,
  FileText // ✅ Adicionado ícone para o Rascunho de Nota
} from "lucide-react";

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
        {/* Menu Lateral */}
        <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col border-r border-emerald-500/10 shrink-0">
          
          {/* Logo da Empresa */}
          <div className="mb-8">
            <h2 className="text-xl font-black text-emerald-400 tracking-tighter uppercase">
              GeoForest Hub
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              ERP Florestal v1.0
            </p>
          </div>

          {/* Navegação Principal */}
          <nav className="space-y-2 flex-1">
            <Link 
              href="/projetos" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group"
            >
              <TreeDeciduous size={20} className="group-hover:scale-110 transition-transform" /> 
              Projetos
            </Link>

            <Link 
              href="/financeiro" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group"
            >
              <CircleDollarSign size={20} className="group-hover:scale-110 transition-transform" /> 
              Financeiro
            </Link>

            {/* ✅ Novo Link para Emissão de Rascunho de Nota */}
            <Link 
              href="/financeiro/rascunho-nota" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group text-slate-300"
            >
              <FileText size={20} className="group-hover:scale-110 transition-transform" /> 
              Rascunho de NF
            </Link>

            <Link 
              href="/equipes" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group"
            >
              <Users size={20} className="group-hover:scale-110 transition-transform" /> 
              Equipes
            </Link>

            {/* ✅ Link de Frotas Corrigido */}
            <Link
              href="/frota" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group text-slate-300"
            >
              <Car size={20} className="group-hover:scale-110 transition-transform" /> 
              Frota Operacional
            </Link>
          </nav>

          {/* Rodapé do Menu */}
          <div className="pt-6 border-t border-slate-800 text-[10px] text-slate-500 font-medium italic">
            © 2025 GeoForest Tech
          </div>
        </aside>

        {/* Conteúdo Principal das Páginas */}
        <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}