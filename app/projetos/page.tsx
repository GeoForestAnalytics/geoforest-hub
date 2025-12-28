"use client"
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import Link from "next/link";
import { useLicense } from "../hooks/useAuthContext"; 

interface Projeto {
  id: string;
  nome: string;
  empresa: string;
  responsavel: string;
  status: string;
  totalTalhoes: number;      // Removi o '?' para garantir que sempre trataremos como número
  talhoesConcluidos: number; // Removi o '?' para garantir que sempre trataremos como número
}

export default function ProjetosPage() {
  const { licenseId, loading: authLoading } = useLicense(); 
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!licenseId) return;

    setLoadingData(true);

    const q = query(collection(db, `clientes/${licenseId}/projetos`));
    
    const unsubDb = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // --- INÍCIO DO AJUSTE DE TIPAGEM ---
        // Aqui garantimos que os contadores sejam números e nunca nulos
        return {
          id: doc.id,
          nome: data.nome || "Sem Nome",
          empresa: data.empresa || "N/A",
          responsavel: data.responsavel || "N/A",
          status: data.status || "ativo",
          totalTalhoes: Number(data.totalTalhoes || 0),
          talhoesConcluidos: Number(data.talhoesConcluidos || 0),
        } as Projeto;
        // --- FIM DO AJUSTE DE TIPAGEM ---
        
      });
      
      setProjetos(docs);
      setLoadingData(false);
    }, (error) => {
      console.error("Erro no Firestore:", error);
      setLoadingData(false);
    });

    return () => unsubDb();
  }, [licenseId]);

  if (authLoading || (loadingData && projetos.length === 0)) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-4"></div>
        <p className="text-slate-500 animate-pulse font-medium">Sincronizando com a base da empresa...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Projetos</h1>
          <p className="text-slate-500 text-sm">
            Visualizando dados da licença: <span className="font-mono text-emerald-600 font-bold">{licenseId}</span>
          </p>
        </div>
        <button className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20">
          + Novo Projeto
        </button>
      </header>

      {projetos.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-20 text-center">
          <p className="text-slate-400 font-medium">Nenhum projeto encontrado nesta licença.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projetos.map((proj) => {
            // Agora o cálculo é 100% seguro pois total e concluidos são garantidos como Number
            const porcentagem = proj.totalTalhoes > 0 
                ? Math.round((proj.talhoesConcluidos / proj.totalTalhoes) * 100) 
                : 0;

            return (
              <Link href={`/projetos/${proj.id}`} key={proj.id}>
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm hover:shadow-xl hover:border-emerald-500 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-black text-lg text-slate-800 group-hover:text-emerald-600 uppercase tracking-tighter">
                      {proj.nome}
                    </h3>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                      proj.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {proj.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                      Cliente: <span className="text-slate-900">{proj.empresa}</span>
                    </p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                      Responsável: <span className="text-slate-900">{proj.responsavel}</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Progresso Geral</span>
                      <span className="text-emerald-600">{porcentagem}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-700 ease-out" 
                        style={{ width: `${porcentagem}%` }}
                      ></div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold text-right uppercase">
                        {proj.talhoesConcluidos} de {proj.totalTalhoes} talhões
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}