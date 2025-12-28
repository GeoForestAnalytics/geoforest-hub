"use client"
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  ArrowLeft, 
  Ruler, 
  CheckCircle, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  GripVertical, 
  TreeDeciduous, 
  Info,
  Download,
  Tag
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
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // --- DADOS ---
  const [atividades, setAtividades] = useState<any[]>([]); 
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);
  const [listaCubagem, setListaCubagem] = useState<CubagemAuditada[]>([]);
  const [arvoreSelecionada, setArvoreSelecionada] = useState<CubagemAuditada | null>(null);

  // Carregamento Inicial com Filtro de Atividade (Eliminando IPC/IFC)
  useEffect(() => {
    const carregarEstruturaFiltrada = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      
      try {
        // 1. Busca Atividades deste projeto e filtra apenas as de Cubagem (CUB)
        const aSnap = await getDocs(query(collection(db, `clientes/${uid}/atividades`), where("projetoId", "in", [projId, Number(projId)])));
        const atividadesCub = aSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((a: any) => a.tipo?.toUpperCase().includes("CUB"));
        
        const idsAtividadesCub = atividadesCub.map(a => String(a.id));

        // 2. Busca todas as Fazendas e filtra apenas as que pertencem às atividades de Cubagem
        const fSnap = await getDocs(collection(db, `clientes/${uid}/fazendas`));
        const fazendasFiltradas = fSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((f: any) => idsAtividadesCub.includes(String(f.atividadeId)));

        // 3. Busca todos os Talhões e filtra apenas os que pertencem às fazendas de Cubagem
        const tSnap = await getDocs(collection(db, `clientes/${uid}/talhoes`));
        const idsFazendasValidas = fazendasFiltradas.map(f => f.id);
        const talhoesFiltrados = tSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((t: any) => idsFazendasValidas.includes(String(t.fazendaId)));

        setAtividades(atividadesCub);
        setFazendas(fazendasFiltradas);
        setTalhoes(talhoesFiltrados);
      } catch (e) {
        console.error("Erro ao carregar estrutura de cubagem:", e);
      }
    };
    auth.onAuthStateChanged(user => { if(user) carregarEstruturaFiltrada(); });
  }, [projId]);

  // --- LÓGICA DE REDIMENSIONAR SIDEBAR ---
  const startResizing = useCallback(() => { isResizing.current = true; document.body.style.cursor = 'col-resize'; }, []);
  const stopResizing = useCallback(() => { isResizing.current = false; document.body.style.cursor = 'default'; }, []);
  const resizeHandler = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    if (e.clientX > 200 && e.clientX < 600) setSidebarWidth(e.clientX);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", resizeHandler);
    window.addEventListener("mouseup", stopResizing);
    return () => { window.removeEventListener("mousemove", resizeHandler); window.removeEventListener("mouseup", stopResizing); };
  }, [resizeHandler, stopResizing]);

  const rodarAuditoriaCubagem = async () => {
    if (fazendasSel.length === 0) return alert("Selecione ao menos uma fazenda.");
    if (talhoesSel.length === 0) return alert("Selecione ao menos um talhão.");
    
    setLoading(true);
    setStatusMsg("Processando afilamento...");
    const uid = auth.currentUser?.uid;

    try {
      // Correção da Linha 78: Convertendo IDs para Numbers e tratando tipagem para o Firestore
      const idsNumericos = talhoesSel.map(id => Number(id));
      
      const qCub = query(
        collection(db, `clientes/${uid}/dados_cubagem`), 
        where("talhaoId", "in", idsNumericos)
      );
      const cubSnap = await getDocs(qCub);

      const temporario: CubagemAuditada[] = [];

      for (const cDoc of cubSnap.docs) {
        const c = cDoc.data();
        if (!c.alturaTotal || c.alturaTotal === 0) continue;

        const sSnap = await getDocs(collection(cDoc.ref, "secoes"));
        const secoes = sSnap.docs.map(s => {
            const data = s.data();
            return {
                alturaMedicao: data.alturaMedicao,
                circunferencia: data.circunferencia,
                diametro: data.circunferencia / Math.PI
            } as Secao;
        }).sort((a,b) => a.alturaMedicao - b.alturaMedicao);

        let erroAfilamento = false;
        for (let i = 1; i < secoes.length; i++) {
            if (secoes[i].circunferencia > secoes[i-1].circunferencia) {
                erroAfilamento = true;
                break;
            }
        }

        temporario.push({
          id: cDoc.id,
          identificador: c.identificador,
          classe: c.classe || "N/A",
          cap: c.valorCAP,
          altura: c.alturaTotal,
          fazenda: c.nomeFazenda,
          talhao: c.nomeTalhao,
          status: erroAfilamento ? "ERRO" : "OK",
          secoes: secoes
        });
      }
      setListaCubagem(temporario);
      if (temporario.length > 0) setArvoreSelecionada(temporario[0]);

    } catch (e) {
      console.error("Erro na auditoria:", e);
      alert("Erro ao processar dados de cubagem.");
    } finally { setLoading(false); }
  };

  const exportarCSV = () => {
    if (listaCubagem.length === 0) return alert("Não há dados para exportar.");
    const headers = ["Identificador", "Fazenda", "Talhão", "Classe", "CAP (cm)", "Altura Total (m)", "Status Geral", "H Seção (m)", "Circunf (cm)", "DAP Seção (cm)"];
    const rows: any[] = [];
    listaCubagem.forEach(arvore => {
      if (arvore.secoes.length > 0) {
        arvore.secoes.forEach(secao => {
          rows.push([arvore.identificador, arvore.fazenda, arvore.talhao, arvore.classe, arvore.cap.toFixed(1).replace(".", ","), arvore.altura.toFixed(1).replace(".", ","), arvore.status, secao.alturaMedicao.toFixed(2).replace(".", ","), secao.circunferencia.toFixed(1).replace(".", ","), secao.diametro.toFixed(2).replace(".", ",")]);
        });
      } else {
        rows.push([arvore.identificador, arvore.fazenda, arvore.talhao, arvore.classe, arvore.cap.toFixed(1).replace(".", ","), arvore.altura.toFixed(1).replace(".", ","), arvore.status, "", "", ""]);
      }
    });
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_cubagem_${projId}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      
      {/* SIDEBAR AJUSTÁVEL - FILTRADA APENAS PARA CUBAGEM */}
      <aside 
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0px' }} 
        className="bg-slate-900 text-white transition-all duration-300 relative flex flex-col shrink-0 overflow-hidden shadow-2xl"
      >
        <div className="p-6 flex flex-col gap-6 h-full min-w-[300px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 hover:text-white"><ArrowLeft size={12}/> Voltar</button>
            <button onClick={() => setSidebarOpen(false)} className="text-emerald-400 p-1 hover:bg-slate-800 rounded"><ChevronLeft size={20}/></button>
          </div>
          
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* 1. FAZENDAS DE CUBAGEM */}
            <div className="flex flex-col h-1/2">
              <label className="text-[10px] font-black text-slate-500 uppercase mb-2">1. Fazendas (Contexto Cubagem)</label>
              <div className="flex-1 overflow-y-auto pr-2 border border-slate-800 p-2 rounded-xl bg-black/10 custom-scrollbar">
                {fazendas.map((f) => {
                  const ativ = atividades.find(a => String(a.id) === String(f.atividadeId));
                  return (
                    <label 
                      key={f.id} 
                      className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-slate-800 p-2 rounded transition-all border-b border-slate-800/50 last:border-0"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input 
                            type="checkbox" 
                            className="accent-emerald-500" 
                            checked={fazendasSel.includes(f.id)} 
                            onChange={(e) => e.target.checked ? setFazendasSel([...fazendasSel, f.id]) : setFazendasSel(fazendasSel.filter(id => id !== f.id))} 
                        />
                        <div className="flex flex-col truncate">
                            <span className={fazendasSel.includes(f.id) ? "text-emerald-400 font-bold" : "text-slate-300"}>{f.nome}</span>
                            <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Ativ: {ativ?.tipo || "CUB"}</span>
                        </div>
                      </div>
                      <Tag size={10} className="text-emerald-500" />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. TALHÕES DE CUBAGEM */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <label className="text-[10px] font-black text-slate-500 uppercase mb-2">2. Talhões Selecionados</label>
              <div className="flex-1 overflow-y-auto pr-2 border border-slate-800 p-2 rounded-xl bg-black/10 custom-scrollbar">
                {fazendasSel.length > 0 ? (
                  talhoes.filter(t => fazendasSel.includes(String(t.fazendaId))).map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-slate-800 p-1 rounded transition-all">
                      <input 
                        type="checkbox" 
                        className="accent-emerald-500" 
                        checked={talhoesSel.includes(String(t.id))} 
                        onChange={(e) => e.target.checked ? setTalhoesSel([...talhoesSel, String(t.id)]) : setTalhoesSel(talhoesSel.filter(id => id !== String(t.id)))} 
                      />
                      <span className={talhoesSel.includes(String(t.id)) ? "text-white font-bold" : "text-slate-500"}>{t.nome}</span>
                    </label>
                  ))
                ) : <p className="text-[10px] text-slate-600 text-center mt-10 italic">Selecione uma fazenda acima.</p>}
              </div>
            </div>
          </div>
          <button onClick={rodarAuditoriaCubagem} className="bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-emerald-400 transition-all">Analisar Cubagem</button>
        </div>
        <div onMouseDown={startResizing} className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500/50 flex items-center justify-center group">
          <GripVertical size={14} className="text-slate-700 group-hover:text-emerald-400" />
        </div>
      </aside>

      {/* REABRIR SIDEBAR */}
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-50 bg-slate-900 text-emerald-400 p-3 rounded-2xl shadow-2xl border border-emerald-500/30"><ChevronRight size={24}/></button>
      )}

      {/* ÁREA DE AUDITORIA */}
      <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6 relative">
        
        {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-emerald-600">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-black animate-pulse uppercase tracking-widest text-xs">{statusMsg}</p>
            </div>
        ) : listaCubagem.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[300px] shrink-0">
               <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                        <TreeDeciduous size={14} /> Perfil do Fuste: {arvoreSelecionada?.identificador}
                    </h3>
                    {arvoreSelecionada?.status === "ERRO" && (
                        <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black animate-bounce">⚠️ ERRO DE AFILAMENTO</span>
                    )}
                  </div>
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
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Seções</p>
                            <p className="text-xl font-bold">{arvoreSelecionada?.secoes.length}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Qualidade</p>
                            <p className={`text-sm font-black ${arvoreSelecionada?.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {arvoreSelecionada?.status === 'OK' ? 'APROVADA' : 'REVISAR'}
                            </p>
                        </div>
                    </div>
               </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Ruler size={18} className="text-slate-400" />
                    <h3 className="text-sm font-black text-slate-700 uppercase">Lista de Árvores Cubadas</h3>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={exportarCSV} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-all font-black text-[10px] uppercase tracking-widest"><Download size={14} /> Exportar Planilha</button>
                  <p className="text-[10px] text-slate-400 font-bold uppercase italic">Clique na linha para ver o gráfico</p>
                </div>
              </div>
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-white z-10 shadow-sm border-b-2">
                    <tr>
                      <th className="p-4 text-slate-400 font-bold uppercase">Identificador</th>
                      <th className="p-4 text-slate-400 font-bold uppercase">Fazenda / Talhão</th>
                      <th className="p-4 text-center text-slate-400 font-bold uppercase">Classe</th>
                      <th className="p-4 text-center text-emerald-600 font-black uppercase">CAP (cm)</th>
                      <th className="p-4 text-center text-blue-600 font-black uppercase">Altura (m)</th>
                      <th className="p-4 text-center text-slate-400 font-bold uppercase">Seções</th>
                      <th className="p-4 text-slate-400 font-bold uppercase">Status</th>
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
                        <td className="p-4 text-center font-bold text-slate-400">{c.secoes.length}</td>
                        <td className="p-4">
                           {c.status === 'OK' ? (
                             <span className="text-emerald-500 flex items-center gap-1 font-bold text-[9px] uppercase"><CheckCircle size={12}/> Consistente</span>
                           ) : (
                             <span className="text-red-500 flex items-center gap-1 font-bold text-[9px] uppercase"><AlertCircle size={12}/> Revisar</span>
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
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[40px] border-4 border-dashed border-slate-100 p-12 text-center">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Ruler size={40} className="text-slate-200" />
             </div>
             <p className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Auditoria de Cubagem</p>
             <p className="text-sm max-w-sm mt-2 font-medium">Selecione os talhões onde a cubagem rigorosa foi realizada para validar as medições das seções e o afilamento.</p>
          </div>
        )}
      </main>
    </div>
  );
}