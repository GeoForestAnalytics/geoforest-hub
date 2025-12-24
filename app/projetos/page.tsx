"use client"
import { useEffect, useState } from "react";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import Link from "next/link";

interface Projeto {
  id: string;
  nome: string;
  empresa: string;
  responsavel: string;
  status: string;
  totalTalhoes?: number;
  talhoesConcluidos?: number;
}

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, `clientes/${user.uid}/projetos`));
        const unsubDb = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Projeto[];
          setProjetos(docs);
          setLoading(false);
        });
        return () => unsubDb();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Projetos</h1>
          <p className="text-slate-500">Acompanhe seus contratos e produtividade de campo.</p>
        </div>
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition">
          + Novo Projeto
        </button>
      </header>

      {loading ? (
        <div className="animate-pulse text-emerald-600">Carregando dados...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {projetos.map((proj) => {
            const total = proj.totalTalhoes || 0;
            const concluidos = proj.talhoesConcluidos || 0;
            const porcentagem = total > 0 ? Math.round((concluidos / total) * 100) : 0;

            return (
              <Link href={`/projetos/${proj.id}`} key={proj.id}>
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-emerald-500 transition cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-emerald-600">{proj.nome}</h3>
                    <span className="text-xs font-bold uppercase px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                      {proj.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <p className="text-sm text-slate-600"><strong>Cliente:</strong> {proj.empresa}</p>
                    <p className="text-sm text-slate-600"><strong>Resp:</strong> {proj.responsavel}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Progresso da Coleta</span>
                      <span>{porcentagem}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                        style={{ width: `${porcentagem}%` }}
                      ></div>
                    </div>
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