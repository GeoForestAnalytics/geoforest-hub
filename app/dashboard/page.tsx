"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, collectionGroup } from "firebase/firestore";
import { useLicense } from "../hooks/useAuthContext";
import { registerLog } from "../lib/audit/audit"; // ✅ Registro de Auditoria
import { 
  TrendingUp, Users, Car, 
  Wallet, ArrowUpRight, 
  ArrowDownRight, DollarSign, HardHat, 
  Landmark, Calendar, FileText, Download 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import jsPDF from "jspdf"; // ✅ Gerador de PDF
import autoTable from "jspdf-autotable"; // ✅ Tabelas Pro para PDF

// --- INTERFACE ---
interface IndicadoresBI {
  custoFolhaEfetivo: number;
  custoFolhaTotalMensal: number;
  custoManutencaoFrotaPeriodo: number;
  custoCampoTotal: number;
  custoAdmProjetos: number;
  investimentoTotalPeriodo: number;
  receitaConfirmadaPeriodo: number;
  receitaPendente: number;
  lucroRealPeriodo: number;
  margemPeriodo: string;
  diasOperados: number;
}

export default function DashboardExecutivo() {
  const { licenseId, role, userId, userName, loading: authLoading } = useLicense();
  
  const [mesSel, setMesSel] = useState(new Date().getMonth());
  const [anoSel, setAnoSel] = useState(new Date().getFullYear());

  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [manutencoesGlobais, setManutencoesGlobais] = useState<any[]>([]);
  const [diarios, setDiarios] = useState<any[]>([]);
  const [gastosAdmGlobais, setGastosAdmGlobais] = useState<any[]>([]);
  const [receitasManuaisGlobais, setReceitasManuaisGlobais] = useState<any[]>([]);
  const [amostrasBrutas, setAmostrasBrutas] = useState<any[]>([]);
  const [cubagensBrutas, setCubagensBrutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!licenseId) return;

    const unsubscribers = [
      onSnapshot(collection(db, `clientes/${licenseId}/talhoes`), (s) => setTalhoes(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, `clientes/${licenseId}/colaboradores`), (s) => setColaboradores(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, `clientes/${licenseId}/diarios_de_campo`), (s) => setDiarios(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, `clientes/${licenseId}/dados_coleta`), (s) => setAmostrasBrutas(s.docs.map(d => d.data()))),
      onSnapshot(collection(db, `clientes/${licenseId}/dados_cubagem`), (s) => setCubagensBrutas(s.docs.map(d => d.data()))),
      
      onSnapshot(collectionGroup(db, "manutencoes"), (s) => {
          setManutencoesGlobais(s.docs.filter(d => d.ref.path.includes(licenseId)).map(d => d.data()));
      }),
      onSnapshot(collectionGroup(db, "gastos_adm"), (s) => {
          setGastosAdmGlobais(s.docs.filter(d => d.ref.path.includes(licenseId)).map(d => d.data()));
      }),
      onSnapshot(collectionGroup(db, "faturamentos"), (s) => {
          setReceitasManuaisGlobais(s.docs.filter(d => d.ref.path.includes(licenseId)).map(d => d.data()));
          setLoading(false);
      })
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [licenseId]);

  const isNoPeriodo = (dataQualquer: any) => {
    if (!dataQualquer) return false;
    let d: Date;
    if (dataQualquer.seconds) d = new Date(dataQualquer.seconds * 1000); 
    else d = new Date(dataQualquer);
    return d.getMonth() === mesSel && d.getFullYear() === anoSel;
  };

  const bi = useMemo<IndicadoresBI>(() => {
    const custoManutencaoFrotaPeriodo = manutencoesGlobais.filter(m => isNoPeriodo(m.data)).reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
    const custoCampoTotal = diarios.filter(d => isNoPeriodo(d.dataRelatorio || d.data_relatorio)).reduce((acc, d) => acc + (Number(d.abastecimentoValor || d.abastecimento_valor || 0) + Number(d.pedagioValor || d.pedagio_valor || 0) + Number(d.alimentacaoRefeicaoValor || d.alimentacaoRefeicaoValor || 0) + Number(d.outrasDespesasValor || d.outrasDespesasValor || 0)), 0);
    const custoAdmProjetos = gastosAdmGlobais.filter(g => isNoPeriodo(g.data)).reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const custoFolhaTotalMensal = colaboradores.reduce((acc, c) => acc + (Number(c.salarioBase) || 0), 0);
    const diasUteisPadrao = 22;
    const custoMaoDeObraDia = custoFolhaTotalMensal / diasUteisPadrao;
    const datasUnicasOperadas = new Set(diarios.filter(d => isNoPeriodo(d.dataRelatorio || d.data_relatorio)).map(d => d.dataRelatorio || d.data_relatorio));
    const diasOperados = datasUnicasOperadas.size;
    const custoFolhaEfetivo = diasOperados * custoMaoDeObraDia;
    const receitaManual = receitasManuaisGlobais.filter(r => isNoPeriodo(r.data)).reduce((acc, r) => acc + (Number(r.valorUnitario || r.valor || 0) * Number(r.quantidade || 1)), 0);
    
    let receitaTalhoesPeriodo = 0;
    let receitaGargaloPendente = 0;

    talhoes.forEach(t => {
      const amostras = amostrasBrutas.filter(a => String(a.talhaoId) === String(t.id));
      const cubagens = cubagensBrutas.filter(c => String(c.talhaoId) === String(t.id));
      const feitoTalhao = amostras.filter(a => ["concluida", "exportada", "concluido"].includes(String(a.status || "").toLowerCase())).length + cubagens.filter(c => Number(c.alturaTotal || 0) > 0).length;
      const totalTalhao = amostras.length + cubagens.length;
      if (isNoPeriodo(t.dataFaturamento)) receitaTalhoesPeriodo += feitoTalhao * 185;
      if (feitoTalhao > 0 && feitoTalhao === totalTalhao && !t.statusFaturamento) receitaGargaloPendente += feitoTalhao * 185;
    });

    const receitaConfirmada = receitaManual + receitaTalhoesPeriodo;
    const investimentoTotal = custoFolhaEfetivo + custoCampoTotal + custoAdmProjetos + custoManutencaoFrotaPeriodo;
    const lucroReal = receitaConfirmada - investimentoTotal;
    const margem = receitaConfirmada > 0 ? (lucroReal / receitaConfirmada) * 100 : 0;

    return {
      custoFolhaEfetivo, custoFolhaTotalMensal, custoManutencaoFrotaPeriodo, custoCampoTotal, custoAdmProjetos,
      investimentoTotalPeriodo: investimentoTotal, receitaConfirmadaPeriodo: receitaConfirmada,
      receitaPendente: receitaGargaloPendente, lucroRealPeriodo: lucroReal, margemPeriodo: margem.toFixed(1), diasOperados
    };
  }, [talhoes, colaboradores, manutencoesGlobais, diarios, gastosAdmGlobais, receitasManuaisGlobais, amostrasBrutas, cubagensBrutas, mesSel, anoSel]);

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // ✅ FUNÇÃO DE EXPORTAÇÃO PDF (ERP PROFISSIONAL)
  const exportarRelatorioPerformance = async () => {
    const doc = new jsPDF();
    const competencia = `${meses[mesSel]} / ${anoSel}`;
    
    // Configurações de Estilo
    doc.setFontSize(22);
    doc.setTextColor(2, 56, 83); // Navy GeoForest
    doc.text("Relatório Executivo de Performance", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Empresa Licenciada: ${licenseId}`, 14, 28);
    doc.text(`Competência Analisada: ${competencia}`, 14, 33);
    doc.text(`Emissor: ${userName} | Data: ${new Date().toLocaleString('pt-BR')}`, 14, 38);

    // Tabela de Indicadores Financeiros
    autoTable(doc, {
      startY: 45,
      head: [['Indicador Financeiro', 'Valor']],
      body: [
        ['Faturamento Bruto (Confirmado)', `R$ ${bi.receitaConfirmadaPeriodo.toLocaleString('pt-BR')}`],
        ['Custos Operacionais de Campo', `R$ ${bi.custoCampoTotal.toLocaleString('pt-BR')}`],
        ['Custos de Manutenção (Frota)', `R$ ${bi.custoManutencaoFrotaPeriodo.toLocaleString('pt-BR')}`],
        ['Rateio de Mão de Obra (Folha Efetiva)', `R$ ${bi.custoFolhaEfetivo.toLocaleString('pt-BR')}`],
        ['Despesas Administrativas (ADM)', `R$ ${bi.custoAdmProjetos.toLocaleString('pt-BR')}`],
        ['Investimento Total no Período', `R$ ${bi.investimentoTotalPeriodo.toLocaleString('pt-BR')}`],
        ['Resultado Líquido (EBITDA)', `R$ ${bi.lucroRealPeriodo.toLocaleString('pt-BR')}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [2, 56, 83], textColor: [235, 228, 171] },
    });

    // Tabela de Eficiência Técnica
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Métrica Operacional', 'Resultado']],
      body: [
        ['Dias Efetivos de Campo', `${bi.diasOperados} dias`],
        ['Colaboradores Alocados', `${colaboradores.length} pessoas`],
        ['Margem de Lucratividade', `${bi.margemPeriodo}%`],
        ['Gargalo de Medição (A faturar)', `R$ ${bi.receitaPendente.toLocaleString('pt-BR')}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // Emerald
    });

    // Registro de Auditoria
    await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Exportou Relatório de Performance Mensal: ${competencia}`);

    doc.save(`Performance_Mensal_${meses[mesSel]}_${anoSel}.pdf`);
  };

  const chartDataCustos = [
    { name: 'Pessoas', valor: bi.custoFolhaEfetivo },
    { name: 'Frota', valor: bi.custoManutencaoFrotaPeriodo },
    { name: 'Campo', valor: bi.custoCampoTotal },
    { name: 'ADM', valor: bi.custoAdmProjetos },
  ];

  if (loading || authLoading) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando BI...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900">
      
      {/* FILTRO TEMPORAL + BOTÃO EXPORTAR */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 text-emerald-400 rounded-2xl"><Calendar size={20}/></div>
            <div>
                <h1 className="text-2xl font-black tracking-tighter uppercase">Painel de Resultado</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análise de Performance Mensal</p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <select className="bg-slate-50 border-none rounded-xl p-3 font-black text-xs uppercase outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer" value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))}>
                {meses.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="bg-slate-50 border-none rounded-xl p-3 font-black text-xs uppercase outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer" value={anoSel} onChange={(e) => setAnoSel(Number(e.target.value))}>
                {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            
            {/* ✅ BOTÃO EXPORTAR PDF */}
            <button 
                onClick={exportarRelatorioPerformance}
                className="ml-4 flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-xl"
            >
                <FileText size={16} className="text-emerald-400" /> Exportar PDF
            </button>
        </div>

        <div className="bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100 flex items-center gap-4">
            <div className="text-right">
                <p className="text-[9px] font-black text-emerald-600 uppercase">Eficiência Real</p>
                <h2 className="text-xl font-black text-emerald-700">{bi.margemPeriodo}%</h2>
            </div>
            {Number(bi.margemPeriodo) > 0 ? <TrendingUp className="text-emerald-500" /> : <ArrowDownRight className="text-red-500"/>}
        </div>
      </div>

      {/* KPIs (Inalterados, mantendo integridade visual) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
            <DollarSign className="absolute -right-4 -bottom-4 text-emerald-500/10 group-hover:scale-125 transition-transform" size={120} />
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Faturamento Bruto</p>
            <h2 className="text-3xl font-black">R$ {bi.receitaConfirmadaPeriodo.toLocaleString('pt-BR')}</h2>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Gargalo de Medição</p>
            <h2 className="text-3xl font-black text-amber-500">R$ {bi.receitaPendente.toLocaleString('pt-BR')}</h2>
            <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Concluído mas não faturado</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Custo Operacional</p>
            <h2 className="text-3xl font-black text-red-500">R$ {bi.investimentoTotalPeriodo.toLocaleString('pt-BR')}</h2>
            <p className="text-[8px] text-slate-400 font-bold mt-2 uppercase">Mão de Obra Efetiva + Operação</p>
        </div>

        <div className="bg-emerald-500 p-8 rounded-[40px] text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
            <Landmark className="absolute -right-4 -bottom-4 text-white/10" size={100} />
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">EBITDA (Lucro Real)</p>
            <h2 className="text-3xl font-black">R$ {bi.lucroRealPeriodo.toLocaleString('pt-BR')}</h2>
            <span className="bg-white/20 px-2 py-1 rounded-lg text-[9px] font-black uppercase w-fit">Margem de Contribuição</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm flex flex-col h-[450px]">
            <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 mb-8">Distribuição de Custos em {meses[mesSel]}</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataCustos}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontVariant="small-caps" fontWeight="bold" />
                        <YAxis hide />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={60}>
                            {chartDataCustos.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#0f172a' : index === 1 ? '#3b82f6' : index === 2 ? '#10b981' : '#f43f5e'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* RESUMO LATERAL */}
        <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl flex flex-col justify-between">
            <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Análise de Folha vs. Produção</h4>
                <div className="space-y-8">
                    <div>
                        <p className="text-slate-400 text-[9px] uppercase font-bold mb-1">Custo Folha Efetivo ({bi.diasOperados} dias)</p>
                        <p className="text-2xl font-black text-white">R$ {bi.custoFolhaEfetivo.toLocaleString('pt-BR')}</p>
                        <p className="text-[8px] text-slate-500 mt-1">Folha Total: R$ {bi.custoFolhaTotalMensal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-[9px] uppercase font-bold mb-1">Oficina & Logística</p>
                        <p className="text-2xl font-black text-blue-400">R$ {bi.custoManutencaoFrotaPeriodo.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-[9px] uppercase font-bold mb-1">Gastos de Viagem (Campo)</p>
                        <p className="text-2xl font-black text-emerald-400">R$ {bi.custoCampoTotal.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>
            <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase">Capacidade Técnica</p>
                    <h2 className="text-3xl font-black text-white">{colaboradores.length} <span className="text-xs text-slate-600">Pessoas</span></h2>
                </div>
                <HardHat className="text-emerald-500" size={32} />
            </div>
        </div>
      </div>
    </div>
  );
}