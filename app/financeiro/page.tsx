"use client"
import { useEffect, useState } from "react";
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
  AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function FinanceiroPage() {
  const [diarios, setDiarios] = useState<any[]>([]);
  const [totalAmostras, setTotalAmostras] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Função para formatar data de forma robusta (corrige o erro "Invalid Date")
  const formatarDataExibicao = (dataStr: string) => {
    if (!dataStr) return "--/--/----";
    try {
      // Se a data vier com 'T' (ISO), pegamos apenas a parte da data
      const dataLimpa = dataStr.includes('T') ? dataStr.split('T')[0] : dataStr;
      
      // Tenta converter formatos YYYY-MM-DD para DD/MM/YYYY
      if (dataLimpa.includes('-')) {
        const [ano, mes, dia] = dataLimpa.split('-');
        return `${dia}/${mes}/${ano}`;
      }
      return dataLimpa; // Retorna original se já estiver formatada
    } catch (e) {
      return "Data Inválida";
    }
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const uid = user.uid;

        // 1. Busca Diários de Campo (Custos vindos do Flutter)
        const qDiarios = query(collection(db, `clientes/${uid}/diarios_de_campo`));
        const unsubDiarios = onSnapshot(qDiarios, (snap) => {
          setDiarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 2. Busca Total de Coletas Realizadas (Base para custo unitário)
        const qColetas = query(collection(db, `clientes/${uid}/dados_coleta`));
        const unsubColetas = onSnapshot(qColetas, (snap) => {
            // Filtra 'concluida' ou 'exportada' para garantir que o custo unitário seja real
            const concluidas = snap.docs.filter(d => 
              d.data().status === 'concluida' || d.data().status === 'exportada'
            ).length;
            setTotalAmostras(concluidas);
            setLoading(false);
        });

        return () => {
          unsubDiarios();
          unsubColetas();
        };
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // --- LÓGICA DE CÁLCULOS FINANCEIROS (Mapeamento de nomes de campos flexível) ---
  const somaAbastecimento = diarios.reduce((acc, d) => 
    acc + (Number(d.abastecimentoValor) || Number(d.abastecimento_valor) || 0), 0);
  
  const somaAlimentacao = diarios.reduce((acc, d) => 
    acc + (Number(d.alimentacaoRefeicaoValor) || Number(d.alimentacao_refeicao_valor) || 0), 0);
  
  const somaPedagio = diarios.reduce((acc, d) => 
    acc + (Number(d.pedagioValor) || Number(d.pedagio_valor) || 0), 0);
  
  const somaOutros = diarios.reduce((acc, d) => 
    acc + (Number(d.outrasDespesasValor) || Number(d.outras_despesas_valor) || 0), 0);
  
  const custoTotal = somaAbastecimento + somaAlimentacao + somaPedagio + somaOutros;
  
  const totalKm = diarios.reduce((acc, d) => {
    const kmFinal = Number(d.kmFinal) || Number(d.km_final) || 0;
    const kmInicial = Number(d.kmInicial) || Number(d.km_inicial) || 0;
    const diferenca = kmFinal - kmInicial;
    return acc + (diferenca > 0 ? diferenca : 0);
  }, 0);

  const custoPorAmostra = totalAmostras > 0 ? custoTotal / totalAmostras : 0;
  const custoPorKm = totalKm > 0 ? somaAbastecimento / totalKm : 0;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-emerald-600 font-bold animate-pulse uppercase text-xs tracking-widest">Sincronizando Fluxo Financeiro...</p>
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
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Custo Total Consolidado</p>
            <p className="text-4xl font-black">R$ {custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
      </header>

      {/* CARDS DE INDICADORES (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        
        {/* KPI: CUSTO POR AMOSTRA */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Target size={20}/></div>
            <span className="text-[8px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full uppercase">Eficiência</span>
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase">Custo Médio / Parcela</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {custoPorAmostra.toFixed(2)}</h2>
          <p className="text-[9px] text-slate-400 mt-2">Baseado em {totalAmostras} coletas concluídas</p>
        </div>

        {/* KPI: QUILOMETRAGEM */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-4"><Route size={20} /></div>
          <p className="text-slate-400 text-xs font-bold uppercase">Rodagem Total</p>
          <h2 className="text-2xl font-black text-slate-800">{totalKm.toLocaleString('pt-BR')} <span className="text-xs font-normal">KM</span></h2>
          <p className="text-[9px] text-slate-400 mt-2">Distância total percorrida pela frota</p>
        </div>

        {/* KPI: COMBUSTÍVEL */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-amber-100 w-10 h-10 rounded-xl flex items-center justify-center text-amber-600 mb-4"><Fuel size={20} /></div>
          <p className="text-slate-400 text-xs font-bold uppercase">Diesel por KM</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {custoPorKm.toFixed(2)}</h2>
          <p className="text-[9px] text-slate-400 mt-2">Gasto médio de combustível por KM</p>
        </div>

        {/* KPI: ALIMENTAÇÃO */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-purple-100 w-10 h-10 rounded-xl flex items-center justify-center text-purple-600 mb-4"><Utensils size={20} /></div>
          <p className="text-slate-400 text-xs font-bold uppercase">Total Alimentação</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {somaAlimentacao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
          <p className="text-[9px] text-slate-400 mt-2">Marmitas e refeições em trânsito</p>
        </div>

      </div>

      {/* TABELA DE EXTRATO */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-8 bg-slate-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <Receipt className="text-emerald-500" size={24} />
                <div>
                  <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Extrato Analítico de Campo</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Lançamentos sincronizados via Diário de Campo</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button className="text-[9px] font-black bg-white border border-slate-200 px-6 py-3 rounded-2xl hover:bg-slate-100 transition-all shadow-sm">GERAR PDF</button>
                <button className="text-[9px] font-black bg-emerald-600 text-white px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-md">EXPORTAR CSV</button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-black border-b bg-white">
                <th className="p-8">Data do Relatório</th>
                <th className="p-8">Líder Responsável</th>
                <th className="p-8 text-center">KM Percorrido</th>
                <th className="p-8 text-center">Combustível</th>
                <th className="p-8 text-center">Alimentação</th>
                <th className="p-8 text-right">Total do Dia</th>
              </tr>
            </thead>
            <tbody>
              {diarios.sort((a,b) => (b.dataRelatorio || "").localeCompare(a.dataRelatorio || "")).map((d) => {
                const kmFinal = Number(d.kmFinal) || Number(d.km_final) || 0;
                const kmInicial = Number(d.kmInicial) || Number(d.km_inicial) || 0;
                const kmDia = kmFinal - kmInicial;
                
                const custoDia = (Number(d.abastecimentoValor) || Number(d.abastecimento_valor) || 0) + 
                                 (Number(d.pedagioValor) || Number(d.pedagio_valor) || 0) + 
                                 (Number(d.alimentacaoRefeicaoValor) || Number(d.alimentacao_refeicao_valor) || 0) + 
                                 (Number(d.outrasDespesasValor) || Number(d.outras_despesas_valor) || 0);

                return (
                  <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                    <td className="p-8 text-sm font-black text-slate-700">{formatarDataExibicao(d.dataRelatorio)}</td>
                    <td className="p-8 text-sm text-slate-600 font-bold uppercase tracking-tight">{d.nomeLider || d.nome_lider}</td>
                    <td className="p-8 text-sm text-slate-500 text-center font-medium">{kmDia > 0 ? kmDia.toLocaleString('pt-BR') + ' km' : '--'}</td>
                    <td className="p-8 text-sm text-slate-500 text-center font-medium">R$ {(Number(d.abastecimentoValor) || Number(d.abastecimento_valor) || 0).toFixed(2)}</td>
                    <td className="p-8 text-sm text-slate-500 text-center font-medium">R$ {(Number(d.alimentacaoRefeicaoValor) || Number(d.alimentacao_refeicao_valor) || 0).toFixed(2)}</td>
                    <td className="p-8 text-sm font-black text-slate-900 text-right bg-slate-50/30 group-hover:bg-emerald-50 transition-colors">
                        R$ {custoDia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {diarios.length === 0 && (
          <div className="p-24 text-center flex flex-col items-center justify-center text-slate-400">
             <AlertCircle size={64} className="mb-6 opacity-10" />
             <p className="font-black uppercase tracking-widest text-sm text-slate-300">Nenhum lançamento financeiro encontrado.</p>
             <p className="text-[10px] mt-2 max-w-xs mx-auto">Os dados financeiros são extraídos dos Diários de Campo sincronizados pelo App móvel.</p>
          </div>
        )}
      </div>
      
      <footer className="mt-10 text-center">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">GeoForest ERP • Inteligência em Gestão Florestal</p>
      </footer>
    </div>
  );
}