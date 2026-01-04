"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { useLicense } from "../hooks/useAuthContext"; 
import { registerLog } from "../lib/audit/audit"; // ✅ Importando o sistema de auditoria
import { 
  TrendingUp, 
  Wallet, 
  CheckCircle2, 
  Plus,
  Briefcase,
  ArrowUpRight,
  Banknote,
  Trash2 
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
  // ✅ Pegando os dados expandidos do hook: role, userId e userName
  const { licenseId, role, userId, userName, loading: authLoading } = useLicense(); 
  
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [todosDiarios, setTodosDiarios] = useState<any[]>([]);
  const [todosGastosAdm, setTodosGastosAdm] = useState<any[]>([]);
  const [totalCubagens, setTotalCubagens] = useState(0); 
  const [loadingData, setLoadingData] = useState(true);

  // ✅ Definição de permissão (Fundamento ERP)
  const isGerente = role === 'gerente' || role === 'admin';

  useEffect(() => {
    if (!licenseId) return;
    setLoadingData(true);

    const unsubProj = onSnapshot(collection(db, `clientes/${licenseId}/projetos`), (snapshot) => {
      setProjetos(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        totalTalhoes: Number(doc.data().totalTalhoes || 0),
        talhoesConcluidos: Number(doc.data().talhoesConcluidos || 0),
      } as Projeto)));
    });

    const unsubDiarios = onSnapshot(collection(db, `clientes/${licenseId}/diarios_de_campo`), (snapshot) => {
      setTodosDiarios(snapshot.docs.map(doc => doc.data()));
    });

    // Mantenho a busca global que você criou para o BI
    const unsubGastosGlobal = onSnapshot(collection(db, `clientes/${licenseId}/gastos_adm`), (snapshot) => {
        setTodosGastosAdm(snapshot.docs.map(doc => doc.data()));
    });

    const unsubCubagem = onSnapshot(collection(db, `clientes/${licenseId}/dados_cubagem`), (snapshot) => {
        const concluidas = snapshot.docs.filter(doc => (Number(doc.data().alturaTotal) || 0) > 0).length;
        setTotalCubagens(concluidas);
        setLoadingData(false);
    });

    return () => { 
        unsubProj(); 
        unsubDiarios(); 
        unsubGastosGlobal(); 
        unsubCubagem();
    };
  }, [licenseId]);

  const handleExcluirProjeto = async (e: React.MouseEvent, id: any, nome: string) => {
    e.preventDefault();
    e.stopPropagation();

    // ✅ Trava de segurança no clique (RBAC)
    if (!isGerente) {
      alert("Operação não permitida: Apenas gestores podem remover contratos do sistema.");
      return;
    }

    if (!confirm(`⚠️ ATENÇÃO: Esta ação é irreversível. Deseja excluir o projeto "${nome}" e todos os seus vínculos?`)) {
      return;
    }

    try {
      const projetoRef = doc(db, "clientes", String(licenseId), "projetos", String(id));
      await deleteDoc(projetoRef);

      // ✅ REGISTRO DE AUDITORIA: Quem, quando e o quê (Fundamento de ERP Profissional)
      await registerLog(
        licenseId!, 
        userId!, 
        userName!, 
        'EXCLUSAO_PROJETO', 
        `Removeu o contrato: ${nome} (ID: ${id})`
      );

    } catch (error: any) {
      console.error("Erro detalhado ao excluir projeto:", error);
      alert(`Falha na exclusão: ${error.message.includes("permission") ? "Acesso negado pelas regras de segurança." : error.message}`);
    }
  };

  const globalKpis = useMemo(() => {
    const custoCampo = todosDiarios.reduce((acc, d) => acc + 
        (Number(d.abastecimentoValor || d.abastecimento_valor) || 0) + 
        (Number(d.pedagioValor || d.pedagio_valor) || 0) + 
        (Number(d.alimentacaoRefeicaoValor || d.alimentacao_refeicao_valor) || 0) +
        (Number(d.outrasDespesasValor || d.outras_despesas_valor) || 0), 0);

    const custoAdm = todosGastosAdm.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const investimentoTotal = custoCampo + custoAdm;

    const amostrasFeitas = projetos.reduce((acc, p) => acc + p.talhoesConcluidos, 0);
    const producaoTotalUnidades = amostrasFeitas + totalCubagens;
    
    return {
      investimentoTotal,
      amostrasTotais: amostrasFeitas,
      cubagensTotais: totalCubagens,
      unidadesTotais: producaoTotalUnidades,
      eficiencia: producaoTotalUnidades > 0 ? investimentoTotal / producaoTotalUnidades : 0,
      progressoGlobal: projetos.reduce((acc, p) => acc + p.totalTalhoes, 0) > 0 
        ? Math.round((amostrasFeitas / projetos.reduce((acc, p) => acc + p.totalTalhoes, 0)) * 100) 
        : 0
    };
  }, [todosDiarios, todosGastosAdm, projetos, totalCubagens]);

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
          <p className="text-slate-500 font-medium italic">Ambiente de Controle: {userName} ({role})</p>
        </div>
        
        {/* ✅ BOTÃO PROTEGIDO: Somente Gerentes criam projetos */}
        {isGerente && (
          <button className="bg-slate-900 text-emerald-400 px-8 py-4 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-2xl flex items-center gap-2">
            <Plus size={18} /> Novo Projeto
          </button>
        )}
      </header>

      {/* CARDS EXECUTIVOS GLOBAIS (Mantidos conforme seu código original) */}
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
                <h2 className="text-3xl font-black text-slate-900">{globalKpis.unidadesTotais}</h2>
                <div className="flex gap-2 mt-1">
                    <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500 uppercase">{globalKpis.amostrasTotais} Amostras</span>
                    <span className="text-[9px] bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-emerald-600 uppercase">{globalKpis.cubagensTotais} Cubagens</span>
                </div>
            </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl w-fit mb-4"><Wallet size={24}/></div>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Custo Médio p/ Unidade</p>
                <h2 className="text-2xl font-black text-slate-900">R$ {globalKpis.eficiencia.toFixed(2)}</h2>
                <p className="text-[8px] text-slate-400 font-medium italic mt-1">(Considerando Amostras + Árvores)</p>
            </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Progresso Amostras</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projetos.map((proj) => {
          const porcentagem = proj.totalTalhoes > 0 ? Math.round((proj.talhoesConcluidos / proj.totalTalhoes) * 100) : 0;
          return (
            <Link href={`/projetos/${proj.id}`} key={proj.id} className="relative group">
              
              {/* ✅ BOTÃO EXCLUIR PROTEGIDO: Só aparece para quem é gerente */}
              {isGerente && (
                <button 
                  onClick={(e) => handleExcluirProjeto(e, proj.id, proj.nome)}
                  className="absolute top-4 right-4 z-10 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  title="Excluir Projeto"
                >
                  <Trash2 size={16} />
                </button>
              )}

              <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-2xl hover:border-emerald-500 transition-all cursor-pointer">
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
                    <span>Execução Técnica</span>
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