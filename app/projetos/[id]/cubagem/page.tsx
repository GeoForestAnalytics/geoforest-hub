"use client"
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ArrowLeft,
  Ruler,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TreeDeciduous,
  Download,
  Layers,
  Search
} from "lucide-react";

interface Secao {
  alturaMedicao: number;
  circunferencia: number;
  diametro: number;
}

interface CubagemAuditada {
  id: string;
  identificador: string;
  classe: string;
  cap: number;
  altura: number;
  fazenda: string;
  talhao: string;
  status: "OK" | "ERRO";
  secoes: Secao[];
}

export default function AuditoriaCubagem() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;

  // --- INTERFACE ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // --- DADOS ---
  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);

  // --- FILTROS HIERÁRQUICOS ---
  const [atividadeSel, setAtividadeSel] = useState<string>(""); // Filtro mestre
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);

  const [listaCubagem, setListaCubagem] = useState<CubagemAuditada[]>([]);
  const [arvoreSelecionada, setArvoreSelecionada] = useState<CubagemAuditada | null>(null);

  // 1. Carrega apenas a estrutura de CUBAGEM (Remove IPC/IFC da lista de seleção)
  useEffect(() => {
    const carregarEstrutura = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      try {
        const qAtiv = query(collection(db, `clientes/${uid}/atividades`), where("projetoId", "in", [projId, Number(projId)]));
        const ativSnap = await getDocs(qAtiv);

        // Filtra estritamente por CUB
        const atividadesCub = ativSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((a: any) => a.tipo?.toUpperCase().includes("CUB"));

        setAtividades(atividadesCub);

        const fSnap = await getDocs(collection(db, `clientes/${uid}/fazendas`));
        const tSnap = await getDocs(collection(db, `clientes/${uid}/talhoes`));

        setFazendas(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTalhoes(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };
    auth.onAuthStateChanged(user => { if (user) carregarEstrutura(); });
  }, [projId]);

  // --- LÓGICA DE FILTRAGEM PARA A INTERFACE ---
  const fazendasFiltradas = useMemo(() => {
    if (!atividadeSel) return [];
    return fazendas.filter(f => String(f.atividadeId) === atividadeSel);
  }, [fazendas, atividadeSel]);

  const talhoesFiltrados = useMemo(() => {
    if (fazendasSel.length === 0) return [];
    return talhoes.filter(t =>
      fazendasSel.includes(String(t.fazendaId)) &&
      String(t.fazendaAtividadeId) === atividadeSel
    );
  }, [talhoes, fazendasSel, atividadeSel]);

  // --- SELECIONAR TODAS ---
  const handleToggleAllFazendas = () => {
    if (fazendasSel.length === fazendasFiltradas.length) setFazendasSel([]);
    else setFazendasSel(fazendasFiltradas.map(f => f.id));
  };

  const handleToggleAllTalhoes = () => {
    if (talhoesSel.length === talhoesFiltrados.length) setTalhoesSel([]);
    else setTalhoesSel(talhoesFiltrados.map(t => String(t.id)));
  };

  // --- AUDITORIA COM CHUNKING (LIMITE DE 30) ---
  const rodarAuditoriaCubagem = async () => {
    if (talhoesSel.length === 0) return alert("Selecione ao menos um talhão.");

    setLoading(true);
    setStatusMsg("Validando afilamento...");
    const uid = auth.currentUser?.uid;

    try {
      const idsNormalizados = talhoesSel.map(id => Number(id));

      // Divide em pedaços de 30 para o Firestore não dar erro
      const chunks = [];
      for (let i = 0; i < idsNormalizados.length; i += 30) {
        chunks.push(idsNormalizados.slice(i, i + 30));
      }

      const queryPromises = chunks.map(chunk => {
        const q = query(collection(db, `clientes/${uid}/dados_cubagem`), where("talhaoId", "in", chunk));
        return getDocs(q);
      });

      const querySnapshots = await Promise.all(queryPromises);
      const allDocs: any[] = [];
      querySnapshots.forEach(snap => allDocs.push(...snap.docs));

      const temporario: CubagemAuditada[] = [];

      for (const cDoc of allDocs) {
        const c = cDoc.data();
        if (!c.alturaTotal || c.alturaTotal === 0) continue;

        // AJUSTE AQUI: Busca os nomes nas listas de estado caso o documento esteja incompleto
        const infoTalhao = talhoes.find(t => String(t.id) === String(c.talhaoId));
        const infoFazenda = fazendas.find(f => String(f.id) === String(c.fazendaId || infoTalhao?.fazendaId));

        const sSnap = await getDocs(collection(cDoc.ref, "secoes"));
        const secoes = sSnap.docs.map(s => {
          const data = s.data();
          return {
            alturaMedicao: data.alturaMedicao,
            circunferencia: data.circunferencia,
            diametro: data.circunferencia / Math.PI
          } as Secao;
        }).sort((a, b) => a.alturaMedicao - b.alturaMedicao);

        let erroAfilamento = false;
        for (let i = 1; i < secoes.length; i++) {
          if (secoes[i].circunferencia > secoes[i - 1].circunferencia + 0.05) {
            erroAfilamento = true;
            break;
          }
        }

        temporario.push({
          id: cDoc.id,
          identificador: c.identificador,
          classe: c.classe || "N/A",
          cap: Number(c.valorCAP) || 0,
          altura: Number(c.alturaTotal) || 0,
          // Prioriza o nome que vem do documento, senão usa o que achamos na lista, senão "N/A"
          fazenda: c.nomeFazenda || infoFazenda?.nome || "N/A",
          talhao: c.nomeTalhao || infoTalhao?.nome || "N/A",
          status: erroAfilamento ? "ERRO" : "OK",
          secoes: secoes
        });
      }
      setListaCubagem(temporario);
      if (temporario.length > 0) setArvoreSelecionada(temporario[0]);

    } catch (e) {
      console.error(e);
      alert("Erro ao processar dados.");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">

      <aside
        className={`${sidebarOpen ? "w-80" : "w-0"} bg-slate-900 text-white transition-all duration-300 relative flex flex-col shrink-0 overflow-hidden shadow-2xl`}
      >
        <div className="p-6 flex flex-col gap-6 h-full min-w-[300px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 hover:text-white"><ArrowLeft size={12} /> Voltar</button>
            <button onClick={() => setSidebarOpen(false)} className="text-emerald-400 p-1 hover:bg-slate-800 rounded"><ChevronLeft size={20} /></button>
          </div>

          <div className="flex-1 flex flex-col gap-6 overflow-hidden">

            {/* 0. SELETOR DE ATIVIDADE DE CUBAGEM */}
            <div>
              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Layers size={12} /> 0. Tipo de Atividade</label>
              <select
                value={atividadeSel}
                onChange={(e) => {
                  setAtividadeSel(e.target.value);
                  setFazendasSel([]);
                  setTalhoesSel([]);
                }}
                className="w-full mt-2 bg-black/20 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
              >
                <option value="" className="bg-slate-900 text-slate-400">Selecione a Cubagem...</option>
                {atividades.map(a => (
                  <option key={a.id} value={a.id} className="bg-slate-900">{a.tipo.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* 1. FAZENDAS */}
            <div className="flex flex-col h-1/3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">1. Fazendas</label>
                <button onClick={handleToggleAllFazendas} className="text-[9px] font-bold text-emerald-500 uppercase hover:text-emerald-400">[ Todas ]</button>
              </div>
              <div className="flex-1 overflow-y-auto mt-2 border border-slate-800 p-2 rounded-xl bg-black/10">
                {fazendasFiltradas.length > 0 ? (
                  fazendasFiltradas.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-slate-800 rounded cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={fazendasSel.includes(f.id)}
                        onChange={(e) => e.target.checked ? setFazendasSel([...fazendasSel, f.id]) : setFazendasSel(fazendasSel.filter(id => id !== f.id))}
                      />
                      <span className={fazendasSel.includes(f.id) ? "text-emerald-400 font-bold" : "text-slate-400"}>{f.nome}</span>
                    </label>
                  ))
                ) : <p className="text-[9px] text-slate-600 p-2 italic text-center">Selecione uma atividade CUB acima.</p>}
              </div>
            </div>

            {/* 2. TALHÕES */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">2. Talhões</label>
                <button onClick={handleToggleAllTalhoes} className="text-[9px] font-bold text-emerald-500 uppercase hover:text-emerald-400">[ Todas ]</button>
              </div>
              <div className="flex-1 overflow-y-auto mt-2 border border-slate-800 p-2 rounded-xl bg-black/10">
                {talhoesFiltrados.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-[10px] p-1 hover:bg-slate-800 rounded cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      className="accent-emerald-500"
                      checked={talhoesSel.includes(String(t.id))}
                      onChange={(e) => e.target.checked ? setTalhoesSel([...talhoesSel, String(t.id)]) : setTalhoesSel(talhoesSel.filter(id => id !== String(t.id)))}
                    />
                    <span className={talhoesSel.includes(String(t.id)) ? "text-white font-bold" : "text-slate-500"}>{t.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button onClick={rodarAuditoriaCubagem} disabled={loading} className="bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-emerald-400 transition-all disabled:opacity-50">
            {loading ? "Processando..." : "Analisar Cubagem"}
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-50 bg-slate-900 text-emerald-400 p-3 rounded-2xl shadow-2xl border border-emerald-500/30"><ChevronRight size={24} /></button>
      )}

      <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6 relative">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-emerald-600">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-black animate-pulse uppercase tracking-widest text-xs">Sincronizando Seções Técnicas...</p>
          </div>
        ) : listaCubagem.length > 0 ? (
          <>
            {/* GRÁFICO E KPI */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[300px] shrink-0">
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                  <TreeDeciduous size={14} /> Perfil do Fuste: {arvoreSelecionada?.identificador}
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={arvoreSelecionada?.secoes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" dataKey="circunferencia" orientation="top" unit="cm" fontSize={10} />
                      <YAxis type="number" dataKey="alturaMedicao" reversed unit="m" fontSize={10} />
                      <Tooltip />
                      <Area type="monotone" dataKey="circunferencia" stroke="#10b981" fill="#ecfdf5" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl flex flex-col justify-center gap-6">
                <div>
                  <p className="text-emerald-400 text-[10px] font-black uppercase mb-1">Classe Diamétrica</p>
                  <h2 className="text-3xl font-black">{arvoreSelecionada?.classe}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-6">
                  <div>
                    <p className="text-slate-500 text-[9px] font-bold uppercase">CAP Real</p>
                    <p className="text-xl font-bold">{arvoreSelecionada?.cap} cm</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[9px] font-bold uppercase">Alt. Total</p>
                    <p className="text-xl font-bold">{arvoreSelecionada?.altura} m</p>
                  </div>
                </div>
              </div>
            </div>

            {/* TABELA DE RESULTADOS */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-0">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Ruler size={18} className="text-slate-400" />
                  <h3 className="text-sm font-black text-slate-700 uppercase">Lista de Árvores Auditadas</h3>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-white border-b z-10 shadow-sm">
                    <tr className="text-slate-400 font-bold uppercase">
                      <th className="p-4">IDENTIFICADOR</th>
                      <th className="p-4">FAZENDA / TALHÃO</th>
                      <th className="p-4 text-center">CLASSE</th>
                      <th className="p-4 text-center">CAP (cm)</th>
                      <th className="p-4 text-center">ALT (m)</th>
                      <th className="p-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaCubagem.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setArvoreSelecionada(c)}
                        className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${arvoreSelecionada?.id === c.id ? 'bg-emerald-50/50' : ''}`}
                      >
                        <td className="p-4 font-black text-slate-800">{c.identificador}</td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-600 text-[10px] uppercase">{c.fazenda}</span>
                            <span className="text-slate-400 text-[9px] italic">{c.talhao}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-500">{c.classe}</td>
                        <td className="p-4 text-center font-black text-slate-900">{c.cap.toFixed(1)}</td>
                        <td className="p-4 text-center font-bold text-slate-600">{c.altura.toFixed(1)}</td>
                        <td className="p-4">
                          {c.status === 'OK' ? (
                            <span className="text-emerald-500 flex items-center gap-1 font-bold text-[9px] uppercase"><CheckCircle size={12} /> Consistente</span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1 font-bold text-[9px] uppercase"><AlertCircle size={12} /> Revisar</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <Ruler size={64} className="mb-4 opacity-20" />
            <p className="font-black uppercase tracking-widest text-sm text-center">Selecione uma Atividade CUB e os Talhões<br />para validar as medições técnicas</p>
          </div>
        )}
      </main>
    </div>
  );
}