"use client"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./lib/firebase";
import { signOut } from "firebase/auth"; // ✅ Importar o comando de saída
import { LogOut } from "lucide-react";    // ✅ Ícone para o botão

export default function RootPage() {
  const router = useRouter();
  const [userDetected, setUserDetected] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserDetected(user);
        // Pequeno delay opcional para o usuário ver a tela de entrada
        const timer = setTimeout(() => {
          router.push("/projetos");
        }, 1000); 
        return () => clearTimeout(timer);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      {/* Spinner de Carregamento */}
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-6"></div>
      
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">
        {userDetected ? `Entrando como ${userDetected.email}...` : "Sincronizando conta..."}
      </p>

      {/* ✅ Botão de Log Off / Trocar Conta */}
      {userDetected && (
        <button 
          onClick={handleLogout}
          className="mt-12 flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 transition-all text-sm font-medium text-slate-400 group"
        >
          <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
          Trocar de conta / Sair
        </button>
      )}
    </div>
  );
}