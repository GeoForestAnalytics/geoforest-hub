"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, collectionGroup } from "firebase/firestore";
import Link from "next/link";
import { useLicense } from "../hooks/useAuthContext"; 
import { 
  TrendingUp, 
  Wallet, 
  CheckCircle2, 
  Plus,
  Briefcase,
  ArrowUpRight,
  Banknote
} from "lucide-react";

interface Projeto {
  id: string;
  nome: string;
  empresa: string;
  responsavel: string;
  status: string;
  totalTalhoes: number;
  talhoesConcluidos: number;
}

export default function ProjetosPage() {
  const { licenseId, loading: authLoading } = useLicense(); 
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [todosDiarios, setTodosDiarios] = useState<any[]>([]);
  const [todosGastosAdm, setTodosGastosAdm] = useState<any[]>([]); // ✅ Novo estado para gastos ADM
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
     // Trava de segurança: só roda se tiver o ID da empresa
    if (!licenseId) return;

    setLoadingData(true);

    // 1. Monitorar Projetos
    const unsubProj = onSnapshot(collection(db, `clientes/${licenseId}/projetos`), (snapshot) => {
      setProjetos(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        totalTalhoes: Number(doc.data().totalTalhoes || 0),
        talhoesConcluidos: Number(doc.data().talhoesConcluidos || 0),
      } as Projeto)));
    });

    // 2. Monitorar Diários de Campo (Custos operacionais)
    const unsubDiarios = onSnapshot(collection(db, `clientes/${licenseId}/diarios_de_campo`), (snapshot) => {
      setTodosDiarios(snapshot.docs.map(doc => doc.data()));
    });

    // 3. Monitorar Gastos Administrativos de TODOS os projetos da empresa
    // Usamos collectionGroup para pegar todos os "gastos_adm" que existem dentro de qualquer projeto dessa licença
    const unsubGastosGlobal = onSnapshot(collectionGroup(db, "gastos_adm"), (snapshot) => {
        // Filtramos manualmente para pegar apenas os que pertencem à licença atual por segurança
        const gastosDaEmpresa = snapshot.docs
            .filter(doc => doc.ref.path.includes(licenseId))
            .map(doc => doc.data());
        setTodosGastosAdm(gastosDaEmpresa);
        setLoadingData(false);
    });

    return () => { 
        unsubProj(); 
        unsubDiarios(); 
        unsubGastosGlobal(); 
    };
  }, [licenseId]); // Dependência única e estável

  // --- CÁLCULOS EXECUTIVOS GLOBAIS (CAMPO + ADM) ---
  const globalKpis = useMemo(() => {
    // Soma Diários (Campo)
    const custoCampo = todosDiarios.reduce((acc, d) => acc + 
        (Number(d.abastecimentoValor || d.abastecimento_valor) || 0) + 
        (Number(d.pedagioValor || d.pedagio_valor) || 0) + 
        (Number(d.alimentacaoRefeicaoValor || d.alimentacao_refeicao_valor) || 0) +
        (Number(d.outrasDespesasValor || d.outras_despesas_valor) || 0), 0);

    // Soma Gastos ADM (Escritório/Gestão)
    const custoAdm = todosGastosAdm.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);

    const investimentoTotal = custoCampo + custoAdm;
    const amostrasFeitas = projetos.reduce((acc, p) => acc + p.talhoesConcluidos, 0);
    const totalAmostras = projetos.reduce((acc, p) => acc + p.totalTalhoes, 0);
    
    return {
      investimentoTotal,
      amostrasTotais: amostrasFeitas,
      eficiencia: amostrasFeitas > 0 ? investimentoTotal / amostrasFeitas : 0,
      progressoGlobal: totalAmostras > 0 ? Math.round((amostrasFeitas / totalAmostras) * 100) : 0
    };
  }, [todosDiarios, todosGastosAdm, projetos]);

  if (authLoading || (loadingData && projetos.length === 0)) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-slate-500 animate-pulse font-bold text-xs uppercase tracking-widest">Consolidando Gestão...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      
      <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-tight">Gestão de Contratos</h1>
          <p className="text-slate-500 font-medium italic">Painel de controle financeiro e operacional da empresa.</p>
        </div>
        <button className="bg-slate-900 text-emerald-400 px-8 py-4 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-2xl flex items-center gap-2">
          <Plus size={18} /> Novo Projeto
        </button>
      </header>

      {/* CARDS EXECUTIVOS GLOBAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
            <Banknote className="absolute -right-6 -bottom-6 text-emerald-500/10 group-hover:scale-110 transition-transform" size={140} />
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Investimento Total</p>
            <h2 className="text-3xl font-black mt-2">R$ {globalKpis.investimentoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            <p className="text-slate-500 text-[8px] mt-4 font-bold uppercase tracking-tighter">Campo + Administrativo</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-blue-100 p-3 rounded-2xl w-fit text-blue-700 mb-4"><CheckCircle2 size={24}/></div>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Produção Total</p>
                <h2 className="text-3xl font-black text-slate-900">{globalKpis.amostrasTotais} <span className="text-sm font-medium text-slate-400">Amostras</span></h2>
            </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl w-fit mb-4"><Wallet size={24}/></div>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Custo Médio p/ Unidade</p>
                <h2 className="text-2xl font-black text-slate-900">R$ {globalKpis.eficiencia.toFixed(2)}</h2>
            </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Progresso Global</p>
                <span className="text-lg font-black text-emerald-600">{globalKpis.progressoGlobal}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${globalKpis.progressoGlobal}%` }}></div>
            </div>
        </div>
      </div>

      <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
        <Briefcase size={14}/> Carteira de Projetos Ativos
      </h2>

      {/* LISTA DE PROJETOS MANTIDA IGUAL AO SEU DESIGN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projetos.map((proj) => {
          const porcentagem = proj.totalTalhoes > 0 ? Math.round((proj.talhoesConcluidos / proj.totalTalhoes) * 100) : 0;
          return (
            <Link href={`/projetos/${proj.id}`} key={proj.id}>
              <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-2xl hover:border-emerald-500 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-6">
                  <div>
                      <h3 className="font-black text-xl text-slate-900 group-hover:text-emerald-600 uppercase tracking-tighter transition-colors">{proj.nome}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{proj.empresa}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all"><ArrowUpRight size={20} /></div>
                </div>
                
                <div className="flex items-center gap-4 mb-8 text-[10px] font-black uppercase">
                    <div className="flex flex-col"><span className="text-slate-400">Status</span><span className="text-emerald-600">{proj.status}</span></div>
                    <div className="w-px h-6 bg-slate-100"></div>
                    <div className="flex flex-col"><span className="text-slate-400">Responsável</span><span className="text-slate-700">{proj.responsavel.split(' ')[0]}</span></div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>Execução</span>
                    <span className="text-emerald-600">{porcentagem}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${porcentagem}%` }}></div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}