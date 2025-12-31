"use client" // Adicionado para permitir o clique no botão de logout
import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "./lib/firebase";
import { signOut } from "firebase/auth";
import { 
  TreeDeciduous, 
  CircleDollarSign, 
  Users, 
  Car,
  FileText,
  LayoutDashboard,
  LogOut // Ícone de Sair
} from "lucide-react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();

  const handleLogout = async () => {
    if (confirm("Deseja realmente encerrar a sessão?")) {
      try {
        await signOut(auth);
        router.push("/login");
      } catch (error) {
        console.error("Erro ao sair:", error);
      }
    }
  };

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
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group">
              <LayoutDashboard size={20} /> Painel Executivo
            </Link>

            <Link href="/projetos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group">
              <TreeDeciduous size={20} /> Projetos
            </Link>

            <Link href="/financeiro" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group">
              <CircleDollarSign size={20} /> Financeiro
            </Link>

            <Link href="/financeiro/rascunho-nota" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group text-slate-300">
              <FileText size={20} /> Rascunho de NF
            </Link>

            <Link href="/equipes" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group">
              <Users size={20} /> Equipes
            </Link>

            <Link href="/frota" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-600/10 hover:text-emerald-400 transition-all font-medium group text-slate-300">
              <Car size={20} /> Frota Operacional
            </Link>
          </nav>

          {/* ✅ BOTÃO DE LOGOUT (Sair) */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium group mb-4 border border-transparent hover:border-red-500/20"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" /> 
            Encerrar Sessão
          </button>

          {/* Rodapé do Menu */}
          <div className="pt-6 border-t border-slate-800 text-[10px] text-slate-500 font-medium italic">
            © 2025 GeoForest Tech
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}