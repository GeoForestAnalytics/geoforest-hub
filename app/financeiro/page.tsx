"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
  CircleDollarSign, Fuel, Utensils, Route, 
  Receipt, Target, Calendar, User, Download, 
  FileText, X, Briefcase, ShieldCheck, Printer
} from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLicense } from "../hooks/useAuthContext";
import { registerLog } from "../lib/audit/audit"; // ✅ Auditoria Profissional

export default function FinanceiroPage() {
  const { licenseId, userName, userId, loading: authLoading } = useLicense();
  
  const [diarios, setDiarios] = useState<any[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [totalAmostrasGeral, setTotalAmostrasGeral] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  // --- ESTADOS DOS FILTROS ---
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroLider, setFiltroLider] = useState("todos");
  const [filtroProjeto, setFiltroProjeto] = useState("todos");

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
    if (!licenseId) return;
    setLoadingData(true);

    const unsubscribers = [
      onSnapshot(collection(db, `clientes/${licenseId}/diarios_de_campo`), (snap) => {
        setDiarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }),
      onSnapshot(collection(db, `clientes/${licenseId}/projetos`), (snap) => {
          setProjetos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }),
      onSnapshot(collection(db, `clientes/${licenseId}/colaboradores`), (snap) => {
          setColaboradores(snap.docs.map(doc => doc.data()));
      }),
      onSnapshot(collection(db, `clientes/${licenseId}/dados_coleta`), (snap) => {
          const concluidas = snap.docs.filter(d => 
            d.data().status === 'concluida' || d.data().status === 'exportada'
          ).length;
          setTotalAmostrasGeral(concluidas);
          setLoadingData(false);
      })
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [licenseId]);

  // --- LÓGICA DE FILTRAGEM ---
  const diariosFiltrados = useMemo(() => {
    return diarios.filter(d => {
      const data = d.data_relatorio || d.dataRelatorio || "";
      const lider = (d.nome_lider || d.nomeLider || "").toLowerCase();
      const idProj = String(d.projetoId || d.projeto_id || "");

      const matchesData = (!filtroDataInicio || data >= filtroDataInicio) && 
                          (!filtroDataFim || data <= filtroDataFim);
      const matchesLider = filtroLider === "todos" || lider === filtroLider.toLowerCase();
      const matchesProjeto = filtroProjeto === "todos" || idProj === filtroProjeto;

      return matchesData && matchesLider && matchesProjeto;
    }).sort((a,b) => (b.data_relatorio || b.dataRelatorio || "").localeCompare(a.data_relatorio || a.dataRelatorio || ""));
  }, [diarios, filtroDataInicio, filtroDataFim, filtroLider, filtroProjeto]);

  // --- CÁLCULOS DRE OPERACIONAL ---
  const stats = useMemo(() => {
    const abastecimento = diariosFiltrados.reduce((acc, d) => acc + (Number(d.abastecimento_valor || d.abastecimentoValor || 0)), 0);
    const alimentacao = diariosFiltrados.reduce((acc, d) => acc + (Number(d.alimentacao_refeicao_valor || d.alimentacaoRefeicaoValor || 0)), 0);
    const pedagio = diariosFiltrados.reduce((acc, d) => acc + (Number(d.pedagio_valor || d.pedagioValor || 0)), 0);
    const outros = diariosFiltrados.reduce((acc, d) => acc + (Number(d.outras_despesas_valor || d.outrasDespesasValor || 0)), 0);
    
    const km = diariosFiltrados.reduce((acc, d) => {
      const kmF = Number(d.km_final || d.kmFinal || 0);
      const kmI = Number(d.km_inicial || d.kmInicial || 0);
      return acc + (kmF - kmI > 0 ? kmF - kmI : 0);
    }, 0);

    const folhaMensalTotal = colaboradores.reduce((acc, c) => acc + (Number(c.salarioBase) || 0), 0);
    const custoDiaFolha = folhaMensalTotal / 22; 
    const diasComOperacao = new Set(diariosFiltrados.map(d => d.data_relatorio || d.dataRelatorio)).size;
    const custoMaoDeObraProRata = diasComOperacao * custoDiaFolha;

    const totalOperacional = abastecimento + alimentacao + pedagio + outros;

    return { 
        abastecimento, alimentacao, pedagio, outros, 
        operacional: totalOperacional,
        maoDeObra: custoMaoDeObraProRata,
        totalGeral: totalOperacional + custoMaoDeObraProRata,
        km 
    };
  }, [diariosFiltrados, colaboradores]);

  // ✅ EXPORTAÇÃO PDF PROFISSIONAL (ERP)
  const gerarPDFExtrato = async () => {
    const doc = new jsPDF();
    const titulo = filtroProjeto !== "todos" 
        ? `EXTRATO FINANCEIRO: ${projetos.find(p => p.id === filtroProjeto)?.nome.toUpperCase()}`
        : "EXTRATO FINANCEIRO CONSOLIDADO";

    doc.setFontSize(18);
    doc.setTextColor(2, 56, 83);
    doc.text(titulo, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Emissor: ${userName} | Data: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Indicador de Custo', 'Valor']],
      body: [
        ['Despesas Operacionais (Diesel/Alim/Pedágio)', `R$ ${stats.operacional.toLocaleString('pt-BR')}`],
        ['Custo de Mão de Obra (Pro-rata Equipe)', `R$ ${stats.maoDeObra.toLocaleString('pt-BR')}`],
        ['Investimento Total no Período', `R$ ${stats.totalGeral.toLocaleString('pt-BR')}`],
        ['Custo Real por Amostra Coletada', `R$ ${totalAmostrasGeral > 0 ? (stats.totalGeral / totalAmostrasGeral).toFixed(2) : "0,00"}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [2, 56, 83] }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Data', 'Líder', 'Projeto', 'KM', 'Custo Total']],
      body: diariosFiltrados.map(d => [
        formatarDataExibicao(d),
        d.nome_lider || d.nomeLider,
        projetos.find(p => String(p.id) === String(d.projetoId))?.nome || "N/A",
        `${(Number(d.km_final || 0) - Number(d.km_inicial || 0))} km`,
        `R$ ${(Number(d.abastecimento_valor || 0) + Number(d.pedagio_valor || 0) + Number(d.alimentacao_refeicao_valor || 0) + Number(d.outras_despesas_valor || 0)).toFixed(2)}`
      ]),
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    await registerLog(licenseId!, userId!, userName!, 'FECHAMENTO_NOTAFISCAL', `Gerou Extrato Financeiro PDF. Filtro: ${filtroProjeto}`);
    doc.save(`Extrato_Financeiro_GeoForest_${new Date().getTime()}.pdf`);
  };

  const exportarCSV = async () => {
    await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Exportou base financeira CSV. Filtro: ${filtroProjeto}`);
    const headers = ["Data;Projeto;Lider;KM;Diesel;Total_Dia"];
    const rows = diariosFiltrados.map(d => {
      const nomeProj = projetos.find(p => String(p.id) === String(d.projetoId))?.nome || "N/A";
      const custo = (Number(d.abastecimento_valor || 0) + Number(d.pedagio_valor || 0) + Number(d.alimentacao_refeicao_valor || 0) + Number(d.outras_despesas_valor || 0));
      return `${formatarDataExibicao(d)};${nomeProj};${d.nome_lider};${(Number(d.km_final || 0) - Number(d.km_inicial || 0))};${d.abastecimento_valor};${custo}`;
    });
    const blob = new Blob(["\uFEFF" + headers.concat(rows).join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Controle_Financeiro_${new Date().getTime()}.csv`;
    link.click();
  };

  if (authLoading || loadingData) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando Fluxo de Caixa...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Gestão Financeira</h1>
          <p className="text-slate-500 font-medium italic">Visão de Rentabilidade por Contrato</p>
        </div>
        <div className="bg-slate-900 text-white px-10 py-8 rounded-[40px] shadow-2xl border-b-8 border-emerald-500">
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Custo Total Consolidado</p>
            <p className="text-5xl font-black text-emerald-50">R$ {stats.totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
      </header>

      {/* FILTROS TÉCNICOS */}
      <div className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm mb-10 flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[250px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Briefcase size={14}/> Centro de Custo (Projeto)</label>
              <select className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={filtroProjeto} onChange={(e) => setFiltroProjeto(e.target.value)}>
                  <option value="todos">Todos os Contratos</option>
                  {projetos.map(p => <option key={p.id} value={p.id}>{p.nome.toUpperCase()}</option>)}
              </select>
          </div>
          <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Calendar size={14}/> Início</label>
              <input type="date" className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold outline-none" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2"><Calendar size={14}/> Fim</label>
              <input type="date" className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold outline-none" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
          <button onClick={() => {setFiltroDataInicio(""); setFiltroDataFim(""); setFiltroProjeto("todos")}} className="p-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><X size={24} /></button>
      </div>

      {/* KPIs DE ALTA PERFORMANCE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Custo Médio / Amostra</p>
          <h2 className="text-3xl font-black text-slate-800">R$ {totalAmostrasGeral > 0 ? (stats.totalGeral / totalAmostrasGeral).toFixed(2) : "0.00"}</h2>
          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase">Real (Com Folha)</span>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Mão de Obra Alocada</p>
          <h2 className="text-3xl font-black text-blue-600">R$ {stats.maoDeObra.toLocaleString('pt-BR')}</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Investimento pro-rata</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Eficiência Diesel</p>
          <h2 className="text-3xl font-black text-amber-600">R$ {stats.km > 0 ? (stats.abastecimento / stats.km).toFixed(2) : "0.00"}<span className="text-xs">/km</span></h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Gasto por KM rodado</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Viagens no Período</p>
          <h2 className="text-3xl font-black text-purple-600">{diariosFiltrados.length} <span className="text-xs">Diários</span></h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Relatórios enviados</p>
        </div>
      </div>

      {/* TABELA CORPORATIVA */}
      <div className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden mb-12">
        <div className="p-10 bg-slate-50 border-b flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg"><Receipt size={24} /></div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase text-sm tracking-widest">Extrato Analítico de Campo</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Conformidade: {userName}</p>
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={gerarPDFExtrato} className="flex items-center gap-2 text-[10px] font-black bg-white border border-slate-200 px-6 py-4 rounded-2xl hover:bg-slate-50 transition-all shadow-sm uppercase">
                  <Printer size={16} className="text-emerald-500"/> Exportar Relatório PDF
                </button>
                <button onClick={exportarCSV} className="flex items-center gap-2 text-[10px] font-black bg-emerald-600 text-white px-6 py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg uppercase">
                  <Download size={16}/> Base de Dados (CSV)
                </button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-black border-b bg-white">
                <th className="p-8">Data / Unidade</th>
                <th className="p-8">Responsável</th>
                <th className="p-8 text-center">Diesel</th>
                <th className="p-8 text-center">Deslocamento</th>
                <th className="p-8 text-right">Subtotal Operação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diariosFiltrados.map((d) => {
                  const nomeProj = projetos.find(p => String(p.id) === String(d.projetoId || d.projeto_id))?.nome || "S/ PROJETO";
                  const custoDia = (Number(d.abastecimento_valor || 0)) + (Number(d.pedagio_valor || 0)) + (Number(d.alimentacao_refeicao_valor || 0)) + (Number(d.outras_despesas_valor || 0));
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-8">
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-800">{formatarDataExibicao(d)}</span>
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{nomeProj}</span>
                        </div>
                      </td>
                      <td className="p-8 text-sm text-slate-600 font-bold uppercase tracking-tight">{d.nome_lider || d.nomeLider}</td>
                      <td className="p-8 text-sm text-slate-500 text-center font-bold">R$ {(Number(d.abastecimento_valor || 0)).toFixed(2)}</td>
                      <td className="p-8 text-sm text-slate-400 text-center font-medium italic">{(Number(d.km_final || 0) - Number(d.km_inicial || 0))} km</td>
                      <td className="p-8 text-sm font-black text-slate-900 text-right bg-slate-50/20">R$ {custoDia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
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