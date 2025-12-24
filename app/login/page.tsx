"use client"
import { useState } from "react";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false); // <-- Estado de loading
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !senha) return alert("Preencha todos os campos");

    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.push("/projetos"); 
    } catch (error: any) {
      // Tratamento de erro elegante
      if (error.code === "auth/invalid-credential") {
        alert("Email ou senha incorretos.");
      } else {
        alert("Erro ao logar: " + error.message);
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-700">
        <h1 className="text-2xl font-bold mb-2 text-emerald-400">GeoForest Hub</h1>
        <p className="text-slate-400 mb-8 text-sm">Entre com suas credenciais do coletor.</p>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
            <input 
              type="email" 
              placeholder="exemplo@email.com" 
              className="w-full p-3 mt-1 rounded bg-slate-700 border border-slate-600 outline-none focus:border-emerald-500 transition-all"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-3 mt-1 rounded bg-slate-700 border border-slate-600 outline-none focus:border-emerald-500 transition-all"
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          <button 
            onClick={handleLogin}
            disabled={carregando}
            className={`w-full py-3 rounded-lg font-bold transition flex justify-center items-center ${
              carregando ? "bg-slate-600 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
            }`}
          >
            {carregando ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : "Entrar no Hub"}
          </button>
        </div>
      </div>
    </div>
  );
}