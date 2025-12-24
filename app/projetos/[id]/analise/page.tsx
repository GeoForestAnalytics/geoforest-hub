"use client"
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, Table as TableIcon, BarChart2, Filter, CheckCircle, AlertCircle, Search, ChevronLeft, ChevronRight, GripVertical, Trash2, CheckSquare, Square } from "lucide-react";

interface ArvoreAuditada {
  id: string;
  parcelaDocId: string; 
  fazenda: string;
  talhao: string;
  parcela: string;
  linha: number;
  posicao: number;
  cap: number;
  dap: number;
  altura: number;
  alturaDano: number;
  relacaoHD: number;
  codigo: string;
  statusQA: "OK" | "ERRO" | "ALERTA";
  mensagens: string[];
}

export default function CentralProcessamento() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;

  // --- ESTADOS DE INTERFACE ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [editando, setEditando] = useState<{idx: number, campo: string} | null>(null);

  // --- ESTADOS DE DADOS ---
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);
  const [planilhaCompleta, setPlanilhaCompleta] = useState<ArvoreAuditada[]>([]);
  
  // --- ESTADOS DE FILTROS (EXCEL) ---
  const [filtroCapMin, setFiltroCapMin] = useState("");
  const [filtroCapMax, setFiltroCapMax] = useState("");
  const [filtroApenasErros, setFiltroApenasErros] = useState(false);
  const [filtroBuscaAmostra, setFiltroBuscaAmostra] = useState("");

  useEffect(() => {
    const carregarEstrutura = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const fSnap = await getDocs(collection(db, `clientes/${uid}/fazendas`));
      const tSnap = await getDocs(collection(db, `clientes/${uid}/talhoes`));
      setFazendas(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTalhoes(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    auth.onAuthStateChanged(user => { if(user) carregarEstrutura(); });
  }, []);

  // --- LÓGICA DE REDIMENSIONAR SIDEBAR ---
  const startResizing = useCallback(() => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }, []);
  const stopResizing = useCallback(() => { isResizing.current = false; document.body.style.cursor = 'default'; }, []);
  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    if (e.clientX > 150 && e.clientX < 600) setSidebarWidth(e.clientX);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", stopResizing);
    return () => { window.removeEventListener("mousemove", handleResize); window.removeEventListener("mouseup", stopResizing); };
  }, [handleResize, stopResizing]);

  // --- FUNÇÕES DE SELECIONAR TODOS ---
  const selecionarTodasFazendas = () => {
    if (fazendasSel.length === fazendas.length) setFazendasSel([]);
    else setFazendasSel(fazendas.map(f => f.id));
  };

  const selecionarTodosTalhoes = () => {
    const talhoesVisiveis = talhoes.filter(t => fazendasSel.includes(String(t.fazendaId))).map(t => String(t.id));
    if (talhoesSel.length === talhoesVisiveis.length) setTalhoesSel([]);
    else setTalhoesSel(talhoesVisiveis);
  };

  const rodarAuditoriaConsolidada = async () => {
    if (fazendasSel.length === 0) return alert("Selecione ao menos uma fazenda.");
    setLoading(true);
    setStatusMsg("Acessando banco de dados...");
    const uid = auth.currentUser?.uid;
    try {
      const qPar = query(collection(db, `clientes/${uid}/dados_coleta`), where("projetoId", "in", [projId, Number(projId)]));
      const pSnap = await getDocs(qPar);
      
      const parcelasFiltradas = pSnap.docs.filter(d => {
        const data = d.data();
        const fId = data.idFazenda || data.fazendaId;
        const tId = data.talhaoId;
        return fazendasSel.includes(String(fId)) && (talhoesSel.length === 0 || talhoesSel.includes(String(tId)));
      });

      const promessas = parcelasFiltradas.map(async (pDoc) => {
        const p = pDoc.data();
        let aSnap = await getDocs(collection(pDoc.ref, "arvores"));
        if (aSnap.empty) aSnap = await getDocs(collection(pDoc.ref, "arvore"));
        return aSnap.docs.map(aDoc => {
          const a = aDoc.data() as any;
          const cap = Number(a.cap) || 0;
          const dap = cap / Math.PI;
          const alt = Number(a.altura) || 0;
          const altDano = Number(a.alturaDano) || 0;
          const relacaoHD = alt > 0 && dap > 0 ? (alt / (dap / 100)) : 0;
          
          let status: any = "OK"; let msgs = [];
          if (cap > 220 || (cap < 5 && cap > 0)) { status = "ERRO"; msgs.push("CAP Outlier"); }
          if (relacaoHD > 160) { status = "ALERTA"; msgs.push("H/D Alto"); }
          if (a.codigo === "Falha" || cap === 0) { status = "ALERTA"; msgs.push("Falha"); }

          return {
            id: aDoc.id, parcelaDocId: pDoc.id, fazenda: p.nomeFazenda, talhao: p.nomeTalhao,
            parcela: p.idParcela, linha: a.linha, posicao: a.posicaoNaLinha,
            cap, dap, altura: alt, alturaDano: altDano, relacaoHD, codigo: a.codigo || "Normal", 
            statusQA: status, mensagens: msgs
          } as ArvoreAuditada;
        });
      });
      const resultados = await Promise.all(promessas);
      setPlanilhaCompleta(resultados.flat().sort((a, b) => a.fazenda.localeCompare(b.fazenda) || Number(a.parcela) - Number(b.parcela)));
    } finally { setLoading(false); }
  };

  const planilhaFiltrada = planilhaCompleta.filter(item => {
    const min = filtroCapMin === "" ? -1 : Number(filtroCapMin);
    const max = filtroCapMax === "" ? 999 : Number(filtroCapMax);
    const matchCap = item.cap >= min && item.cap <= max;
    const matchErro = filtroApenasErros ? item.statusQA !== "OK" : true;
    const matchAmostra = item.parcela.toString().includes(filtroBuscaAmostra);
    return matchCap && matchErro && matchAmostra;
  });

  const handlePointDoubleClick = (data: any) => {
    if (!data || !data.id) return;
    setHighlightedId(data.id);
    const element = document.getElementById(`tree-row-${data.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedId(null), 3000);
    }
  };

  const salvarEdicaoRapida = async (indexInFiltered: number, campo: string, valor: string) => {
    const item = planilhaFiltrada[indexInFiltered];
    const uid = auth.currentUser?.uid;
    const novoValor = Number(valor.replace(',', '.'));
    if (isNaN(novoValor)) return setEditando(null);

    try {
      const docRef = doc(db, `clientes/${uid}/dados_coleta`, item.parcelaDocId, "arvores", item.id);
      await updateDoc(docRef, { [campo]: novoValor });
      setPlanilhaCompleta(planilhaCompleta.map(p => p.id === item.id ? { ...p, [campo]: novoValor } : p));
      setEditando(null);
    } catch (e) { alert("Erro ao salvar."); }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      
      {/* SIDEBAR RETRÁTIL E AJUSTÁVEL (AZUL MARINHO) */}
      <aside 
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
        className="bg-slate-900 text-white transition-all duration-300 relative flex flex-col shrink-0 overflow-hidden"
      >
        <div className="p-6 flex flex-col gap-6 overflow-y-auto h-full min-w-[300px]">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors">
            <ArrowLeft size={16} /> Voltar ao Projeto
          </button>
          
          <h2 className="text-xl font-black text-emerald-400 uppercase flex items-center gap-2"><Filter size={22} /> Estratificação</h2>
          
          <div className="space-y-6">
            {/* FILTRO FAZENDAS COM SELECIONAR TODOS */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">1. Fazendas</label>
                <button onClick={selecionarTodasFazendas} className="text-[9px] font-bold text-emerald-500 uppercase hover:text-emerald-400">
                    {fazendasSel.length === fazendas.length ? "[ Desmarcar ]" : "[ Selecionar Todas ]"}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-2 border border-slate-800 p-2 rounded-xl bg-black/20">
                {fazendas.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-800 p-1.5 rounded transition-all">
                    <input type="checkbox" className="accent-emerald-500" checked={fazendasSel.includes(f.id)} onChange={(e) => e.target.checked ? setFazendasSel([...fazendasSel, f.id]) : setFazendasSel(fazendasSel.filter(id => id !== f.id))} />
                    <span className={fazendasSel.includes(f.id) ? "text-emerald-400 font-bold" : "text-slate-400"}>{f.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* FILTRO TALHÕES COM SELECIONAR TODOS */}
            {fazendasSel.length > 0 && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">2. Talhões</label>
                    <button onClick={selecionarTodosTalhoes} className="text-[9px] font-bold text-emerald-500 uppercase">
                        {talhoesSel.length > 0 ? "[ Desmarcar ]" : "[ Selecionar Todos ]"}
                    </button>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto pr-2 border border-slate-800 p-2 rounded-xl bg-black/20">
                  {talhoes.filter(t => fazendasSel.includes(String(t.fazendaId))).map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-slate-800 p-1 rounded">
                      <input type="checkbox" className="accent-emerald-500" checked={talhoesSel.includes(String(t.id))} onChange={(e) => e.target.checked ? setTalhoesSel([...talhoesSel, String(t.id)]) : setTalhoesSel(talhoesSel.filter(id => id !== String(t.id)))} />
                      <span className={talhoesSel.includes(String(t.id)) ? "text-white" : "text-slate-500"}>{t.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={rodarAuditoriaConsolidada} disabled={loading} className="mt-auto bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-emerald-400 disabled:bg-slate-700 transition-all">
            {loading ? "Sincronizando..." : "Auditar Seleção"}
          </button>
        </div>

        {/* ALÇA PARA ARRASTAR SIDEBAR */}
        <div 
          onMouseDown={startResizing}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-emerald-500/50 group"
        >
            <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 p-1 rounded shadow-xl"><GripVertical size={12} className="text-slate-900"/></div>
        </div>
      </aside>

      {/* BOTÃO PARA OCULTAR/MOSTRAR SIDEBAR */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="z-50 absolute top-1/2 -translate-y-1/2 bg-emerald-500 text-slate-900 p-1.5 rounded-full shadow-2xl hover:bg-emerald-400 transition-all border-4 border-slate-50"
        style={{ left: sidebarOpen ? `${sidebarWidth - 15}px` : '10px' }}
      >
        {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* ÁREA CENTRAL DE BI */}
      <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
        
        {planilhaCompleta.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[250px] shrink-0">
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <h3 className="text-xs font-black uppercase text-slate-400 mb-2 flex items-center gap-2">
                <BarChart2 size={14} /> Dispersão H/D (Duplo clique no ponto para localizar na tabela)
              </h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="cap" name="CAP" unit="cm" fontSize={10} />
                    <YAxis type="number" dataKey="altura" name="Altura" unit="m" fontSize={10} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter 
                      name="Árvores" 
                      data={planilhaFiltrada} 
                      onDoubleClick={(data) => handlePointDoubleClick(data)}
                      className="cursor-pointer"
                    >
                      {planilhaFiltrada.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.statusQA === 'ERRO' ? '#ef4444' : (entry.cap === 0 ? '#94a3b8' : '#10b981')} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col justify-center shadow-xl">
                 <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Consolidado do Estrato</p>
                 <h2 className="text-4xl font-black">{planilhaFiltrada.length} fustes</h2>
                 <div className="pt-4 border-t border-slate-800 flex justify-between">
                    <div><p className="text-slate-500 text-[9px] font-bold">MÉDIA CAP</p><p className="text-lg font-bold">{(planilhaFiltrada.reduce((acc, a) => acc + a.cap, 0) / (planilhaFiltrada.length || 1)).toFixed(1)}</p></div>
                    <div className="text-right text-red-400"><p className="text-slate-500 text-[9px]">ALERTAS</p><p className="text-lg font-bold">{planilhaFiltrada.filter(l => l.statusQA !== "OK").length}</p></div>
                 </div>
            </div>
          </div>
        )}

        {/* BARRA DE FERRAMENTAS EXCEL (FILTROS DE TABELA) */}
        {planilhaCompleta.length > 0 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 border-r pr-4">
              <TableIcon size={18} className="text-emerald-500" />
              <span className="text-xs font-black uppercase text-slate-800">Limpeza de Dados</span>
            </div>
            
            <div className="flex gap-2 items-center">
              <input type="number" placeholder="CAP Mín" className="w-20 p-2 text-xs border rounded-lg" value={filtroCapMin} onChange={(e) => setFiltroCapMin(e.target.value)} />
              <span className="text-slate-300">-</span>
              <input type="number" placeholder="CAP Máx" className="w-20 p-2 text-xs border rounded-lg" value={filtroCapMax} onChange={(e) => setFiltroCapMax(e.target.value)} />
            </div>

            <div className="h-6 w-px bg-slate-200"></div>

            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Filtrar Amostra..." className="pl-9 w-36 p-2 text-xs border rounded-lg" value={filtroBuscaAmostra} onChange={(e) => setFiltroBuscaAmostra(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:text-red-500 transition-colors">
              <input type="checkbox" className="w-4 h-4 accent-red-500" checked={filtroApenasErros} onChange={(e) => setFiltroApenasErros(e.target.checked)} />
              Apenas Inconsistências
            </label>

            <button onClick={() => { setFiltroCapMin(""); setFiltroCapMax(""); setFiltroBuscaAmostra(""); setFiltroApenasErros(false); }} className="ml-auto text-[10px] font-black text-red-500 uppercase flex items-center gap-1 hover:bg-red-50 p-2 rounded-lg transition-all">
                <Trash2 size={12}/> Limpar Filtros
            </button>
          </div>
        )}

        {/* PLANILHA MESTRE DE AUDITORIA */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1 scroll-smooth">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b">
                <tr>
                  <th className="p-4 text-slate-400 font-black uppercase">Fazenda / Talhão</th>
                  <th className="p-4 text-center text-slate-400 font-black uppercase">Amostra</th>
                  <th className="p-4 text-center text-emerald-600 font-black uppercase">CAP (cm)</th>
                  <th className="p-4 text-center text-blue-600 font-black uppercase">ALT (m)</th>
                  <th className="p-4 text-center text-blue-400 font-black uppercase">DANO (m)</th>
                  <th className="p-4 text-center text-slate-400 font-black uppercase">Código</th>
                  <th className="p-4 text-slate-400 font-black uppercase">Diagnóstico QA</th>
                </tr>
              </thead>
              <tbody>
                {planilhaFiltrada.map((l, i) => (
                  <tr 
                    key={i} 
                    id={`tree-row-${l.id}`}
                    className={`border-b border-slate-50 transition-all duration-700 ${highlightedId === l.id ? 'bg-yellow-100 ring-2 ring-yellow-400 z-10' : 'hover:bg-slate-50'}`}
                  >
                    <td className="p-4">
                       <span className="font-black text-slate-700 uppercase text-[10px] block">{l.fazenda}</span>
                       <span className="text-slate-400 block text-[9px] italic font-bold">{l.talhao}</span>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-400">P{l.parcela} <span className="block text-[8px] font-normal">{l.linha}/{l.posicao}</span></td>
                    
                    {/* EDITAR CAP */}
                    <td className={`p-4 text-center cursor-pointer font-black text-sm ${l.cap === 0 ? 'text-red-400 bg-red-50' : 'text-slate-900'}`} onDoubleClick={() => setEditando({idx: i, campo: 'cap'})}>
                      {editando?.idx === i && editando.campo === 'cap' ? (
                        <input autoFocus className="w-16 border-2 border-emerald-500 rounded p-1 text-center" defaultValue={l.cap} onBlur={(e) => salvarEdicaoRapida(i, 'cap', e.target.value)} />
                      ) : l.cap.toFixed(1)}
                    </td>

                    {/* EDITAR ALTURA */}
                    <td className="p-4 text-center cursor-pointer font-bold text-slate-600" onDoubleClick={() => setEditando({idx: i, campo: 'altura'})}>
                       {editando?.idx === i && editando.campo === 'altura' ? (
                        <input autoFocus className="w-16 border-2 border-blue-500 rounded p-1 text-center" defaultValue={l.altura} onBlur={(e) => salvarEdicaoRapida(i, 'altura', e.target.value)} />
                      ) : (l.altura > 0 ? l.altura.toFixed(1) : '-')}
                    </td>

                    <td className="p-4 text-center text-slate-400 font-bold">{l.alturaDano > 0 ? l.alturaDano.toFixed(1) : '-'}</td>
                    
                    <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${l.codigo !== 'Normal' ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>
                            {l.codigo}
                        </span>
                    </td>

                    <td className="p-4">
                       {l.statusQA === 'OK' ? (
                         <span className="text-emerald-500 flex items-center gap-1 font-bold text-[9px] uppercase"><CheckCircle size={12}/> Consistente</span>
                       ) : (
                         <div className="flex gap-1 flex-wrap">
                            {l.mensagens.map((m, idx) => <span key={idx} className="bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 text-[9px] font-black uppercase flex items-center gap-1"> {m}</span>)}
                         </div>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}