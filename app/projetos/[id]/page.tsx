"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";  
import { doc, getDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { 
  BarChart3, 
  Ruler, 
  ArrowLeft, 
  Settings, 
  ChevronDown, 
  ChevronUp,
  MapPin
} from "lucide-react";

export default function DetalhesProjeto() {
  const params = useParams(); 
  const router = useRouter();
  const projId = params.id as string;
  
  const [projeto, setProjeto] = useState<any>(null);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ESTADO PARA CONTROLAR QUAIS FAZENDAS ESTÃO MINIMIZADAS
  const [fazendasMinimizadas, setFazendasMinimizadas] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const uid = user.uid;
        try {
          const docRef = doc(db, `clientes/${uid}/projetos`, projId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setProjeto(docSnap.data());

          const qAtiv = query(collection(db, `clientes/${uid}/atividades`), where("projetoId", "in", [projId, Number(projId)]));
          onSnapshot(qAtiv, (snap) => {
            setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });

          onSnapshot(collection(db, `clientes/${uid}/fazendas`), (snap) => {
            setFazendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });

          onSnapshot(collection(db, `clientes/${uid}/talhoes`), (snap) => {
            setTalhoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });

          setLoading(false);
        } catch (error) {
          console.error("Erro na hierarquia:", error);
          setLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribeAuth();
  }, [projId, router]);

  // FUNÇÃO PARA MINIMIZAR/EXPANDIR
  const toggleFazenda = (fazendaId: string) => {
    setFazendasMinimizadas(prev => 
      prev.includes(fazendaId) 
        ? prev.filter(id => id !== fazendaId) 
        : [...prev, fazendaId]
    );
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Navegação */}
      <nav className="mb-6">
        <Link href="/projetos" className="text-xs font-bold text-slate-400 uppercase hover:text-emerald-600 flex items-center gap-1 transition-colors">
          <ArrowLeft size={14} /> Voltar para Projetos
        </Link>
      </nav>

      {/* Header do Projeto */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter uppercase">{projeto?.nome}</h1>
          <p className="text-slate-500 font-medium">
            Empresa: <span className="text-slate-900 font-bold">{projeto?.empresa}</span> | 
            Responsável: <span className="text-slate-900 font-bold">{projeto?.responsavel}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <Link 
            href={`/projetos/${projId}/analise`}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20"
          >
            <BarChart3 size={18} /> Auditoria de Campo
          </Link>
          
          <Link 
            href={`/projetos/${projId}/cubagem`}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
          >
            <Ruler size={18} className="text-emerald-400" /> Auditoria de Cubagem
          </Link>
        </div>
      </div>

      {/* Atividades */}
      <div className="space-y-10">
        {atividades.map((ativ) => (
          <div key={ativ.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-900 p-5 px-8 flex justify-between items-center">
              <h2 className="text-white font-black uppercase text-sm tracking-widest">
                Atividade: <span className="text-emerald-400">{ativ.tipo}</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-bold tracking-widest">{ativ.metodoCubagem || "PADRÃO"}</span>
            </div>

            <div className="p-8 space-y-8">
              {fazendas.filter(f => f.atividadeId === ativ.id).map(faz => {
                const isMinimizada = fazendasMinimizadas.includes(faz.id);
                
                return (
                  <div key={faz.id} className="space-y-4">
                    {/* Header da Fazenda Clicável */}
                    <div 
                      onClick={() => toggleFazenda(faz.id)}
                      className="flex items-center justify-between cursor-pointer group bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-emerald-500/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">🏠 Fazenda: {faz.nome}</span>
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <MapPin size={10} /> {faz.municipio}
                        </span>
                      </div>
                      {isMinimizada ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronUp size={20} className="text-slate-400" />}
                    </div>
                    
                    {/* Grid de Talhões (Esconde se minimizada) */}
                    {!isMinimizada && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pl-4">
                        {talhoes.filter(t => t.fazendaId === faz.id).map(tal => (
                          <div key={tal.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-500 transition-all group relative">
                            <div className="flex justify-between items-start mb-3">
                                <p className="font-black text-slate-800 text-sm uppercase tracking-tighter">🌲 {tal.nome}</p>
                                <Link href={`/projetos/${projId}/talhao/${tal.id}`} className="text-slate-300 hover:text-emerald-600 transition-colors">
                                    <Settings size={14} />
                                </Link>
                            </div>
                            <div className="flex gap-2">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black">{tal.areaHa} HA</span>
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">{tal.especie}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}