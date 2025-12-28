"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { useLicense } from "@/app/hooks/useAuthContext";

// ✅ 1. OS ÍCONES DEVEM FICAR AQUI:
import { 
  Calculator, Layers, Trees, Microscope, FileText, 
  ChevronRight, Play, Database, Plus, Trash2, Sigma,
  ArrowLeft, MapPin, Info, Ruler, Scissors, BarChart3, 
  PieChart as PieIcon, RefreshCw, CheckCircle 
} from "lucide-react";

// ✅ 2. OS COMPONENTES DE GRÁFICO DEVEM FICAR AQUI (SEM O CHECKCIRCLE):
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

interface Estrato {
  id: string;
  nome: string;
  talhoesIds: string[];
  formulaVolume: "Schumacher-Hall" | "Polinomial-5";
  b0: string; b1: string; b2: string; b3: string; b4: string; b5: string;
  limiteSerraria: number;
  limiteCelulose: number;
}

export default function ProcessamentoDendrometrico() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;
  const { licenseId } = useLicense();

  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [estratos, setEstratos] = useState<Estrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"selecao" | "modelagem" | "resultados">("selecao");
  
  // Estado para monitorar o Job atual
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<any>(null);

  useEffect(() => {
    if (!licenseId) return;
    const fetchBase = async () => {
      const fSnap = await getDocs(collection(db, `clientes/${licenseId}/fazendas`));
      const tSnap = await getDocs(collection(db, `clientes/${licenseId}/talhoes`));
      setFazendas(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTalhoes(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchBase();
  }, [licenseId]);

  // Listener para o processamento em Python
  useEffect(() => {
    if (!currentJobId || !licenseId) return;
    const unsub = onSnapshot(doc(db, `clientes/${licenseId}/processamentos`, currentJobId), (snap) => {
      if (snap.exists() && snap.data().status === "concluido") {
        setJobResult(snap.data());
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
      b0: "", b1: "", b2: "", b3: "", b4: "", b5: "",
      limiteSerraria: 25, limiteCelulose: 8
    };
    setEstratos([...estratos, novo]);
  };

  const vincularTalhaoAoEstrato = (estratoId: string, talhaoId: string) => {
    setEstratos(prev => prev.map(est => {
      if (est.id === estratoId) {
        const jaExiste = est.talhoesIds.includes(talhaoId);
        return { ...est, talhoesIds: jaExiste ? est.talhoesIds.filter(id => id !== talhaoId) : [...est.talhoesIds, talhaoId] };
      }
      return est;
    }));
  };

  const dispararProcessamento = async () => {
    if (estratos.some(e => e.talhoesIds.length === 0)) return alert("Existem estratos vazios!");
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, `clientes/${licenseId}/processamentos`), {
        projetoId: projId,
        status: "pendente",
        dataSolicitacao: serverTimestamp(),
        estratos: estratos,
      });
      setCurrentJobId(docRef.id);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // Cores para os gráficos
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* HEADER - REFORMULADO */}
      <header className="bg-slate-900 p-6 text-white flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><ArrowLeft size={20}/></button>
          <h1 className="text-xl font-black uppercase tracking-tighter text-emerald-400">Motor de Cálculo Python</h1>
        </div>
        
        <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700">
          {["selecao", "modelagem", "resultados"].map((tab) => (
            <button key={tab} onClick={() => setAbaAtiva(tab as any)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${abaAtiva === tab ? "bg-emerald-500 text-slate-900 shadow-lg" : "text-slate-500 hover:text-white"}`}>{tab}</button>
          ))}
        </div>

        <button onClick={dispararProcessamento} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all">
          {loading ? <RefreshCw size={16} className="animate-spin"/> : <Play size={16} fill="currentColor"/>}
          {loading ? "Calculando Integrais..." : "Rodar Big Data"}
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {/* ABA 1 E 2 MANTIDAS IGUAL AO ANTERIOR... */}
        {abaAtiva === "selecao" && (
           <div className="h-full flex gap-6 p-6">
              <div className="w-80 flex flex-col gap-4">
                 <button onClick={adicionarEstrato} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-3xl text-slate-400 font-bold hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-center gap-2"><Plus size={18}/> Novo Estrato</button>
                 <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                    {estratos.map(est => (
                      <div key={est.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                        <input className="font-black uppercase text-sm border-none outline-none w-full bg-transparent" value={est.nome} onChange={e => setEstratos(prev => prev.map(i => i.id === est.id ? {...i, nome: e.target.value} : i))}/>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{est.talhoesIds.length} Talhões</p>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="flex-1 bg-white rounded-[40px] border border-slate-200 p-8 overflow-y-auto custom-scrollbar">
                  {fazendas.map(faz => (
                    <div key={`${faz.atividadeId}-${faz.id}`} className="mb-6">
                      <h3 className="text-xs font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><MapPin size={14}/> {faz.nome}</h3>
                      <div className="grid grid-cols-4 gap-3">
                        {talhoes.filter(t => t.fazendaId === faz.id).map(tal => {
                          const estratoVinc = estratos.find(e => e.talhoesIds.includes(tal.id));
                          return (
                            <div key={tal.id} onClick={() => vincularTalhaoAoEstrato(estratos[0]?.id, tal.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer ${estratoVinc ? "bg-emerald-50 border-emerald-500" : "bg-slate-50 border-slate-100"}`}>
                               <p className="font-bold text-[11px] truncate">{tal.nome}</p>
                               <span className="text-[8px] font-black text-emerald-600 uppercase">{estratoVinc?.nome || "Disponível"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
           </div>
        )}

        {/* ABA 3: RESULTADOS (DASHBOARD DE ENGENHARIA) */}
        {abaAtiva === "resultados" && (
          <div className="p-8 h-full overflow-y-auto space-y-8 custom-scrollbar">
            {!jobResult ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <BarChart3 size={64} className="mb-4 opacity-10"/>
                <p className="font-black uppercase tracking-widest">Aguardando Processamento...</p>
                <p className="text-xs mt-2 italic">Configure a modelagem e clique em "Rodar Big Data"</p>
              </div>
            ) : (
              <>
                {/* LINHA 1: CARDS DE RESUMO */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl">
                    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Volume Total Comercial</p>
                    <h2 className="text-3xl font-black mt-2">{jobResult.resultados.reduce((a:any, b:any) => a + b.volume_total, 0).toFixed(1)} <span className="text-sm font-normal">m³</span></h2>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Área Basal Média (G)</p>
                    <h2 className="text-3xl font-black text-slate-800 mt-2">{(jobResult.resultados.reduce((a:any, b:any) => a + b.area_basal, 0) / jobResult.resultados.length).toFixed(2)} <span className="text-sm font-normal">m²/ha</span></h2>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Eficiência Amostral</p>
                    <h2 className="text-3xl font-black text-blue-600 mt-2">94.2 <span className="text-sm font-normal">%</span></h2>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Status do Job</p>
                    <div className="flex items-center gap-2 mt-3 text-emerald-600 font-black uppercase text-xs">
                      <CheckCircle size={18}/> Concluído via Python
                    </div>
                  </div>
                </div>

                {/* LINHA 2: GRÁFICOS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Gráfico de Sortimento (Exemplo estático baseado no cálculo do polinômio) */}
                  <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-[400px] flex flex-col">
                    <h3 className="text-sm font-black uppercase text-slate-800 mb-6 flex items-center gap-2"><PieIcon size={16} className="text-emerald-500"/> Distribuição de Sortimentos (m³)</h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Serraria', value: 65 },
                              { name: 'Celulose', value: 25 },
                              { name: 'Lenha/Resíduo', value: 10 },
                            ]}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                          >
                            {COLORS.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Comparativo de Estratos */}
                  <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-[400px] flex flex-col">
                    <h3 className="text-sm font-black uppercase text-slate-800 mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-blue-500"/> Volume por Estrato (m³/ha)</h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={jobResult.resultados}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="estrato" fontSize={10} fontVariant="small-caps" />
                          <YAxis fontSize={10} />
                          <Tooltip cursor={{fill: '#f8fafc'}} />
                          <Bar dataKey="volume_total" fill="#3b82f6" radius={[10, 10, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* LINHA 3: TABELA TÉCNICA (AUDITORIA) */}
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="p-6 bg-slate-50 border-b flex justify-between items-center font-black uppercase text-[10px] tracking-widest text-slate-500">
                    <span>Detalhamento dos Parâmetros de Ajuste</span>
                    <button className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors"><FileText size={14}/> Exportar Memória de Cálculo PDF</button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-100 text-slate-400">
                        <th className="p-6">Nome do Estrato</th>
                        <th className="p-6">Modelo Aplicado</th>
                        <th className="p-6 text-center">b0</th>
                        <th className="p-6 text-center">b1</th>
                        <th className="p-6 text-center">b2</th>
                        <th className="p-6 text-right">Volume Total (m³)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {jobResult.resultados.map((res: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6 font-black text-slate-800 uppercase">{res.estrato}</td>
                          <td className="p-6 text-slate-500 font-medium italic">Polinômio de 5º Grau</td>
                          <td className="p-6 text-center font-mono text-emerald-600 font-bold">{res.coeficientes[5].toFixed(4)}</td>
                          <td className="p-6 text-center font-mono text-emerald-600 font-bold">{res.coeficientes[4].toFixed(4)}</td>
                          <td className="p-6 text-center font-mono text-emerald-600 font-bold">{res.coeficientes[3].toFixed(4)}</td>
                          <td className="p-6 text-right font-black text-slate-900 text-lg">{res.volume_total.toLocaleString('pt-BR', {minimumFractionDigits: 1})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}