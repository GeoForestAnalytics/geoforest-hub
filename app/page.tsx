"use client"
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./lib/firebase";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Esse "espião" fica olhando o Firebase Auth
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Usuário logado? Manda para a pasta /projetos
        router.push("/projetos");
      } else {
        // Não logado? Manda para a pasta /login
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Enquanto ele decide, a tela fica vazia ou com um carregando
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
       <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div>
    </div>
  );
}