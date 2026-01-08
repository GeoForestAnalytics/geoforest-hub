"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
  CircleDollarSign, 
  Fuel, 
  Utensils, 
  Route, 
  Receipt,
  Target,
  AlertCircle,
  Calendar,
  User,
  Download,
  FileText,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLicense } from "../hooks/useAuthContext"; // ✅ Hook importado

export default function FinanceiroPage() {
  const { licenseId, loading: authLoading } = useLicense(); // ✅ Pegando licenseId
  const [diarios, setDiarios] = useState<any[]>([]);
  const [totalAmostrasGeral, setTotalAmostrasGeral] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();

  // --- ESTADOS DOS FILTROS ---
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroLider, setFiltroLider] = useState("todos");

  const formatarDataExibicao = (diario: any) => {
    const rawData = diario.data_relatorio || diario.dataRelatorio;
    if (!rawData) return "--/--/----";
    try {
      const dataLimpa = rawData.includes('T') ? rawData.split('T')[0] : rawData;
      if (dataLimpa.includes('-')) {
        const [ano, mes, dia] = dataLimpa.split('-');
        return `${dia}/${mes}/${ano}`;
      }
      return dataLimpa;
    } catch (e) { return "Data Inválida"; }
  };

  useEffect(() => {
    // ✅ Bloqueia se não tiver o ID da empresa
    if (!licenseId) return;

    setLoadingData(true);

    // 1. Busca Diários de Campo da Empresa
    const qDiarios = query(collection(db, `clientes/${licenseId}/diarios_de_campo`));
    const unsubDiarios = onSnapshot(qDiarios, (snap) => {
      setDiarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Busca Produção Total da Empresa (para calcular custo por parcela)
    const qColetas = query(collection(db, `clientes/${licenseId}/dados_coleta`));
    const unsubColetas = onSnapshot(qColetas, (snap) => {
        const concluidas = snap.docs.filter(d => 
          d.data().status === 'concluida' || d.data().status === 'exportada'
        ).length;
        setTotalAmostrasGeral(concluidas);
        setLoadingData(false);
    });

    return () => { unsubDiarios(); unsubColetas(); };
  }, [licenseId]); // ✅ Depende do licenseId

  // --- LÓGICA DE FILTRAGEM ---
  const diariosFiltrados = useMemo(() => {
    return diarios.filter(d => {
      const data = d.data_relatorio || d.dataRelatorio || "";
      const lider = (d.nome_lider || d.nomeLider || "").toLowerCase();
      const matchesData = (!filtroDataInicio || data >= filtroDataInicio) && 
                          (!filtroDataFim || data <= filtroDataFim);
      const matchesLider = filtroLider === "todos" || lider === filtroLider.toLowerCase();
      return matchesData && matchesLider;
    }).sort((a,b) => (b.data_relatorio || b.dataRelatorio || "").localeCompare(a.data_relatorio || a.dataRelatorio || ""));
  }, [diarios, filtroDataInicio, filtroDataFim, filtroLider]);

  const listaLideres = useMemo(() => {
    const nomes = diarios.map(d => d.nome_lider || d.nomeLider).filter(Boolean);
    return Array.from(new Set(nomes));
  }, [diarios]);

  const stats = useMemo(() => {
    const abastecimento = diariosFiltrados.reduce((acc, d) => acc + (Number(d.abastecimento_valor || d.abastecimentoValor) || 0), 0);
    const alimentacao = diariosFiltrados.reduce((acc, d) => acc + (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor) || 0), 0);
    const pedagio = diariosFiltrados.reduce((acc, d) => acc + (Number(d.pedagio_valor || d.pedagioValor) || 0), 0);
    const outros = diariosFiltrados.reduce((acc, d) => acc + (Number(d.outras_despesas_valor || d.outrasDespesasValor) || 0), 0);
    const km = diariosFiltrados.reduce((acc, d) => {
      const kmF = Number(d.km_final || d.kmFinal) || 0;
      const kmI = Number(d.km_inicial || d.kmInicial) || 0;
      return acc + (kmF - kmI > 0 ? kmF - kmI : 0);
    }, 0);
    return { abastecimento, alimentacao, pedagio, outros, total: abastecimento + alimentacao + pedagio + outros, km };
  }, [diariosFiltrados]);

  // --- EXPORTAÇÕES ---
  const exportarCSV = () => {
    const headers = ["Data;Lider;KM;Combustivel;Alimentacao;Pedagio_Outros;Total_Dia"];
    const rows = diariosFiltrados.map(d => {
      const km = (Number(d.km_final || d.kmFinal || 0) - Number(d.km_inicial || d.kmInicial || 0));
      const total = (Number(d.abastecimento_valor || d.abastecimentoValor || 0)) + 
                    (Number(d.pedagio_valor || d.pedagioValor || 0)) + 
                    (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor || 0)) + 
                    (Number(d.outras_despesas_valor || d.outrasDespesasValor || 0));
      return `${formatarDataExibicao(d)};${d.nome_lider || d.nomeLider};${km};${d.abastecimento_valor || d.abastecimentoValor || 0};${d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor || 0};${(d.pedagio_valor || 0) + (d.outras_despesas_valor || 0)};${total}`;
    });
    const blob = new Blob(["\uFEFF" + headers.concat(rows).join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `financeiro_geoforest_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const gerarPDF = () => {
    const doc = new jsPDF();
    const tableData = diariosFiltrados.map(d => [
      formatarDataExibicao(d),
      d.nome_lider || d.nomeLider,
      (Number(d.km_final || d.kmFinal || 0) - Number(d.km_inicial || d.kmInicial || 0)) + " km",
      "R$ " + (Number(d.abastecimento_valor || d.abastecimentoValor || 0)).toFixed(2),
      "R$ " + (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor || 0)).toFixed(2),
      "R$ " + ( (Number(d.abastecimento_valor || d.abastecimentoValor || 0)) + (Number(d.pedagio_valor || d.pedagioValor || 0)) + (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor || 0)) + (Number(d.outras_despesas_valor || d.outrasDespesasValor || 0)) ).toFixed(2)
    ]);
    autoTable(doc, {
      startY: 35,
      head: [['Data', 'Líder', 'KM', 'Combustível', 'Alimentação', 'Total Dia']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [2, 56, 83] } 
    });
    doc.save(`relatorio_financeiro_${new Date().getTime()}.pdf`);
  };

  if (authLoading || (loadingData && diarios.length === 0)) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-emerald-600 font-bold animate-pulse uppercase text-xs tracking-widest">Sincronizando Financeiro...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Gestão Financeira</h1>
          <p className="text-slate-500 font-medium italic">Empresa: <span className="font-mono text-emerald-600">{licenseId}</span></p>
        </div>
        <div className="bg-slate-900 text-white px-8 py-6 rounded-[32px] shadow-2xl border-b-4 border-emerald-500 transform hover:scale-105 transition-transform">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total no Período</p>
            <p className="text-4xl font-black text-emerald-50">R$ {stats.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
      </header>

      {/* FILTROS */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm mb-10 flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Calendar size={12}/> Data Início</label>
              <input type="date" className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Calendar size={12}/> Data Fim</label>
              <input type="date" className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><User size={12}/> Líder</label>
              <select className="w-full bg-slate-900 text-white border-none rounded-xl p-3 text-sm font-bold outline-none cursor-pointer" value={filtroLider} onChange={(e) => setFiltroLider(e.target.value)}>
                  <option value="todos">Todos os Líderes</option>
                  {listaLideres.map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
          </div>
          <button onClick={() => {setFiltroDataInicio(""); setFiltroDataFim(""); setFiltroLider("todos")}} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"><X size={20} /></button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Target size={20}/></div>
            <span className="text-[8px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full uppercase tracking-tighter">Fisico x Financeiro</span>
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Custo / Parcela</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {totalAmostrasGeral > 0 ? (stats.total / totalAmostrasGeral).toFixed(2) : "0.00"}</h2>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-4"><Route size={20} /></div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Rodagem (KM)</p>
          <h2 className="text-2xl font-black text-slate-800">{stats.km.toLocaleString('pt-BR')} <span className="text-xs font-normal">KM</span></h2>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-amber-100 w-10 h-10 rounded-xl flex items-center justify-center text-amber-600 mb-4"><Fuel size={20} /></div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Média Diesel/KM</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {stats.km > 0 ? (stats.abastecimento / stats.km).toFixed(2) : "0.00"}</h2>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-purple-100 w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 mb-4"><Utensils size={20} /></div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Alimentação Total</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {stats.alimentacao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden mb-10">
        <div className="p-8 bg-slate-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <Receipt className="text-emerald-500" size={24} />
                <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Extrato Analítico de Campo</h3>
            </div>
            <div className="flex gap-2">
                <button onClick={gerarPDF} className="flex items-center gap-2 text-[9px] font-black bg-white border border-slate-200 px-6 py-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm">
                  <FileText size={14}/> PDF
                </button>
                <button onClick={exportarCSV} className="flex items-center gap-2 text-[9px] font-black bg-emerald-600 text-white px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-md">
                  <Download size={14}/> CSV
                </button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-black border-b bg-white">
                <th className="p-8">Data</th>
                <th className="p-8">Líder</th>
                <th className="p-8 text-center">KM</th>
                <th className="p-8 text-center">Diesel</th>
                <th className="p-8 text-center">Alim.</th>
                <th className="p-8 text-right">Total Dia</th>
              </tr>
            </thead>
            <tbody>
              {diariosFiltrados.map((d) => {
                  const custoDia = (Number(d.abastecimento_valor || d.abastecimentoValor) || 0) + 
                                   (Number(d.pedagio_valor || d.pedagioValor) || 0) + 
                                   (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor) || 0) + 
                                   (Number(d.outras_despesas_valor || d.outrasDespesasValor) || 0);
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="p-8 text-sm font-black text-slate-700">{formatarDataExibicao(d)}</td>
                      <td className="p-8 text-sm text-slate-600 font-bold uppercase tracking-tight">{d.nome_lider || d.nomeLider}</td>
                      <td className="p-8 text-sm text-slate-500 text-center font-medium">{(Number(d.km_final || d.kmFinal) || 0) - (Number(d.km_inicial || d.kmInicial) || 0)} km</td>
                      <td className="p-8 text-sm text-slate-500 text-center font-medium">R$ {(Number(d.abastecimento_valor || d.abastecimentoValor) || 0).toFixed(2)}</td>
                      <td className="p-8 text-sm text-slate-500 text-center font-medium">R$ {(Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor) || 0).toFixed(2)}</td>
                      <td className="p-8 text-sm font-black text-slate-900 text-right bg-slate-50/30">R$ {custoDia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}