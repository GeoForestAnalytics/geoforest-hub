"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { useLicense } from "@/app/hooks/useAuthContext";
import { 
  Calculator, Layers, Trees, Microscope, FileText, 
  ChevronRight, Play, Database, Plus, Trash2, Sigma,
  ArrowLeft, MapPin, Info, Ruler, Scissors, BarChart3, PieChart as PieIcon, 
  RefreshCw, CheckCircle, ListChecks, AlertTriangle
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

// --- TIPAGENS ---
interface Sortimento {
  id: string;
  nome: string;
  min: number;
}

interface Estrato {
  id: string;
  nome: string;
  talhoesIds: string[];
  formulaVolume: "Schumacher-Hall" | "Polinomial-5";
  b: string[]; 
  sortimentos: Sortimento[];
  hToco: number;
}

export default function ProcessamentoDendrometrico() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;
  const { licenseId } = useLicense();

  // Estados de Dados
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [estratos, setEstratos] = useState<Estrato[]>([]);
  const [estratoAtivoId, setEstratoAtivoId] = useState<string | null>(null);
  
  // Interface
  const [loading, setLoading] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"selecao" | "modelagem" | "resultados">("selecao");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<any>(null);

  // 1. Carregar apenas talhões que possuem dados reais
  useEffect(() => {
    if (!licenseId) return;
    const fetchDadosValidos = async () => {
      const [amostrasSnap, cubagensSnap, fazendasSnap, talhoesSnap] = await Promise.all([
        getDocs(query(collection(db, `clientes/${licenseId}/dados_coleta`), where("projetoId", "in", [projId, Number(projId)]))),
        getDocs(collection(db, `clientes/${licenseId}/dados_cubagem`)),
        getDocs(collection(db, `clientes/${licenseId}/fazendas`)),
        getDocs(collection(db, `clientes/${licenseId}/talhoes`))
      ]);

      const idsComAmostra = new Set(amostrasSnap.docs.map(d => String(d.data().talhaoId)));
      const idsComCubagem = new Set(cubagensSnap.docs.map(d => String(d.data().talhaoId)));

      const listaTalhoes = talhoesSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fazendaId: data.fazendaId, // Garantindo a propriedade explicitamente para o TS
          temAmostra: idsComAmostra.has(String(d.id)),
          temCubagem: idsComCubagem.has(String(d.id))
        };
      }).filter(t => t.temAmostra || t.temCubagem);

      const fazendasIdsValidos = new Set(listaTalhoes.map(t => t.fazendaId));
      const listaFazendas = fazendasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(f => fazendasIdsValidos.has(f.id));

      setTalhoes(listaTalhoes);
      setFazendas(listaFazendas);
    };
    fetchDadosValidos();
  }, [licenseId, projId]);

  useEffect(() => {
    if (!currentJobId || !licenseId) return;
    const unsub = onSnapshot(doc(db, `clientes/${licenseId}/processamentos`, currentJobId), (snap) => {
      const data = snap.data();
      if (data?.status === "concluido") {
        setJobResult(data);
        setLoading(false);
        setAbaAtiva("resultados");
      }
    });
    return () => unsub();
  }, [currentJobId, licenseId]);

  const adicionarEstrato = () => {
    const novo: Estrato = {
      id: Math.random().toString(36).substr(2, 9),
      nome: `Estrato ${estratos.length + 1}`,
      talhoesIds: [],
      formulaVolume: "Polinomial-5",
      b: ["", "", "", "", "", ""],
      sortimentos: [
        { id: '1', nome: "Serraria", min: 25 },
        { id: '2', nome: "Celulose", min: 8 }
      ],
      hToco: 0.10
    };
    setEstratos([...estratos, novo]);
    setEstratoAtivoId(novo.id);
  };

  const addSortimento = (estId: string) => {
    setEstratos(prev => prev.map(e => e.id === estId ? {
      ...e, sortimentos: [...e.sortimentos, { id: Math.random().toString(), nome: "Nova Classe", min: 0 }]
    } : e));
  };

  const vincularTalhao = (talhaoId: string) => {
    if (!estratoAtivoId) return alert("Selecione um Estrato na esquerda.");
    setEstratos(prev => prev.map(est => {
      if (est.id === estratoAtivoId) {
        const jaTem = est.talhoesIds.includes(talhaoId);
        return { ...est, talhoesIds: jaTem ? est.talhoesIds.filter(id => id !== talhaoId) : [...est.talhoesIds, talhaoId] };
      }
      return { ...est, talhoesIds: est.talhoesIds.filter(id => id !== talhaoId) };
    }));
  };

  const dispararProcessamento = async () => {
    if (estratos.length === 0 || estratos.some(e => e.talhoesIds.length === 0)) return alert("Configure os estratos corretamente.");
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, `clientes/${licenseId}/processamentos`), {
        projetoId: projId,
        status: "pendente",
        estratos: estratos,
        dataSolicitacao: serverTimestamp()
      });
      setCurrentJobId(docRef.id);
    } catch (e) { console.error(e); setLoading(false); }
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#64748b'];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-slate-900 p-6 text-white flex justify-between items-center shadow-2xl shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ArrowLeft size={20}/></button>
          <h1 className="text-xl font-black uppercase tracking-tighter text-emerald-400">Processamento Big Data</h1>
        </div>
        
        <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700">
          <button onClick={() => setAbaAtiva("selecao")} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${abaAtiva === "selecao" ? "bg-emerald-50 text-slate-900 shadow-lg" : "text-slate-500"}`}>1. Seleção</button>
          <button onClick={() => setAbaAtiva("modelagem")} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${abaAtiva === "modelagem" ? "bg-emerald-50 text-slate-900 shadow-lg" : "text-slate-500"}`}>2. Modelagem</button>
          <button onClick={() => setAbaAtiva("resultados")} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${abaAtiva === "resultados" ? "bg-emerald-50 text-slate-900 shadow-lg" : "text-slate-500"}`}>3. Resultados</button>
        </div>

        <button onClick={dispararProcessamento} disabled={loading || estratos.length === 0} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
          {loading ? <RefreshCw className="animate-spin" size={16}/> : <Play size={16}/>} RODAR PROCESSAMENTO
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {abaAtiva === "selecao" && (
          <div className="h-full flex gap-6 p-6">
            <div className="w-80 flex flex-col gap-4">
               <button onClick={adicionarEstrato} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-3xl text-slate-400 font-bold hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-center gap-2"><Plus size={18}/> Novo Estrato</button>
               <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                  {estratos.map(est => (
                    <div key={est.id} onClick={() => setEstratoAtivoId(est.id)} className={`p-4 rounded-3xl border-2 transition-all cursor-pointer relative ${estratoAtivoId === est.id ? "bg-slate-900 border-emerald-500 shadow-xl" : "bg-white border-slate-100"}`}>
                      <p className={`font-black uppercase text-xs ${estratoAtivoId === est.id ? "text-white" : "text-slate-800"}`}>{est.nome}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{est.talhoesIds.length} Talhões Vinculados</p>
                      <button onClick={(e) => { e.stopPropagation(); setEstratos(estratos.filter(x => x.id !== est.id)); }} className="absolute top-2 right-2 text-red-400 hover:scale-110 transition-transform"><Trash2 size={14}/></button>
                    </div>
                  ))}
               </div>
            </div>

            <div className="flex-1 bg-white rounded-[40px] border border-slate-200 p-8 overflow-y-auto shadow-inner custom-scrollbar">
                {fazendas.map(faz => (
                  <div key={`${faz.id}-${faz.atividadeId}`} className="mb-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2 border-b pb-2"><MapPin size={12}/> {faz.nome}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {talhoes.filter(t => t.fazendaId === faz.id).map(tal => {
                        const noEstrato = estratos.find(e => e.talhoesIds.includes(tal.id));
                        const isNoAtivo = noEstrato?.id === estratoAtivoId;
                        return (
                          <div key={tal.id} onClick={() => vincularTalhao(tal.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer text-center relative ${isNoAtivo ? "bg-emerald-500 border-emerald-600 shadow-md scale-105 z-10" : noEstrato ? "bg-slate-200 opacity-40" : "bg-slate-50 border-slate-100 hover:border-emerald-300"}`}>
                             <p className={`font-black text-[10px] uppercase ${isNoAtivo ? "text-white" : "text-slate-700"}`}>{tal.nome}</p>
                             <div className="flex justify-center gap-1 mt-2">
                                {tal.temAmostra && <ListChecks size={10} className={isNoAtivo ? "text-white" : "text-emerald-500"} />}
                                {tal.temCubagem && <Ruler size={10} className={isNoAtivo ? "text-white" : "text-blue-500"} />}
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {abaAtiva === "modelagem" && (
           <div className="p-10 h-full overflow-y-auto space-y-10 custom-scrollbar">
              {estratos.map(est => {
                const talhoesDoEst = talhoes.filter(t => est.talhoesIds.includes(t.id));
                const temCubagem = talhoesDoEst.some(t => t.temCubagem);

                return (
                  <div key={est.id} className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-xl grid grid-cols-1 lg:grid-cols-3 gap-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                    <div className="space-y-6">
                      <h3 className="font-black text-slate-900 uppercase tracking-tighter text-xl">{est.nome}</h3>
                      <div className={`p-4 rounded-2xl flex items-center gap-3 ${temCubagem ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-amber-50 text-amber-700 border border-amber-100"}`}>
                        {temCubagem ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
                        <p className="text-[10px] font-bold uppercase">{temCubagem ? "Cubagem Real Disponível" : "Sem Cubagem (Usando Fallback)"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         {["b0", "b1", "b2", "b3", "b4", "b5"].map((coef, idx) => (
                           <div key={coef}>
                             <label className="text-[9px] font-black text-slate-400 uppercase ml-2">{coef}</label>
                             <input type="number" value={est.b[idx]} onChange={(e) => setEstratos(prev => prev.map(x => x.id === est.id ? { ...x, b: x.b.map((v, i) => i === idx ? e.target.value : v) } : x))} className="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs border-none" placeholder="0.0000" />
                           </div>
                         ))}
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="font-black text-[10px] uppercase text-slate-400">Classes de Toras</h4>
                        <button onClick={() => addSortimento(est.id)} className="text-blue-500 hover:scale-110 transition-transform"><Plus size={16}/></button>
                      </div>
                      <div className="space-y-3">
                         {est.sortimentos.map((s, idx) => (
                           <div key={s.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                             <input className="flex-1 bg-transparent text-[11px] font-bold outline-none text-slate-800" value={s.nome} onChange={e => setEstratos(prev => prev.map(estItem => estItem.id === est.id ? {...estItem, sortimentos: estItem.sortimentos.map((si, i) => i === idx ? {...si, nome: e.target.value} : si)} : estItem))}/>
                             <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border">
                                <span className="text-[8px] font-black text-slate-400 uppercase">min</span>
                                <input type="number" className="w-10 text-[11px] font-black text-slate-800 outline-none" value={s.min} onChange={e => setEstratos(prev => prev.map(estItem => estItem.id === est.id ? {...estItem, sortimentos: estItem.sortimentos.map((si, i) => i === idx ? {...si, min: Number(e.target.value)} : si)} : estItem))}/>
                                <span className="text-[8px] text-slate-400 font-bold uppercase">cm</span>
                             </div>
                             <button onClick={() => setEstratos(prev => prev.map(e => e.id === est.id ? {...e, sortimentos: e.sortimentos.filter(x => x.id !== s.id)} : e))} className="text-red-300 hover:text-red-500"><Trash2 size={12}/></button>
                           </div>
                         ))}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[40px] flex flex-col justify-center space-y-4 text-slate-900">
                       <h4 className="font-black text-[10px] uppercase text-slate-400">Resíduos e Perdas</h4>
                       <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Altura do Toco (m)</label>
                          <input type="number" value={est.hToco} onChange={e => setEstratos(prev => prev.map(x => x.id === est.id ? {...x, hToco: Number(e.target.value)} : x))} className="w-full p-4 rounded-2xl border-none bg-white font-black text-slate-800 shadow-inner" />
                       </div>
                       <p className="text-[9px] text-slate-400 italic leading-relaxed text-center">Tocos e ponteiras serão calculados automaticamente.</p>
                    </div>
                  </div>
                );
              })}
           </div>
        )}

        {abaAtiva === "resultados" && (
           <div className="p-8 h-full overflow-y-auto custom-scrollbar">
              {!jobResult ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                   <BarChart3 size={64} className="mb-4 opacity-10 animate-pulse"/>
                   <p className="font-black uppercase tracking-widest text-sm">Calculando volumes em Python...</p>
                </div>
              ) : (
                <div className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl border-b-4 border-emerald-500">
                         <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Volume Total Comercial</p>
                         <h2 className="text-4xl font-black mt-2">{jobResult.resultados.reduce((a:any, b:any) => a + b.volume_total_m3, 0).toFixed(1)} m³</h2>
                      </div>
                      {jobResult.resultados.map((r:any, i:number) => (
                        <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
                            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{r.estrato}</p>
                            <h3 className="text-2xl font-black text-slate-800 mt-2">{r.volume_medio_ha} <span className="text-xs text-slate-400">m³/ha</span></h3>
                            <p className={`text-[9px] font-black mt-3 uppercase ${r.erro_amostragem_perc > 10 ? "text-red-500" : "text-emerald-500"}`}>Erro: {r.erro_amostragem_perc}%</p>
                        </div>
                      ))}
                   </div>
                   <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm h-[450px]">
                      <h3 className="text-sm font-black text-slate-800 uppercase mb-8 flex items-center gap-2"><PieIcon size={18} className="text-emerald-500"/> Distribuição Volumétrica por Classe</h3>
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie 
                               data={Object.entries(jobResult.resultados[0]?.sortimentos || {}).map(([name, value]) => ({ name, value }))} 
                               dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5}
                            >
                               {COLORS.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={37}/>
                         </PieChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              )}
           </div>
        )}
      </main>
    </div>
  );
}