"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Table as TableIcon,
  BarChart2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Trash2,
  Download,
  Layers,
  ShieldCheck,
  History,
  Edit3,
  FileText,
  AlertTriangle,
  Printer
} from "lucide-react";
import { useLicense } from "@/app/hooks/useAuthContext";
import { registerLog } from "@/app/lib/audit/audit";
import jsPDF from "jspdf"; // ✅ Para Relatórios Oficiais
import autoTable from "jspdf-autotable"; // ✅ Para Tabelas Pro no PDF

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

export default function CentralBI() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;

  const { licenseId, role, userId, userName, loading: authLoading } = useLicense();
  const isGerente = role === 'gerente' || role === 'admin';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ idx: number; campo: string } | null>(null);

  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  
  const [atividadeSel, setAtividadeSel] = useState<string>(""); 
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);
  
  const [planilhaCompleta, setPlanilhaCompleta] = useState<ArvoreAuditada[]>([]);

  const [filtrosAtivos, setFiltrosAtivos] = useState<{ [key: string]: string[] }>({
    fazenda: [], talhao: [], parcela: [], cap: [], altura: [], alturaDano: [], codigo: [], statusQA: [],
  });
  const [menuFiltroAberto, setMenuFiltroAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!licenseId) return;
    const carregarEstrutura = async () => {
      try {
        const qAtiv = query(collection(db, `clientes/${licenseId}/atividades`), where("projetoId", "in", [projId, Number(projId)]));
        const ativSnap = await getDocs(qAtiv);
        const listaAtiv = ativSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((a: any) => !a.tipo?.toUpperCase().includes("CUB"));
        setAtividades(listaAtiv);

        const fSnap = await getDocs(collection(db, `clientes/${licenseId}/fazendas`));
        const tSnap = await getDocs(collection(db, `clientes/${licenseId}/talhoes`));
        setFazendas(fSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTalhoes(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
    };
    carregarEstrutura();
  }, [projId, licenseId]);

  const fazendasFiltradas = useMemo(() => {
    if (!atividadeSel) return [];
    return fazendas.filter(f => String(f.atividadeId) === atividadeSel);
  }, [fazendas, atividadeSel]);

  const talhoesFiltrados = useMemo(() => {
    if (fazendasSel.length === 0) return [];
    return talhoes.filter(t => fazendasSel.includes(String(t.fazendaId)) && String(t.fazendaAtividadeId) === atividadeSel);
  }, [talhoes, fazendasSel, atividadeSel]);

  const handleToggleAllFazendas = () => {
    if (fazendasSel.length === fazendasFiltradas.length) { setFazendasSel([]); setTalhoesSel([]); }
    else { setFazendasSel(fazendasFiltradas.map(f => f.id)); }
  };

  const handleToggleAllTalhoes = () => {
    if (talhoesSel.length === talhoesFiltrados.length) { setTalhoesSel([]); }
    else { setTalhoesSel(talhoesFiltrados.map(t => String(t.id))); }
  };

  const rodarAuditoria = async () => {
    if (!atividadeSel) return alert("Selecione a Atividade de Inventário.");
    if (talhoesSel.length === 0) return alert("Selecione os talhões.");
    
    setLoading(true);
    try {
      const talhoesIdsNormalizados = talhoesSel.map(id => isNaN(Number(id)) ? id : Number(id));
      const chunks = [];
      for (let i = 0; i < talhoesIdsNormalizados.length; i += 30) {
        chunks.push(talhoesIdsNormalizados.slice(i, i + 30));
      }

      const queryPromises = chunks.map(chunk => {
        const q = query(collection(db, `clientes/${licenseId}/dados_coleta`), where("talhaoId", "in", chunk));
        return getDocs(q);
      });

      const querySnapshots = await Promise.all(queryPromises);
      const allDocs: any[] = [];
      querySnapshots.forEach(snap => allDocs.push(...snap.docs));

      const promessasArvores = allDocs.map(async (pDoc) => {
        const p = pDoc.data();
        let aSnap = await getDocs(collection(pDoc.ref, "arvores"));
        if (aSnap.empty) aSnap = await getDocs(collection(pDoc.ref, "arvore"));

        return aSnap.docs.map((aDoc) => {
          const a = aDoc.data() as any;
          const cap = Number(a.cap) || 0;
          const dap = cap / Math.PI;
          const alt = Number(a.altura) || 0;
          const altD = Number(a.alturaDano) || 0;
          const relacaoHD = alt > 0 && dap > 0 ? alt / (dap / 100) : 0;

          let status: any = "OK";
          let msgs = [];
          if (cap > 220 || (cap < 5 && cap > 0)) { status = "ERRO"; msgs.push("Outlier CAP"); }
          if (relacaoHD > 165) { status = "ALERTA"; msgs.push("H/D Alto"); }
          if (a.codigo === "Falha" || cap === 0) { status = "ERRO"; msgs.push("Falha"); }

          return {
            id: aDoc.id,
            parcelaDocId: pDoc.id,
            fazenda: p.nomeFazenda || "N/A",
            talhao: p.nomeTalhao || "N/A",
            parcela: p.idParcela,
            linha: a.linha,
            posicao: a.posicaoNaLinha,
            cap, dap, altura: alt, alturaDano: altD, relacaoHD,
            codigo: a.codigo || "NORMAL",
            statusQA: status,
            mensagens: msgs,
          } as ArvoreAuditada;
        });
      });

      const resultados = await Promise.all(promessasArvores);
      setPlanilhaCompleta(resultados.flat().sort((a, b) => a.fazenda.localeCompare(b.fazenda)));
    } catch (err) {
      console.error(err);
      alert("Erro ao processar auditoria.");
    } finally { setLoading(false); }
  };

  const planilhaFiltrada = useMemo(() => {
    return planilhaCompleta.filter((item) => {
      return Object.keys(filtrosAtivos).every((key) => {
        const ativos = filtrosAtivos[key];
        if (!ativos || ativos.length === 0) return true;
        return ativos.includes(String(item[key as keyof ArvoreAuditada]));
      });
    });
  }, [planilhaCompleta, filtrosAtivos]);

  const capMedio = useMemo(() => planilhaFiltrada.length > 0 ? planilhaFiltrada.reduce((acc, item) => acc + item.cap, 0) / planilhaFiltrada.length : 0, [planilhaFiltrada]);
  const areaBasalTotal = useMemo(() => planilhaFiltrada.reduce((acc, a) => acc + Math.PI * Math.pow(a.cap / Math.PI / 200, 2), 0), [planilhaFiltrada]);

  const handlePointDoubleClick = (data: any) => {
    if (!data || !data.id) return;
    setHighlightedId(data.id);
    const element = document.getElementById(`tree-row-${data.id}`);
    if (element) { element.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => setHighlightedId(null), 3000); }
  };

  const salvarEdicaoRapida = async (index: number, campo: string, valor: string) => {
    if (!isGerente) return alert("Somente gestores autorizam retificações.");
    const item = planilhaFiltrada[index];
    const novoValor = Number(valor.replace(",", "."));
    if (isNaN(novoValor)) return setEditando(null);
    try {
      const docRef = doc(db, `clientes/${licenseId}/dados_coleta`, item.parcelaDocId, "arvores", item.id);
      await updateDoc(docRef, { [campo]: novoValor });
      
      await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Retificou ${campo} da árvore ${item.linha}/${item.posicao} no talhão ${item.talhao}`);
      
      setPlanilhaCompleta(prev => prev.map(p => p.id === item.id ? { ...p, [campo]: novoValor } : p));
      setEditando(null);
    } catch (e) { alert("Erro ao salvar."); }
  };

  // ✅ EXPORTAÇÃO CSV (PROFISSIONAL)
  const handleExportCSV = async () => {
    if (planilhaFiltrada.length === 0) return alert("Não há dados filtrados para exportar.");
    
    const headers = ["Fazenda", "Talhao", "Parcela", "Linha", "Posicao", "CAP_cm", "DAP_cm", "Altura_m", "Codigo", "Status_QA"];
    const rows = planilhaFiltrada.map(row => [row.fazenda, row.talhao, `P${row.parcela}`, row.linha, row.posicao, row.cap.toFixed(1).replace(".", ","), row.dap.toFixed(2).replace(".", ","), row.altura.toFixed(1).replace(".", ","), row.codigo, row.statusQA]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    
    await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Exportou base CSV de auditoria do Projeto: ${projId}`);

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `QA_QC_Inventario_${projId}_${new Date().getTime()}.csv`;
    link.click();
  };

  // ✅ EXPORTAÇÃO CERTIFICADO PDF (ERP PRO)
  const exportarCertificadoPDF = async () => {
    const doc = new jsPDF();
    const totalErros = planilhaFiltrada.filter(l => l.statusQA !== "OK").length;

    // Header Pro
    doc.setFontSize(22);
    doc.setTextColor(2, 56, 83);
    doc.text("Certificado de Auditoria Técnica", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Projeto: ${projId}`, 14, 28);
    doc.text(`Responsável QA: ${userName}`, 14, 33);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 38);

    // Tabela de Resumo
    autoTable(doc, {
      startY: 45,
      head: [['Métrica de Qualidade', 'Valor Consolidado']],
      body: [
        ['Total de Fustes Auditados', planilhaFiltrada.length.toString()],
        ['Média de CAP (cm)', `${capMedio.toFixed(1)} cm`],
        ['Área Basal Total (m²)', `${areaBasalTotal.toFixed(2)} m²`],
        ['Inconsistências Detectadas', { content: totalErros.toString(), styles: { textColor: totalErros > 0 ? [255, 0, 0] : [0, 150, 0] } }],
        ['Selo de Integridade', totalErros === 0 ? "APROVADO" : "PENDENTE DE RETIFICAÇÃO"]
      ],
      theme: 'grid',
      headStyles: { fillColor: [2, 56, 83] }
    });

    // Tabela de Detalhes de Erros (Se houver)
    if (totalErros > 0) {
        doc.addPage();
        doc.text("Listagem de Pontos de Inconsistência", 14, 20);
        autoTable(doc, {
            startY: 25,
            head: [['Fazenda', 'Talhão', 'Amostra', 'L/P', 'Erro']],
            body: planilhaFiltrada.filter(l => l.statusQA !== "OK").map(l => [l.fazenda, l.talhao, `P${l.parcela}`, `${l.linha}/${l.posicao}`, l.mensagens.join(", ")]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [180, 0, 0] }
        });
    }

    await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Gerou Certificado QA/QC PDF do Projeto: ${projId}`);
    doc.save(`Certificado_QA_${projId}.pdf`);
  };

  if (authLoading) return <div className="p-20 text-center animate-pulse">Iniciando Ambiente de Auditoria...</div>;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <aside className={`${sidebarOpen ? "w-80" : "w-0"} bg-slate-900 text-white transition-all duration-300 relative flex flex-col shrink-0 overflow-hidden`}>
        <div className="p-6 flex flex-col gap-6 h-full min-w-[300px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 hover:text-white"><ArrowLeft size={12} /> Voltar</button>
            <button onClick={() => setSidebarOpen(false)} className="text-emerald-400 p-1 hover:bg-slate-800 rounded"><ChevronLeft size={20}/></button>
          </div>

          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div>
              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Layers size={12}/> Atividade Analítica</label>
              <select value={atividadeSel} onChange={(e) => { setAtividadeSel(e.target.value); setFazendasSel([]); setTalhoesSel([]); }} className="w-full mt-2 bg-black/20 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-emerald-500 transition-all">
                <option value="" className="bg-slate-900">Selecione o Inventário...</option>
                {atividades.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.tipo.toUpperCase()}</option>)}
              </select>
            </div>

            <div className="flex flex-col h-1/3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">1. Fazendas</label>
                <button onClick={handleToggleAllFazendas} className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-tighter">
                  {fazendasSel.length === fazendasFiltradas.length && fazendasFiltradas.length > 0 ? "[ Limpar ]" : "[ Todas ]"}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto mt-2 border border-slate-800 p-2 rounded-xl bg-black/10">
                {fazendasFiltradas.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-slate-800 rounded cursor-pointer">
                    <input type="checkbox" className="accent-emerald-500" checked={fazendasSel.includes(f.id)} onChange={(e) => e.target.checked ? setFazendasSel([...fazendasSel, f.id]) : setFazendasSel(fazendasSel.filter((id) => id !== f.id))} />
                    <span className={fazendasSel.includes(f.id) ? "text-emerald-400 font-bold" : "text-slate-400"}>{f.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">2. Talhões</label>
                <button onClick={handleToggleAllTalhoes} className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-tighter">
                  {talhoesSel.length === talhoesFiltrados.length && talhoesFiltrados.length > 0 ? "[ Limpar ]" : "[ Todas ]"}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto mt-2 border border-slate-800 p-2 rounded-xl bg-black/10">
                {talhoesFiltrados.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-[10px] p-1 hover:bg-slate-800 rounded cursor-pointer">
                    <input type="checkbox" className="accent-emerald-500" checked={talhoesSel.includes(String(t.id))} onChange={(e) => e.target.checked ? setTalhoesSel([...talhoesSel, String(t.id)]) : setTalhoesSel(talhoesSel.filter((id) => id !== String(t.id)))} />
                    <span className={talhoesSel.includes(String(t.id)) ? "text-white font-bold" : "text-slate-500"}>{t.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button onClick={rodarAuditoria} className="bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-emerald-400 transition-all">Auditar Base Técnica</button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-50 bg-slate-900 text-emerald-400 p-3 rounded-2xl shadow-2xl border border-emerald-500/30"><ChevronRight size={24} /></button>
      )}

      <main className="flex-1 flex flex-col overflow-hidden p-6 gap-4 relative">
        {planilhaCompleta.length > 0 && (
          <div className="flex flex-col gap-4 shrink-0">
            <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl flex flex-row items-center justify-between px-10 border border-emerald-500/10">
              <div className="flex items-center gap-8">
                <div><p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Fustes Auditados</p><h2 className="text-2xl font-black">{planilhaFiltrada.length}</h2></div>
                <div className="w-px h-10 bg-slate-800"></div>
                <div><p className="text-slate-500 text-[10px] font-bold uppercase">CAP Médio</p><h2 className="text-2xl font-bold">{capMedio.toFixed(1)} cm</h2></div>
                <div className="w-px h-10 bg-slate-800"></div>
                <div><p className="text-red-400 text-[10px] font-bold uppercase">Inconsistências</p><h2 className="text-2xl font-bold text-red-400">{planilhaFiltrada.filter((l) => l.statusQA !== "OK").length}</h2></div>
              </div>
              <div className="flex gap-3">
                  <button onClick={exportarCertificadoPDF} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all">
                    <Printer size={16} className="text-emerald-400"/> Imprimir Certificado
                  </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[320px]">
              <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><BarChart2 size={14} /> Dispersão Biométrica (H/D)</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="cap" name="CAP" unit="cm" fontSize={10} />
                    <YAxis type="number" dataKey="altura" name="Altura" unit="m" fontSize={10} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter name="Árvores" data={planilhaFiltrada} onDoubleClick={(data) => handlePointDoubleClick(data)} className="cursor-pointer">
                      {planilhaFiltrada.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.statusQA === "ERRO" ? "#ef4444" : entry.cap === 0 ? "#94a3b8" : "#10b981"} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-0">
          <div className="p-5 bg-slate-50 border-b flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-600" /> Planilha Mestre Auditada</div>
            <div className="flex items-center gap-4">
                <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 flex items-center gap-2 font-black transition-all shadow-md"><Download size={14} /> Exportar CSV</button>
                <button onClick={() => setFiltrosAtivos({ fazenda: [], talhao: [], parcela: [], cap: [], altura: [], alturaDano: [], codigo: [], statusQA: [] })} className="text-slate-400 hover:text-red-500 font-bold uppercase text-[9px] transition-all">Limpar Filtros</button>
            </div>
          </div>

          <div className="overflow-auto flex-1 scroll-smooth custom-scrollbar">
            <table className="w-full text-left text-[11px] border-collapse relative">
              <thead className="sticky top-0 bg-white z-20 shadow-sm border-b">
                <tr className="bg-slate-50/50">
                  {["fazenda", "talhao", "parcela", "cap", "altura", "codigo", "statusQA"].map((col) => (
                    <th key={col} className="p-4 text-slate-400 font-black uppercase relative border-r border-slate-100 last:border-r-0">
                      <div className="flex items-center justify-between gap-1">
                        <span>{col === "statusQA" ? "Diagnóstico" : col}</span>
                        <button onClick={() => setMenuFiltroAberto(menuFiltroAberto === col ? null : col)} className={`p-1 rounded ${filtrosAtivos[col].length > 0 ? "bg-emerald-500 text-white" : "hover:bg-slate-200"}`}><ListFilter size={12} /></button>
                      </div>
                      {menuFiltroAberto === col && (
                        <div className="absolute top-12 left-0 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-56 z-30 normal-case font-normal text-slate-700">
                          <div className="max-h-52 overflow-y-auto space-y-1">
                            {Array.from(new Set(planilhaCompleta.map((p) => String(p[col as keyof ArvoreAuditada])))).sort().map((val) => (
                              <label key={val} className="flex items-center gap-2 hover:bg-slate-50 p-2 rounded-xl cursor-pointer text-[10px] font-medium"><input type="checkbox" className="accent-emerald-500" checked={filtrosAtivos[col].includes(val)} onChange={() => setFiltrosAtivos(prev => ({ ...prev, [col]: prev[col].includes(val) ? prev[col].filter(v => v !== val) : [...prev[col], val] }))} /> {val}</label>
                            ))}
                          </div>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {planilhaFiltrada.map((l, i) => (
                  <tr key={i} id={`tree-row-${l.id}`} className={`hover:bg-slate-50/80 transition-all ${highlightedId === l.id ? "bg-amber-50 ring-1 ring-amber-400" : ""}`}>
                    <td className="p-4 font-black text-slate-700 text-[10px] uppercase">{l.fazenda}</td>
                    <td className="p-4 text-slate-500 font-bold italic">{l.talhao}</td>
                    <td className="p-4 text-center font-bold text-slate-400">P{l.parcela} <span className="block text-[8px] font-normal">{l.linha}/{l.posicao}</span></td>
                    <td className={`p-4 text-center ${isGerente ? 'cursor-pointer' : ''} font-black text-sm ${l.cap === 0 ? "text-red-400 bg-red-50/50" : "text-slate-900"}`} onDoubleClick={() => isGerente && setEditando({ idx: i, campo: "cap" })}>
                      {editando?.idx === i && editando.campo === "cap" ? <input autoFocus className="w-16 border-2 border-emerald-500 rounded p-1 text-center" defaultValue={l.cap} onBlur={(e) => salvarEdicaoRapida(i, "cap", e.target.value)} /> : l.cap.toFixed(1)}
                    </td>
                    <td className="p-4 text-center cursor-pointer font-bold text-slate-600" onDoubleClick={() => isGerente && setEditando({ idx: i, campo: "altura" })}>
                      {editando?.idx === i && editando.campo === "altura" ? <input autoFocus className="w-16 border-2 border-blue-500 rounded p-1 text-center" defaultValue={l.altura} onBlur={(e) => salvarEdicaoRapida(i, "altura", e.target.value)} /> : l.altura > 0 ? l.altura.toFixed(1) : "-"}
                    </td>
                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${l.codigo !== "NORMAL" ? "bg-amber-100 text-amber-700" : "text-slate-400"}`}>{l.codigo}</span></td>
                    <td className="p-4">{l.statusQA === "OK" ? <span className="text-emerald-500 flex items-center gap-1 font-black text-[9px] uppercase"><CheckCircle size={10} /> Consistente</span> : <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg border border-red-100 text-[9px] font-black uppercase flex items-center gap-1"><AlertTriangle size={10}/> {l.mensagens[0]}</span>}</td>
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