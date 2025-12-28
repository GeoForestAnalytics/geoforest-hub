"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../lib/firebase";  
import { doc, getDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { useLicense } from "../../hooks/useAuthContext"; 
import { 
  BarChart3, 
  Ruler, 
  ArrowLeft, 
  Settings, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  ListChecks,
  TreeDeciduous,
  Axe,
  Calculator // ✅ Novo ícone para o Processamento
} from "lucide-react";

export default function DetalhesProjeto() {
  const params = useParams(); 
  const router = useRouter();
  const projId = params.id as string;
  
  const { licenseId, loading: authLoading } = useLicense();

  const [projeto, setProjeto] = useState<any>(null);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [amostras, setAmostras] = useState<any[]>([]); 
  const [cubagens, setCubagens] = useState<any[]>([]); 
  const [loadingData, setLoadingData] = useState(true);

  // O estado guarda strings no formato "ID_ATIVIDADE-ID_FAZENDA" para evitar bugs de duplicidade
  const [fazendasMinimizadas, setFazendasMinimizadas] = useState<string[]>([]);

  useEffect(() => {
    if (!licenseId) return;

    const carregarHierarquia = async () => {
      try {
        const docRef = doc(db, `clientes/${licenseId}/projetos`, projId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProjeto(docSnap.data());
        }

        const unsubAtiv = onSnapshot(query(
          collection(db, `clientes/${licenseId}/atividades`), 
          where("projetoId", "in", [projId, Number(projId)])
        ), (snap) => {
          setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubFaz = onSnapshot(collection(db, `clientes/${licenseId}/fazendas`), (snap) => {
          setFazendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubTal = onSnapshot(collection(db, `clientes/${licenseId}/talhoes`), (snap) => {
          setTalhoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubAmo = onSnapshot(query(
          collection(db, `clientes/${licenseId}/dados_coleta`), 
          where("projetoId", "in", [projId, Number(projId)])
        ), (snap) => {
          setAmostras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubCub = onSnapshot(query(collection(db, `clientes/${licenseId}/dados_cubagem`)), (snap) => {
          setCubagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        setLoadingData(false);

        return () => {
          unsubAtiv();
          unsubFaz();
          unsubTal();
          unsubAmo();
          unsubCub();
        };
      } catch (error) {
        console.error("Erro na hierarquia:", error);
        setLoadingData(false);
      }
    };

    carregarHierarquia();
  }, [projId, licenseId]);

  const toggleFazenda = (ativId: string, fazendaId: string) => {
    const chave = `${ativId}-${fazendaId}`;
    setFazendasMinimizadas(prev => 
      prev.includes(chave) 
        ? prev.filter(id => id !== chave) 
        : [...prev, chave]
    );
  };

  if (authLoading || loadingData) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Sincronizando Hierarquia...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <nav className="mb-6">
        <Link href="/projetos" className="text-xs font-bold text-slate-400 uppercase hover:text-emerald-600 flex items-center gap-1 transition-colors">
          <ArrowLeft size={14} /> Voltar para Projetos
        </Link>
      </nav>

      <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 block">Empresa: {projeto?.empresa}</span>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter uppercase">{projeto?.nome}</h1>
          <p className="text-slate-500 font-medium italic">Responsável: {projeto?.responsavel}</p>
        </div>

        <div className="flex gap-3">
          <Link href={`/projetos/${projId}/analise`} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20">
            <BarChart3 size={18} /> Auditoria QA/QC
          </Link>

          {/* ✅ NOVO BOTÃO: PROCESSAMENTO BIG DATA */}
          <Link href={`/projetos/${projId}/processamento`} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20">
            <Calculator size={18} /> Processamento Big Data
          </Link>

          <Link href={`/projetos/${projId}/cubagem`} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
            <Ruler size={18} className="text-emerald-400" /> Cubagem Rigorosa
          </Link>
        </div>
      </div>

      <div className="space-y-10">
        {atividades.map((ativ) => {
          const isCUB = ativ.tipo.toUpperCase().includes("CUB");
          const fazendasDestaAtividade = fazendas.filter(f => f.activityId === ativ.id || f.atividadeId === ativ.id);

          if (fazendasDestaAtividade.length === 0) return null;

          return (
            <div key={ativ.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-900 p-5 px-8 flex justify-between items-center">
                <h2 className="text-white font-black uppercase text-sm tracking-widest">
                  Atividade: <span className="text-emerald-400">{ativ.tipo}</span>
                </h2>
                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{ativ.metodoCubagem || "Inventário"}</span>
              </div>

              <div className="p-8 space-y-8">
                {fazendasDestaAtividade.map(faz => {
                  const chaveFazenda = `${ativ.id}-${faz.id}`;
                  const isMinimizada = fazendasMinimizadas.includes(chaveFazenda);
                  const talhoesDestaFazenda = talhoes.filter(t => t.fazendaId === faz.id);
                  
                  return (
                    <div key={faz.id} className="space-y-4">
                      <div onClick={() => toggleFazenda(ativ.id, faz.id)} className="flex items-center justify-between cursor-pointer group bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-emerald-500/20 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                          <span className="text-sm font-black text-slate-800 uppercase tracking-tight">🏠 Fazenda: {faz.nome}</span>
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><MapPin size={10} /> {faz.municipio || "Localização N/I"}</span>
                        </div>
                        {isMinimizada ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronUp size={20} className="text-slate-400" />}
                      </div>
                      
                      {!isMinimizada && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pl-4">
                          {talhoesDestaFazenda.map(tal => {
                            let total = 0;
                            let concluidas = 0;
                            let label = "Amostras";
                            let Icon = ListChecks;
                            let urlAjuste = `/projetos/${projId}/talhao/${tal.id}`;

                            if (isCUB) {
                                urlAjuste = `/projetos/${projId}/talhao/${tal.id}/cubagem`;
                                label = "Árvores";
                                Icon = Axe;
                                const dadosTalhao = cubagens.filter(c => String(c.talhaoId) === String(tal.id));
                                total = dadosTalhao.length;
                                concluidas = dadosTalhao.filter(c => Number(c.alturaTotal) > 0).length;
                            } else {
                                const dadosTalhao = amostras.filter(a => String(a.talhaoId) === String(tal.id));
                                total = dadosTalhao.length;
                                concluidas = dadosTalhao.filter(a => a.status === 'concluida' || a.status === 'exportada').length;
                            }

                            const porcentagem = total > 0 ? (concluidas / total) * 100 : 0;

                            return (
                              <div key={tal.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-500 transition-all group relative">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                      <TreeDeciduous size={16} className="text-emerald-600" />
                                      <p className="font-black text-slate-800 text-sm uppercase tracking-tighter">{tal.nome}</p>
                                    </div>
                                    <Link href={urlAjuste} className="text-slate-300 hover:text-emerald-600 transition-colors">
                                        <Settings size={14} />
                                    </Link>
                                </div>
                                
                                <div className="space-y-3">
                                  <div className="flex gap-2">
                                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black">{tal.areaHa || "0"} HA</span>
                                      <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">{tal.especie || "N/I"}</span>
                                  </div>

                                  <div className="pt-2 border-t border-slate-50">
                                    <div className="flex justify-between items-end mb-1">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                        <Icon size={12} /> {label}
                                      </span>
                                      <span className="text-[10px] font-black text-slate-700">
                                        {concluidas}/{total}
                                      </span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-500 ${porcentagem === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                        style={{ width: `${porcentagem}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}