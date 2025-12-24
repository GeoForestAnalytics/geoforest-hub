import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { TreeDeciduous, CircleDollarSign, Users } from "lucide-react";

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
        {/* Menu Lateral Destravado */}
        <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col border-r border-emerald-500/10">
          <div className="mb-8">
            <h2 className="text-xl font-black text-emerald-400 tracking-tighter uppercase">
              GeoForest Hub
            </h2>
          </div>

          <nav className="space-y-2 flex-1">
            <Link 
              href="/projetos" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-bold text-sm"
            >
              <TreeDeciduous size={18} /> Projetos
            </Link>

            <Link 
              href="/financeiro" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-bold text-sm"
            >
              <CircleDollarSign size={18} /> Financeiro
            </Link>

            <Link 
              href="/equipes" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-bold text-sm"
            >
              <Users size={18} /> Equipes
            </Link>
          </nav>
        </aside>

        {/* Área de Conteúdo Principal */}
        <main className="flex-1 h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}