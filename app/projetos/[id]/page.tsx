"use client"
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../lib/firebase";  
import { 
  doc, getDoc, collection, onSnapshot, query, 
  where, addDoc, serverTimestamp, deleteDoc 
} from "firebase/firestore";
import Link from "next/link";
import { useLicense } from "../../hooks/useAuthContext"; 
import { registerLog } from "../../lib/audit/audit"; // ✅ Auditoria
import { 
  BarChart3, Ruler, ArrowLeft, Settings, ChevronDown, ChevronUp,
  MapPin, ListChecks, TreeDeciduous, Axe, Plus, Trash2,
  DollarSign, ArrowDownCircle, ArrowUpCircle, AlertCircle,
  CheckCircle2, TrendingUp, Wallet
} from "lucide-react";

export default function DetalhesProjeto() {
  const params = useParams(); 
  const router = useRouter();
  const projId = params.id as string;
  
  // ✅ Governança
  const { licenseId, role, userId, userName, loading: authLoading } = useLicense();
  const isGerente = role === 'gerente' || role === 'admin';

  const [projeto, setProjeto] = useState<any>(null);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [amostras, setAmostras] = useState<any[]>([]); 
  const [cubagens, setCubagens] = useState<any[]>([]); 
  const [diarios, setDiarios] = useState<any[]>([]); 
  const [gastosAdm, setGastosAdm] = useState<any[]>([]); 
  const [faturamentos, setFaturamentos] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showGastoForm, setShowGastoForm] = useState(false);
  const [showFaturaForm, setShowFaturaForm] = useState(false);

  const [novoGasto, setNovoGasto] = useState({ 
    descricao: "", valor: "", data: new Date().toISOString().split('T')[0] 
  });
  const [novaFatura, setNovaFatura] = useState({ 
    descricao: "", quantidade: "", valorUnitario: "", data: new Date().toISOString().split('T')[0] 
  });

  const [fazendasMinimizadas, setFazendasMinimizadas] = useState<string[]>([]);

  useEffect(() => {
    if (!licenseId || !projId) return;

    const carregarTudo = async () => {
      try {
        const docRef = doc(db, `clientes/${licenseId}/projetos`, projId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setProjeto(docSnap.data());

        // Listeners do Firebase (Manter sincronia em tempo real)
        const unsubAtiv = onSnapshot(query(collection(db, `clientes/${licenseId}/atividades`), where("projetoId", "in", [projId, Number(projId)])), (snap) => {
          setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubFaz = onSnapshot(collection(db, `clientes/${licenseId}/fazendas`), (snap) => {
          setFazendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubTal = onSnapshot(collection(db, `clientes/${licenseId}/talhoes`), (snap) => {
          setTalhoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubAmo = onSnapshot(query(collection(db, `clientes/${licenseId}/dados_coleta`), where("projetoId", "in", [projId, Number(projId)])), (snap) => {
          setAmostras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubCub = onSnapshot(collection(db, `clientes/${licenseId}/dados_cubagem`), (snap) => {
          setCubagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubDiarios = onSnapshot(query(collection(db, `clientes/${licenseId}/diarios_de_campo`), where("projetoId", "in", [projId, Number(projId)])), (snap) => {
            setDiarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubGastos = onSnapshot(collection(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`), (snap) => {
            setGastosAdm(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubFatur = onSnapshot(collection(db, `clientes/${licenseId}/projetos/${projId}/faturamentos`), (snap) => {
            setFaturamentos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        setLoadingData(false);
        return () => {
          unsubAtiv(); unsubFaz(); unsubTal(); unsubAmo(); unsubCub(); unsubDiarios(); unsubGastos(); unsubFatur();
        };
      } catch (error) {
        console.error(error);
        setLoadingData(false);
      }
    };
    carregarTudo(); 
  }, [projId, licenseId]);

  // ✅ CÁLCULOS TÉCNICOS E FINANCEIROS (O CORAÇÃO DO ERP)
  const financeiro = useMemo(() => {
    const custoCampo = diarios.reduce((acc, d) => acc + (Number(d.abastecimentoValor || d.abastecimento_valor || 0) + Number(d.pedagioValor || d.pedagio_valor || 0) + Number(d.alimentacaoRefeicaoValor || d.alimentacao_refeicao_valor || 0) + Number(d.outrasDespesasValor || d.outras_despesas_valor || 0)), 0);
    const custoAdm = gastosAdm.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const totalCustos = custoCampo + custoAdm;
    
    const totalReceita = faturamentos.reduce((acc, f) => acc + (Number(f.quantidade || 1) * Number(f.valorUnitario || f.valor || 0)), 0);
    const lucroLiquido = totalReceita - totalCustos;
    const margem = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0;
    
    const totalAmo = amostras.length;
    const concluidasAmo = amostras.filter(a => ["concluida", "exportada", "concluido"].includes(String(a.status || "").toLowerCase())).length;

    const progressoTotal = totalAmo > 0 ? Math.round((concluidasAmo / totalAmo) * 100) : 0;

    return { 
      totalCustos, 
      totalReceita, 
      lucroLiquido, 
      margem: margem.toFixed(1), 
      progressoTotal, 
      concluidasAmo, 
      totalAmo 
    };
  }, [diarios, gastosAdm, faturamentos, amostras]);

  // ✅ ACTIONS DE GESTOR
  const handleSalvarFaturamento = async () => {
    if (!isGerente || !novaFatura.descricao || !novaFatura.quantidade) return;
    try {
      await addDoc(collection(db, `clientes/${licenseId}/projetos/${projId}/faturamentos`), {
        ...novaFatura,
        quantidade: Number(novaFatura.quantidade),
        valorUnitario: Number(novaFatura.valorUnitario),
        createdAt: serverTimestamp()
      });
      await registerLog(licenseId!, userId!, userName!, 'FECHAMENTO_NOTAFISCAL', `Registrou faturamento: ${novaFatura.descricao} - R$ ${novaFatura.valorUnitario}`);
      setNovaFatura({ descricao: "", quantidade: "", valorUnitario: "", data: new Date().toISOString().split('T')[0] }); 
      setShowFaturaForm(false);
    } catch (e) { alert("Erro ao salvar faturamento."); }
  };

  const handleSalvarGasto = async () => {
    if (!isGerente || !novoGasto.descricao || !novoGasto.valor) return;
    try {
      await addDoc(collection(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`), {
          ...novoGasto,
          valor: Number(novoGasto.valor),
          licenseId,
          createdAt: serverTimestamp()
      });
      await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Registrou despesa administrativa: ${novoGasto.descricao} - R$ ${novoGasto.valor}`);
      setNovoGasto({ descricao: "", valor: "", data: new Date().toISOString().split('T')[0] }); 
      setShowGastoForm(false);
    } catch (e) { alert("Erro ao salvar despesa."); }
  };

  if (authLoading || (loadingData && !projeto)) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando Inteligência do Projeto...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900">
      <nav className="mb-6">
        <Link href="/projetos" className="text-[10px] font-black uppercase hover:text-emerald-600 flex items-center gap-1 transition-all text-slate-400">
          <ArrowLeft size={14} /> Voltar para Contratos
        </Link>
      </nav>

      {/* HEADER DO PROJETO */}
      <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase mb-2 inline-block">Projeto Ativo</span>
          <h1 className="text-4xl font-black text-slate-900 mb-1 tracking-tighter uppercase">{projeto?.nome}</h1>
          <p className="text-slate-400 font-medium italic text-sm">{projeto?.empresa} • Responsável: {projeto?.responsavel}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/projetos/${projId}/analise`} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase hover:bg-emerald-700 transition-all shadow-xl flex items-center gap-2">
            <ListChecks size={16}/> Auditoria QA/QC
          </Link>
          <Link href={`/projetos/${projId}/cubagem`} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase hover:bg-black transition-all shadow-xl flex items-center gap-2">
            <Axe size={16}/> Cubagem Rigorosa
          </Link>
        </div>
      </div>

      {/* DASHBOARD FINANCEIRO E PRODUTIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <DollarSign className="absolute -right-4 -bottom-4 text-emerald-500/10" size={120} />
            <div>
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Faturamento Estimado</p>
              <h2 className="text-3xl font-black mt-2">R$ {financeiro.totalReceita.toLocaleString('pt-BR')}</h2>
            </div>
            <div className={`mt-4 text-[10px] font-bold uppercase ${Number(financeiro.margem) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Margem de {financeiro.margem}%
            </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Investimento Acumulado</p>
            <h2 className="text-3xl font-black text-red-500 mt-2">R$ {financeiro.totalCustos.toLocaleString('pt-BR')}</h2>
            <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Campo + Administrativo</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Lucro Líquido Real</p>
            <h2 className={`text-3xl font-black mt-2 ${financeiro.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              R$ {financeiro.lucroLiquido.toLocaleString('pt-BR')}
            </h2>
            <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Resultado após despesas</p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Progresso Técnico</p>
            <h2 className="text-3xl font-black text-slate-900 mt-2">{financeiro.progressoTotal}%</h2>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
              <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${financeiro.progressoTotal}%` }}></div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUNA TÉCNICA (ESQUERDA) */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[48px] p-10 border border-slate-200 shadow-sm">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <TreeDeciduous size={18} className="text-emerald-500"/> Estrutura de Ativos Florestais
                </h2>
                {atividades.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 italic text-sm">Nenhuma atividade vinculada a este projeto.</div>
                ) : atividades.map((ativ) => {
                    const isCUB = ativ.tipo.toUpperCase().includes("CUB");
                    const fazendasDestaAtiv = fazendas.filter(f => f.activityId === ativ.id || f.atividadeId === ativ.id);
                    return (
                        <div key={ativ.id} className="mb-10 border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
                            <div className="bg-slate-900 p-6 px-10 flex justify-between items-center text-white">
                                <div className="flex items-center gap-4">
                                  <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                                    {isCUB ? <Axe size={18}/> : <TreeDeciduous size={18}/>}
                                  </div>
                                  <span className="font-black text-xs uppercase tracking-widest">{ativ.tipo}</span>
                                </div>
                                <span className="text-slate-500 text-[9px] font-bold uppercase">{ativ.metodoCubagem || "Inventário Padrão"}</span>
                            </div>
                            <div className="p-8 space-y-4">
                                {fazendasDestaAtiv.map(faz => {
                                    const chave = `${ativ.id}-${faz.id}`;
                                    const isMin = fazendasMinimizadas.includes(chave);
                                    const talhoesFiltrados = talhoes.filter(t => t.fazendaId === faz.id && (t.atividadeId === ativ.id || t.fazendaAtividadeId === ativ.id));
                                    const concluidosT = talhoesFiltrados.filter(tal => {
                                        const d = (isCUB ? cubagens : amostras).filter(item => String(item.talhaoId) === String(tal.id));
                                        return d.length > 0 && d.every(a => isCUB ? Number(a.alturaTotal) > 0 : ["concluida", "exportada"].includes(String(a.status).toLowerCase()));
                                    }).length;
                                    const porcFazenda = talhoesFiltrados.length > 0 ? Math.round((concluidosT / talhoesFiltrados.length) * 100) : 0;

                                    return (
                                        <div key={faz.id} className="bg-slate-50 rounded-[24px] overflow-hidden border border-slate-100">
                                            <div className="p-5 flex justify-between items-center group hover:bg-white transition-all cursor-pointer" onClick={() => {
                                              const prev = fazendasMinimizadas.includes(chave);
                                              setFazendasMinimizadas(prev ? fazendasMinimizadas.filter(id => id !== chave) : [...fazendasMinimizadas, chave]);
                                            }}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${porcFazenda === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                                    <span className="text-xs font-black text-slate-700 uppercase">{faz.nome}</span>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase">{concluidosT}/{talhoesFiltrados.length} Stand(s)</span>
                                                        <div className="w-20 bg-slate-200 h-1 rounded-full overflow-hidden mt-1">
                                                            <div className={`h-full ${porcFazenda === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${porcFazenda}%` }}></div>
                                                        </div>
                                                    </div>
                                                    {isMin ? <ChevronDown size={16} className="text-slate-300"/> : <ChevronUp size={16} className="text-slate-300"/>}
                                                </div>
                                            </div>
                                            {!isMin && (
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-200 bg-white">
                                                    {talhoesFiltrados.map(tal => (
                                                        <div key={tal.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group">
                                                            <div>
                                                              <p className="text-[11px] font-black text-slate-800 uppercase">{tal.nome}</p>
                                                              <p className="text-[9px] text-slate-400 font-bold uppercase">{tal.especie || 'Eucalipto'}</p>
                                                            </div>
                                                            <Link href={`/projetos/${projId}/talhao/${tal.id}${isCUB ? '/cubagem' : ''}`} className="p-2 bg-white rounded-xl shadow-sm text-slate-300 group-hover:text-emerald-600 transition-all">
                                                              <Settings size={14}/>
                                                            </Link>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* COLUNA FINANCEIRA (DIREITA) */}
        <div className="space-y-6">
            {/* CARD DE RECEITAS */}
            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-xl border-t-8 border-t-emerald-500">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <ArrowDownCircle className="text-emerald-500" size={20}/> Faturamento
                  </h2>
                  {isGerente && (
                    <button onClick={() => setShowFaturaForm(!showFaturaForm)} className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 transition-all">
                      <Plus size={18} />
                    </button>
                  )}
                </div>

                {showFaturaForm && (
                    <div className="mb-8 p-6 bg-emerald-50 rounded-[32px] space-y-4 border border-emerald-100">
                        <input placeholder="Descrição da Nota/Serviço" className="w-full p-4 rounded-2xl border-none text-xs font-bold outline-none" value={novaFatura.descricao} onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} />
                        <div className="flex gap-2">
                          <input type="number" placeholder="Qtd" className="w-1/3 p-4 rounded-2xl border-none text-xs font-bold outline-none" value={novaFatura.quantidade} onChange={e => setNovaFatura({...novaFatura, quantidade: e.target.value})} />
                          <input type="number" placeholder="Vlr Unit" className="w-2/3 p-4 rounded-2xl border-none text-xs font-bold outline-none" value={novaFatura.valorUnitario} onChange={e => setNovaFatura({...novaFatura, valorUnitario: e.target.value})} />
                        </div>
                        <button onClick={handleSalvarFaturamento} className="w-full bg-slate-900 text-emerald-400 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-black transition-all">Registrar Receita</button>
                    </div>
                )}

                <div className="space-y-4">
                    {faturamentos.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-4 italic">Nenhum faturamento registrado.</p>
                    ) : faturamentos.map(f => (
                        <div key={f.id} className="p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-slate-800 uppercase">{f.descricao}</p>
                            <p className="text-[9px] text-emerald-600 font-bold">{f.quantidade} un x R$ {f.valorUnitario}</p>
                          </div>
                          <span className="font-black text-emerald-700 text-xs">R$ {(f.quantidade * f.valorUnitario).toLocaleString('pt-BR')}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* CARD DE CUSTOS ADM */}
            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-xl border-t-8 border-t-red-500">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <ArrowUpCircle className="text-red-500" size={20}/> Despesas ADM
                  </h2>
                  {isGerente && (
                    <button onClick={() => setShowGastoForm(!showGastoForm)} className="bg-red-500 text-white p-2 rounded-xl hover:bg-red-600 transition-all">
                      <Plus size={18} />
                    </button>
                  )}
                </div>

                {showGastoForm && (
                    <div className="mb-8 p-6 bg-red-50 rounded-[32px] space-y-4 border border-red-100">
                        <input placeholder="Descrição da Despesa" className="w-full p-4 rounded-2xl border-none text-xs font-bold outline-none" value={novoGasto.descricao} onChange={e => setNovoGasto({...novoGasto, descricao: e.target.value})} />
                        <input type="number" placeholder="Valor R$" className="w-full p-4 rounded-2xl border-none text-xs font-bold outline-none" value={novoGasto.valor} onChange={e => setNovoGasto({...novoGasto, valor: e.target.value})} />
                        <button onClick={handleSalvarGasto} className="w-full bg-slate-900 text-red-400 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-black transition-all">Lançar Despesa</button>
                    </div>
                )}

                <div className="space-y-4">
                    {gastosAdm.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-4 italic">Sem despesas administrativas.</p>
                    ) : gastosAdm.map(g => (
                        <div key={g.id} className="p-5 bg-red-50/50 rounded-3xl border border-red-100 flex justify-between items-center">
                          <p className="text-[10px] font-black text-slate-800 uppercase">{g.descricao}</p>
                          <span className="font-black text-red-700 text-xs">R$ {Number(g.valor).toLocaleString('pt-BR')}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}