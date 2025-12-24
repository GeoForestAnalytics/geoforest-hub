import type { Metadata } from "next";
import "./globals.css";

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
      <body className="flex min-h-screen bg-slate-50 text-slate-900">
        {/* Menu Lateral Simples */}
        <aside className="w-64 bg-slate-900 text-white p-6 hidden md:block">
          <h2 className="text-xl font-bold mb-8 text-emerald-400">GeoForest Hub</h2>
          <nav className="space-y-4">
            <a href="/projetos" className="block hover:text-emerald-400">🌳 Projetos</a>
            <a href="/financeiro" className="block hover:text-emerald-400 text-slate-500 cursor-not-allowed">💰 Financeiro (Breve)</a>
            <a href="/equipes" className="block hover:text-emerald-400 text-slate-500 cursor-not-allowed">👥 Equipes (Breve)</a>
          </nav>
        </aside>

        {/* Área de Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}