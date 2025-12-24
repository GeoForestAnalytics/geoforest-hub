"use client"
import { useEffect, useState } from "react";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { 
  CircleDollarSign, 
  Fuel, 
  Utensils, 
  Route, // Ícone corrigido aqui
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
            // Filtra apenas as que o técnico marcou como concluída
            const concluidas = snap.docs.filter(d => d.data().status === 'concluida').length;
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

  // --- LÓGICA DE CÁLCULOS FINANCEIROS ---
  const somaAbastecimento = diarios.reduce((acc, d) => acc + (Number(d.abastecimentoValor) || 0), 0);
  const somaAlimentacao = diarios.reduce((acc, d) => acc + (Number(d.alimentacaoRefeicaoValor) || 0), 0);
  const somaPedagio = diarios.reduce((acc, d) => acc + (Number(d.pedagioValor) || 0), 0);
  const somaOutros = diarios.reduce((acc, d) => acc + (Number(d.outrasDespesasValor) || 0), 0);
  
  const custoTotal = somaAbastecimento + somaAlimentacao + somaPedagio + somaOutros;
  
  const totalKm = diarios.reduce((acc, d) => {
    const km = (Number(d.kmFinal || 0) - Number(d.kmInicial || 0));
    return acc + (km > 0 ? km : 0);
  }, 0);

  const custoPorAmostra = totalAmostras > 0 ? custoTotal / totalAmostras : 0;
  const custoPorKm = totalKm > 0 ? somaAbastecimento / totalKm : 0;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-emerald-600 font-bold animate-pulse uppercase text-xs tracking-widest">Consolidando Fluxo de Caixa...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Gestão Financeira</h1>
          <p className="text-slate-500 font-medium">Controle de gastos operacionais sincronizados do campo.</p>
        </div>
        <div className="bg-slate-900 text-white px-8 py-4 rounded-[24px] shadow-2xl border-b-4 border-emerald-500">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Custo Total Acumulado</p>
            <p className="text-3xl font-black">R$ {custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
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
          <p className="text-slate-400 text-xs font-bold uppercase">Custo por Parcela</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {custoPorAmostra.toFixed(2)}</h2>
          <p className="text-[9px] text-slate-400 mt-2">Baseado em {totalAmostras} amostras concluídas</p>
        </div>

        {/* KPI: QUILOMETRAGEM */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-4"><Route size={20} /></div>
          <p className="text-slate-400 text-xs font-bold uppercase">Rodagem Total</p>
          <h2 className="text-2xl font-black text-slate-800">{totalKm.toLocaleString()} <span className="text-xs font-normal">KM</span></h2>
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
          <p className="text-slate-400 text-xs font-bold uppercase">Alimentação</p>
          <h2 className="text-2xl font-black text-slate-800">R$ {somaAlimentacao.toFixed(2)}</h2>
          <p className="text-[9px] text-slate-400 mt-2">Total gasto com marmitas e refeições</p>
        </div>

      </div>

      {/* TABELA DE EXTRATO */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Receipt className="text-slate-400" size={20} />
                <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Extrato Detalhado de Campo</h3>
            </div>
            <div className="flex gap-2">
                <button className="text-[9px] font-black bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all">GERAR PDF</button>
                <button className="text-[9px] font-black bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all">EXPORTAR CSV</button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 font-black border-b bg-white">
                <th className="p-6">Data</th>
                <th className="p-6">Líder / Equipe</th>
                <th className="p-6 text-center">KM</th>
                <th className="p-6 text-center">Combustível</th>
                <th className="p-6 text-center">Alimentação</th>
                <th className="p-6 text-center">Pedágio/Outros</th>
                <th className="p-6 text-right">Total Dia</th>
              </tr>
            </thead>
            <tbody>
              {diarios.sort((a,b) => b.dataRelatorio.localeCompare(a.dataRelatorio)).map((d) => {
                const kmDia = (Number(d.kmFinal || 0) - Number(d.kmInicial || 0));
                const custoDia = (Number(d.abastecimentoValue) || Number(d.abastecimentoValor) || 0) + 
                                 (Number(d.pedagioValor) || 0) + 
                                 (Number(d.alimentacaoRefeicaoValor) || 0) + 
                                 (Number(d.outrasDespesasValor) || 0);

                return (
                  <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                    <td className="p-6 text-sm font-bold text-slate-700">{new Date(d.dataRelatorio).toLocaleDateString('pt-BR')}</td>
                    <td className="p-6 text-sm text-slate-600 font-medium">{d.nomeLider}</td>
                    <td className="p-6 text-sm text-slate-500 text-center">{kmDia > 0 ? kmDia + ' km' : '--'}</td>
                    <td className="p-6 text-sm text-slate-500 text-center">R$ {d.abastecimentoValor?.toFixed(2) || '0,00'}</td>
                    <td className="p-6 text-sm text-slate-500 text-center">R$ {d.alimentacaoRefeicaoValor?.toFixed(2) || '0,00'}</td>
                    <td className="p-6 text-sm text-slate-500 text-center">R$ {((d.pedagioValor || 0) + (d.outrasDespesasValor || 0)).toFixed(2)}</td>
                    <td className="p-6 text-sm font-black text-slate-900 text-right bg-slate-50/30 group-hover:bg-emerald-50 transition-colors">
                        R$ {custoDia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {diarios.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center justify-center text-slate-400">
             <AlertCircle size={48} className="mb-4 opacity-20" />
             <p className="font-bold uppercase tracking-widest text-xs">Nenhum lançamento financeiro encontrado.</p>
             <p className="text-[10px]">Os dados aparecem aqui conforme os Diários de Campo são sincronizados no App.</p>
          </div>
        )}
      </div>
    </div>
  );
}