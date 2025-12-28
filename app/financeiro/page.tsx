"use client"
import { useEffect, useState, useMemo } from "react";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
  CircleDollarSign, 
  Fuel, 
  Utensils, 
  Route, 
  TrendingUp, 
  Receipt,
  Target,
  AlertCircle,
  Calendar,
  User,
  Filter,
  Download,
  FileText,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function FinanceiroPage() {
  const [diarios, setDiarios] = useState<any[]>([]);
  const [totalAmostrasGeral, setTotalAmostrasGeral] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- ESTADOS DOS FILTROS ---
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroLider, setFiltroLider] = useState("todos");

  // FUNÇÃO DE DATA ROBUSTA (MANTIDA)
  const formatarDataExibicao = (diario: any) => {
    const rawData = diario.data_relatorio || diario.dataRelatorio;
    if (!rawData) return "--/--/----";
    try {
      if (rawData.seconds) {
        return new Date(rawData.seconds * 1000).toLocaleDateString('pt-BR');
      }
      if (typeof rawData === 'string') {
        const dataLimpa = rawData.includes('T') ? rawData.split('T')[0] : rawData;
        if (dataLimpa.includes('-')) {
          const [ano, mes, dia] = dataLimpa.split('-');
          return `${dia}/${mes}/${ano}`;
        }
        return dataLimpa;
      }
      return "--/--/----";
    } catch (e) {
      return "Data Inválida";
    }
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const uid = user.uid;
        const qDiarios = query(collection(db, `clientes/${uid}/diarios_de_campo`));
        const unsubDiarios = onSnapshot(qDiarios, (snap) => {
          setDiarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qColetas = query(collection(db, `clientes/${uid}/dados_coleta`));
        const unsubColetas = onSnapshot(qColetas, (snap) => {
            const concluidas = snap.docs.filter(d => 
              d.data().status === 'concluida' || d.data().status === 'exportada'
            ).length;
            setTotalAmostrasGeral(concluidas);
            setLoading(false);
        });

        return () => { unsubDiarios(); unsubColetas(); };
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // --- LÓGICA DE FILTRAGEM (USEMEMO PARA PERFORMANCE) ---
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

  // LISTA DE LÍDERES PARA O DROPDOWN
  const listaLideres = useMemo(() => {
    const nomes = diarios.map(d => d.nome_lider || d.nomeLider).filter(Boolean);
    return Array.from(new Set(nomes));
  }, [diarios]);

  // --- CÁLCULOS FINANCEIROS BASEADOS NO FILTRO (ACEITA AMBOS OS PADRÕES) ---
  const stats = useMemo(() => {
    const abastecimento = diariosFiltrados.reduce((acc, d) => 
      acc + (Number(d.abastecimento_valor) || Number(d.abastecimentoValor) || 0), 0);
    
    const alimentacao = diariosFiltrados.reduce((acc, d) => 
      acc + (Number(d.alimentacao_refeicao_valor) || Number(d.alimentacaoRefeicaoValor) || 0), 0);
    
    const pedagio = diariosFiltrados.reduce((acc, d) => 
      acc + (Number(d.pedagio_valor) || Number(d.pedagioValor) || 0), 0);
    
    const outros = diariosFiltrados.reduce((acc, d) => 
      acc + (Number(d.outras_despesas_valor) || Number(d.outrasDespesasValor) || 0), 0);
    
    const total = abastecimento + alimentacao + pedagio + outros;
    
    const km = diariosFiltrados.reduce((acc, d) => {
      const kmF = Number(d.km_final) || Number(d.kmFinal) || 0;
      const kmI = Number(d.km_inicial) || Number(d.kmInicial) || 0;
      const diff = kmF - kmI;
      return acc + (diff > 0 ? diff : 0);
    }, 0);

    return { abastecimento, alimentacao, pedagio, outros, total, km };
  }, [diariosFiltrados]);

  // --- FUNÇÕES DE EXPORTAÇÃO ---

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

    const csvContent = "\uFEFF" + headers.concat(rows).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // CORREÇÃO AQUI: Usando a data atual para o nome do arquivo já que dataFiltro não existe
    const dataArquivo = new Date().toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `financeiro_geoforest_${dataArquivo}.csv`);
    link.click();
  };

  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório Financeiro de Campo - GeoForest", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);

    const tableData = diariosFiltrados.map(d => [
      formatarDataExibicao(d),
      d.nome_lider || d.nomeLider,
      (Number(d.km_final || d.kmFinal || 0) - Number(d.km_inicial || d.kmInicial || 0)) + " km",
      "R$ " + (Number(d.abastecimento_valor || d.abastecimentoValor || 0)).toFixed(2),
      "R$ " + (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor || 0)).toFixed(2),
      "R$ " + (
        (Number(d.abastecimento_valor || d.abastecimentoValor || 0)) + 
        (Number(d.pedagio_valor || d.pedagioValor || 0)) + 
        (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor || 0)) + 
        (Number(d.outras_despesas_valor || d.outrasDespesasValor || 0))
      ).toFixed(2)
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

  if (loading) return (
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
          <p className="text-slate-500 font-medium italic">Monitoramento de gastos operacionais sincronizados do campo.</p>
        </div>
        <div className="bg-slate-900 text-white px-8 py-6 rounded-[32px] shadow-2xl border-b-4 border-emerald-500 transform hover:scale-105 transition-transform">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total no Período</p>
            <p className="text-4xl font-black text-emerald-50">R$ {stats.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
      </header>

      {/* SEÇÃO DE FILTROS */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm mb-10 flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Calendar size={12}/> Data Início</label>
              <input type="date" className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Calendar size={12}/> Data Fim</label>
              <input type="date" className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><User size={12}/> Líder</label>
              <select className="w-full bg-slate-900 text-white border-none rounded-xl p-3 text-sm font-bold outline-none cursor-pointer"
                value={filtroLider} onChange={(e) => setFiltroLider(e.target.value)}>
                  <option value="todos">Todos os Líderes</option>
                  {listaLideres.map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
          </div>
          <button 
            onClick={() => {setFiltroDataInicio(""); setFiltroDataFim(""); setFiltroLider("todos")}}
            className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"
            title="Limpar Filtros"
          >
            <X size={20} />
          </button>
      </div>

      {/* CARDS DE INDICADORES (KPIs ATUALIZADOS PELO FILTRO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Target size={20}/></div>
            <span className="text-[8px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full uppercase">Eficiência</span>
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase">Custo / Parcela</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {totalAmostrasGeral > 0 ? (stats.total / totalAmostrasGeral).toFixed(2) : "0.00"}</h2>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-4"><Route size={20} /></div>
          <p className="text-slate-400 text-xs font-bold uppercase">Rodagem Filtrada</p>
          <h2 className="text-2xl font-black text-slate-800">{stats.km.toLocaleString('pt-BR')} <span className="text-xs font-normal">KM</span></h2>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-amber-100 w-10 h-10 rounded-xl flex items-center justify-center text-amber-600 mb-4"><Fuel size={20} /></div>
          <p className="text-slate-400 text-xs font-bold uppercase">Diesel por KM</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {stats.km > 0 ? (stats.abastecimento / stats.km).toFixed(2) : "0.00"}</h2>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-purple-100 w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 mb-4"><Utensils size={20} /></div>
          <p className="text-slate-400 text-xs font-bold uppercase">Alimentação</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {stats.alimentacao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
        </div>
      </div>

      {/* TABELA DE EXTRATO ANALÍTICO */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-8 bg-slate-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <Receipt className="text-emerald-500" size={24} />
                <div>
                  <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Extrato Analítico de Campo</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Resultados baseados nos filtros aplicados</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={gerarPDF} className="flex items-center gap-2 text-[9px] font-black bg-white border border-slate-200 px-6 py-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm">
                  <FileText size={14}/> GERAR PDF
                </button>
                <button onClick={exportarCSV} className="flex items-center gap-2 text-[9px] font-black bg-emerald-600 text-white px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-md">
                  <Download size={14}/> EXPORTAR CSV
                </button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-black border-b bg-white">
                <th className="p-8">Data</th>
                <th className="p-8">Líder Responsável</th>
                <th className="p-8 text-center">KM</th>
                <th className="p-8 text-center">Combustível</th>
                <th className="p-8 text-center">Alimentação</th>
                <th className="p-8 text-right">Total Dia</th>
              </tr>
            </thead>
            <tbody>
              {diariosFiltrados.map((d) => {
                  const kmF = Number(d.km_final) || Number(d.kmFinal) || 0;
                  const kmI = Number(d.km_inicial) || Number(d.kmInicial) || 0;
                  const kmDia = kmF - kmI;
                  
                  const custoDia = (Number(d.abastecimento_valor) || Number(d.abastecimentoValor) || 0) + 
                                   (Number(d.pedagio_valor) || Number(d.pedagioValor) || 0) + 
                                   (Number(d.alimentacao_refeicao_valor) || Number(d.alimentacaoRefeicaoValor) || 0) + 
                                   (Number(d.outras_despesas_valor) || Number(d.outrasDespesasValor) || 0);

                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                      <td className="p-8 text-sm font-black text-slate-700">{formatarDataExibicao(d)}</td>
                      <td className="p-8 text-sm text-slate-600 font-bold uppercase tracking-tight">{d.nome_lider || d.nomeLider}</td>
                      <td className="p-8 text-sm text-slate-500 text-center font-medium">{kmDia > 0 ? kmDia.toLocaleString('pt-BR') + ' km' : '--'}</td>
                      <td className="p-8 text-sm text-slate-500 text-center font-medium">R$ {(Number(d.abastecimento_valor) || Number(d.abastecimentoValor) || 0).toFixed(2)}</td>
                      <td className="p-8 text-sm text-slate-500 text-center font-medium">R$ {(Number(d.alimentacao_refeicao_valor) || Number(d.alimentacaoRefeicaoValor) || 0).toFixed(2)}</td>
                      <td className="p-8 text-sm font-black text-slate-900 text-right bg-slate-50/30 group-hover:bg-emerald-50 transition-colors">
                          R$ {custoDia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
        
        {diariosFiltrados.length === 0 && (
          <div className="p-24 text-center flex flex-col items-center justify-center text-slate-400">
             <AlertCircle size={64} className="mb-6 opacity-10" />
             <p className="font-black uppercase tracking-widest text-sm text-slate-300">Nenhum dado encontrado para os filtros.</p>
          </div>
        )}
      </div>
      
      <footer className="mt-10 text-center">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">GeoForest ERP • Inteligência em Gestão Florestal</p>
      </footer>
    </div>
  );
}