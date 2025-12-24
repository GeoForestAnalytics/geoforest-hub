"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";  
import { doc, getDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";

export default function DetalhesProjeto() {
  const params = useParams(); 
  const router = useRouter();
  const projId = params.id as string;
  
  const [projeto, setProjeto] = useState<any>(null);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ESTADO PARA MINIMIZAR FAZENDAS (Guarda os IDs das fazendas que estão visíveis)
  const [fazendasAbertas, setFazendasAbertas] = useState<Set<string>>(new Set());

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
            const listaFazendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setFazendas(listaFazendas);
            
            // Opcional: Iniciar todas as fazendas como "abertas"
            setFazendasAbertas(new Set(listaFazendas.map(f => f.id)));
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

  // FUNÇÃO PARA ABRIR/FECHAR FAZENDA
  const toggleFazenda = (fazId: string) => {
    const novasAbertas = new Set(fazendasAbertas);
    if (novasAbertas.has(fazId)) {
      novasAbertas.delete(fazId);
    } else {
      novasAbertas.add(fazId);
    }
    setFazendasAbertas(novasAbertas);
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-emerald-600 font-bold">Carregando Ecossistema Florestal...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      
      {/* NAVEGAÇÃO / BREADCRUMB */}
      <nav className="flex gap-2 text-xs font-bold text-slate-400 uppercase mb-4">
        <Link href="/projetos" className="hover:text-emerald-600">Projetos</Link>
        <span>/</span>
        <span className="text-slate-900">{projeto?.nome || "Projeto"}</span>
      </nav>

      {/* HEADER DO PROJETO */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-8">
        <h1 className="text-4xl font-black text-slate-900 mb-2">{projeto?.nome}</h1>
        <p className="text-slate-500 font-medium">
          Cliente: <span className="text-slate-800">{projeto?.empresa}</span> | 
          Responsável: <span className="text-slate-800">{projeto?.responsavel}</span>
        </p>
      </div>

      <div className="space-y-8">
        {atividades.map((ativ) => (
          <div key={ativ.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-900 p-4 px-8 flex justify-between items-center">
              <h2 className="text-white font-bold">Atividade: {ativ.tipo}</h2>
              <span className="text-[10px] text-emerald-400 font-black tracking-widest uppercase opacity-50">ID: {ativ.id}</span>
            </div>

            <div className="p-6 space-y-6">
              {fazendas
                .filter(f => String(f.atividadeId) === String(ativ.id))
                .map(faz => {
                  const aberto = fazendasAbertas.has(faz.id);
                  const talhoesDaFazenda = talhoes.filter(t => 
                    String(t.fazendaId) === String(faz.id) && 
                    String(t.fazendaAtividadeId) === String(ativ.id)
                  );

                  return (
                    <div key={faz.id} className="border-l-4 border-emerald-500 pl-6 space-y-4">
                      {/* HEADER DA FAZENDA (CLICÁVEL PARA MINIMIZAR) */}
                      <div 
                        className="flex items-center justify-between group cursor-pointer"
                        onClick={() => toggleFazenda(faz.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800 uppercase">🏠 Fazenda: {faz.nome}</span>
                          <span className="text-[10px] text-slate-400">({faz.municipio || "N/I"} - {faz.estado || "UF"})</span>
                        </div>
                        <div className="text-slate-400 group-hover:text-emerald-500 transition-colors">
                            {aberto ? (
                                <span className="text-xs font-bold uppercase">Minimizar ▲</span>
                            ) : (
                                <span className="text-xs font-bold uppercase">Expandir ({talhoesDaFazenda.length}) ▼</span>
                            )}
                        </div>
                      </div>

                      {/* LISTA DE TALHÕES (CONDICIONAL) */}
                      {aberto && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          {talhoesDaFazenda.length > 0 ? (
                            talhoesDaFazenda.map(tal => (
                              <div key={tal.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all group">
                                <p className="font-bold text-slate-800 text-sm group-hover:text-emerald-700">🌲 {tal.nome}</p>
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {tal.areaHa || 0} ha | {tal.especie || 'N/D'}
                                  </span>
                                  
                                  {/* BOTÃO VER DADOS (LINK FUNCIONAL) */}
                                  <Link 
                                    href={`/projetos/${projId}/talhao/${tal.id}`}
                                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white text-[9px] font-black px-2 py-1 rounded transition-colors"
                                  >
                                    VER DADOS
                                  </Link>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Nenhum talhão encontrado.</p>
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