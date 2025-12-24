"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";  
import { doc, getDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { 
  BarChart2, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  TreeDeciduous, 
  LayoutDashboard, 
  Ruler 
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

  // ESTADO PARA MINIMIZAR FAZENDAS
  const [fazendasAbertas, setFazendasAbertas] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const uid = user.uid;

        try {
          // 1. BUSCA O PROJETO
          const docRef = doc(db, `clientes/${uid}/projetos`, projId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setProjeto(docSnap.data());

          // 2. BUSCA ATIVIDADES
          const qAtiv = query(collection(db, `clientes/${uid}/atividades`), where("projetoId", "in", [projId, Number(projId)]));
          onSnapshot(qAtiv, (snap) => {
            setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });

          // 3. BUSCA FAZENDAS
          onSnapshot(collection(db, `clientes/${uid}/fazendas`), (snap) => {
            const listaFazendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setFazendas(listaFazendas);
            setFazendasAbertas(new Set(listaFazendas.map(f => f.id)));
          });

          // 4. BUSCA TALHÕES
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

  const toggleFazenda = (fazId: string) => {
    const novasAbertas = new Set(fazendasAbertas);
    if (novasAbertas.has(fazId)) novasAbertas.delete(fazId);
    else novasAbertas.add(fazId);
    setFazendasAbertas(novasAbertas);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-emerald-600 font-bold">Carregando Ecossistema...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      
      {/* BREADCRUMB */}
      <nav className="flex gap-2 text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">
        <Link href="/projetos" className="hover:text-emerald-600 transition-colors">Projetos</Link>
        <span>/</span>
        <span className="text-slate-900">{projeto?.nome}</span>
      </nav>

      {/* HEADER COM BOTÕES MESTRES */}
      <div className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-sm mb-8 flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="text-center xl:text-left">
          <h1 className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{projeto?.nome}</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2 justify-center xl:justify-start">
            <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">{projeto?.empresa}</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-bold">Responsável: {projeto?.responsavel}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link 
            href={`/projetos/${projId}/analise`}
            className="bg-slate-900 text-emerald-400 px-8 py-5 rounded-[24px] font-black text-sm hover:bg-slate-800 shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-105"
          >
            <BarChart2 size={20} />
            CENTRAL DE AUDITORIA
          </Link>

          <Link 
            href={`/projetos/${projId}/cubagem`}
            className="bg-white border-2 border-slate-900 text-slate-900 px-8 py-5 rounded-[24px] font-black text-sm hover:bg-slate-50 shadow-md flex items-center justify-center gap-3 transition-all hover:scale-105"
          >
            <Ruler size={20} />
            AUDITORIA DE CUBAGEM
          </Link>
        </div>
      </div>

      <div className="space-y-10">
        {atividades.map((ativ) => (
          <div key={ativ.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-slate-900 p-5 px-10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <h2 className="text-white font-black uppercase tracking-tight text-sm">Atividade: {ativ.tipo}</h2>
              </div>
              <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">ID REF: {ativ.id}</span>
            </div>

            <div className="p-8 space-y-8">
              {fazendas
                .filter(f => String(f.atividadeId) === String(ativ.id))
                .map(faz => {
                  const isAberto = fazendasAbertas.has(faz.id);
                  const talhoesDaFazenda = talhoes.filter(t => 
                    String(t.fazendaId) === String(faz.id) && 
                    String(t.fazendaAtividadeId) === String(ativ.id)
                  );

                  return (
                    <div key={faz.id} className="border-l-4 border-emerald-500 pl-8 space-y-6">
                      <div 
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => toggleFazenda(faz.id)}
                      >
                        <div className="flex items-center gap-3">
                          <MapPin size={18} className="text-emerald-600" />
                          <div>
                            <span className="text-base font-black text-slate-800 uppercase tracking-tight">Fazenda: {faz.nome}</span>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{faz.municipio} - {faz.estado}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-3 py-1 rounded-full">
                                {talhoesDaFazenda.length} Talhões
                            </span>
                            {isAberto ? <ChevronUp size={20} className="text-slate-300" /> : <ChevronDown size={20} className="text-slate-300" />}
                        </div>
                      </div>

                      {isAberto && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                          {talhoesDaFazenda.length > 0 ? (
                            talhoesDaFazenda.map(tal => (
                              <div key={tal.id} className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 hover:border-emerald-300 hover:bg-white hover:shadow-xl transition-all group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-emerald-100 p-2 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                        <TreeDeciduous size={20} />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-300 uppercase">T-ID: {tal.id}</span>
                                </div>
                                
                                <p className="font-black text-slate-800 text-lg mb-1">{tal.nome}</p>
                                <p className="text-xs font-bold text-slate-400 uppercase mb-6">{tal.areaHa || 0} ha • {tal.especie || 'N/D'}</p>

                                {/* AQUI ESTÁ A MUDANÇA: O LINK AGORA É DINÂMICO */}
                                <Link 
                                  href={`/projetos/${projId}/talhao/${tal.id}${ativ.tipo.includes('CUB') ? '/cubagem' : ''}`}
                                  className="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-emerald-400 hover:border-slate-900 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                  <LayoutDashboard size={14} />
                                  Ver Planilha de Dados
                                </Link>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-full p-10 bg-slate-100/50 rounded-[24px] border-2 border-dashed border-slate-200 text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase">Nenhum talhão registrado.</p>
                            </div>
                          )}
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