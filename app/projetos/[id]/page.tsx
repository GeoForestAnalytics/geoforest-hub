"use client"
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../lib/firebase";  
import { doc, getDoc, collection, onSnapshot, query, where, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { useLicense } from "../../hooks/useAuthContext"; 
import { 
  BarChart3, Ruler, ArrowLeft, Settings, ChevronDown, ChevronUp,
  MapPin, ListChecks, TreeDeciduous, Axe, Plus, Trash2,
  DollarSign, ArrowDownCircle, ArrowUpCircle
} from "lucide-react";

export default function DetalhesProjeto() {
  const params = useParams(); 
  const router = useRouter();
  const projId = params.id as string;
  const { licenseId, loading: authLoading } = useLicense();

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
            setDiarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubGastos = onSnapshot(collection(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`), (snap) => {
            setGastosAdm(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubFatur = onSnapshot(collection(db, `clientes/${licenseId}/projetos/${projId}/faturamentos`), (snap) => {
            setFaturamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const financeiro = useMemo(() => {
    // 1. Financeiro
    const custoCampo = diarios.reduce((acc, d) => acc + (Number(d.abastecimentoValor || d.abastecimento_valor || 0) + Number(d.pedagioValor || d.pedagio_valor || 0) + Number(d.alimentacaoRefeicaoValor || d.alimentacao_refeicao_valor || 0) + Number(d.outrasDespesasValor || d.outras_despesas_valor || 0)), 0);
    const custoAdm = gastosAdm.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const totalCustos = custoCampo + custoAdm;
    const totalReceita = faturamentos.reduce((acc, f) => acc + (Number(f.quantidade || 1) * Number(f.valorUnitario || f.valor || 0)), 0);
    const lucroLiquido = totalReceita - totalCustos;
    const margem = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0;
    
    // 2. ✅ LÓGICA DE PRODUÇÃO BLINDADA
    // Amostras vinculadas a este projeto (já filtradas pela query)
    const totalAmo = amostras.length;
    const concluidasAmo = amostras.filter(a => ["concluida", "exportada", "concluido"].includes(String(a.status || "").toLowerCase())).length;

    // Cubagem: Identificamos os talhões que pertencem às atividades de CUB deste projeto
    const idsAtivCub = atividades.filter(a => a.tipo.toUpperCase().includes("CUB")).map(a => String(a.id));
    const talhoesCubProj = talhoes.filter(t => idsAtivCub.includes(String(t.atividadeId)) || idsAtivCub.includes(String(t.fazendaAtividadeId)));
    const idsTalhoesCub = talhoesCubProj.map(t => String(t.id));

    const cubagensDoProjeto = cubagens.filter(c => idsTalhoesCub.includes(String(c.talhaoId)));
    const totalCub = cubagensDoProjeto.length;
    const concluidasCub = cubagensDoProjeto.filter(c => Number(c.alturaTotal) > 0).length;

    const progressoTotal = totalAmo > 0 ? Math.round((concluidasAmo / totalAmo) * 100) : 0;

    return { totalCustos, totalReceita, lucroLiquido, margem: margem.toFixed(1), progressoTotal, concluidasAmo, totalAmo, concluidasCub, totalCub };
  }, [diarios, gastosAdm, faturamentos, amostras, cubagens, talhoes, atividades]);

  const toggleFazenda = (ativId: string, fazendaId: string) => {
    const chave = `${ativId}-${fazendaId}`;
    setFazendasMinimizadas(prev => prev.includes(chave) ? prev.filter(id => id !== chave) : [...prev, chave]);
  };

  const handleSalvarFaturamento = async () => {
    if (!novaFatura.descricao || !novaFatura.quantidade || !novaFatura.data) return;
    await addDoc(collection(db, `clientes/${licenseId}/projetos/${projId}/faturamentos`), {
        descricao: novaFatura.descricao, quantidade: Number(novaFatura.quantidade), valorUnitario: Number(novaFatura.valorUnitario), data: novaFatura.data, createdAt: serverTimestamp()
    });
    setNovaFatura({ descricao: "", quantidade: "", valorUnitario: "", data: new Date().toISOString().split('T')[0] }); 
    setShowFaturaForm(false);
  };

  const handleSalvarGasto = async () => {
    if (!novoGasto.descricao || !novoGasto.valor || !novoGasto.data) return;
    await addDoc(collection(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`), {
        descricao: novoGasto.descricao, valor: Number(novoGasto.valor), data: novoGasto.data, licenseId, createdAt: serverTimestamp()
    });
    setNovoGasto({ descricao: "", valor: "", data: new Date().toISOString().split('T')[0] }); 
    setShowGastoForm(false);
  };

  if (authLoading || (loadingData && !projeto)) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase">Sincronizando Hierarquia...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900">
      <nav className="mb-6">
        <Link href="/projetos" className="text-[10px] font-black uppercase hover:text-emerald-600 flex items-center gap-1 transition-all text-slate-400"><ArrowLeft size={14} /> Painel de Projetos</Link>
      </nav>

      <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-1 tracking-tighter uppercase">{projeto?.nome}</h1>
          <p className="text-slate-400 font-medium italic text-sm">{projeto?.empresa} • Resp: {projeto?.responsavel}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/projetos/${projId}/analise`} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase hover:bg-emerald-700 transition-all shadow-xl">Auditoria QA/QC</Link>
          <Link href={`/projetos/${projId}/cubagem`} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase hover:bg-black transition-all shadow-xl">Cubagem Rigorosa</Link>
        </div>
      </div>

      {/* ✅ GRID DE 5 CARDS: TUDO INTEGRADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <DollarSign className="absolute -right-4 -bottom-4 text-emerald-500/10" size={100} />
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Faturamento</p>
            <h2 className="text-2xl font-black mt-2">R$ {financeiro.totalReceita.toLocaleString('pt-BR')}</h2>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Custo Acumulado</p>
            <h2 className="text-2xl font-black text-red-500 mt-2">R$ {financeiro.totalCustos.toLocaleString('pt-BR')}</h2>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Lucro Líquido</p>
            <h2 className={`text-2xl font-black mt-2 ${financeiro.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {financeiro.lucroLiquido.toLocaleString('pt-BR')}</h2>
        </div>
        
        {/* ✅ KPI DE PRODUÇÃO CORRIGIDO: MOSTRA VALORES DA CUBAGEM */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Produção Atual</p>
            <div className="mt-2">
                <p className="text-sm font-black text-slate-800">{financeiro.concluidasAmo}/{financeiro.totalAmo} <span className="text-[9px] text-slate-400">AMO</span></p>
                <p className="text-sm font-black text-emerald-600">{financeiro.concluidasCub}/{financeiro.totalCub} <span className="text-[9px] text-emerald-400">CUB</span></p>
            </div>
        </div>
        
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Execução</p>
            <h2 className="text-2xl font-black text-slate-900 mt-2">{financeiro.progressoTotal}%</h2>
            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1"><div className="bg-emerald-500 h-full" style={{ width: `${financeiro.progressoTotal}%` }}></div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><TreeDeciduous size={16}/> Estrutura de Campo</h2>
                {atividades.map((ativ) => {
                    const isCUB = ativ.tipo.toUpperCase().includes("CUB");
                    const fazendasDestaAtiv = fazendas.filter(f => f.activityId === ativ.id || f.atividadeId === ativ.id);
                    return (
                        <div key={ativ.id} className="mb-8 border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                            <div className="bg-slate-900 p-4 px-8 flex justify-between items-center text-white">
                                <span className="font-black text-[10px] uppercase tracking-widest">{ativ.tipo}</span>
                                <span className="text-emerald-400 text-[9px] font-bold uppercase">{ativ.metodoCubagem || "Padrão"}</span>
                            </div>
                            <div className="p-6 space-y-4">
                                {fazendasDestaAtiv.map(faz => {
                                    const chave = `${ativ.id}-${faz.id}`;
                                    const isMin = fazendasMinimizadas.includes(chave);
                                    const talhoesFiltrados = talhoes.filter(t => t.fazendaId === faz.id && (t.atividadeId === ativ.id || t.fazendaAtividadeId === ativ.id));
                                    const totalT = talhoesFiltrados.length;
                                    const concluidosT = talhoesFiltrados.filter(tal => {
                                        if (isCUB) {
                                            const d = cubagens.filter(c => String(c.talhaoId) === String(tal.id));
                                            return d.length > 0 && d.every(c => Number(c.alturaTotal) > 0);
                                        } else {
                                            const d = amostras.filter(a => String(a.talhaoId) === String(tal.id));
                                            return d.length > 0 && d.every(a => a.status === 'concluida' || a.status === 'exportada');
                                        }
                                    }).length;
                                    const porcFazenda = totalT > 0 ? Math.round((concluidosT / totalT) * 100) : 0;

                                    return (
                                        <div key={faz.id} className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                                            <div onClick={() => toggleFazenda(ativ.id, faz.id)} className="p-4 flex flex-col md:flex-row justify-between items-center cursor-pointer group hover:bg-white transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1.5 h-6 rounded-full ${porcFazenda === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                                    <span className="text-xs font-black text-slate-700 uppercase group-hover:text-emerald-600 transition-colors">{faz.nome}</span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-2 md:mt-0">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase">{concluidosT}/{totalT} Talhões</span>
                                                        <div className="w-24 bg-slate-200 h-1 rounded-full overflow-hidden mt-0.5">
                                                            <div className={`h-full transition-all duration-700 ${porcFazenda === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${porcFazenda}%` }}></div>
                                                        </div>
                                                    </div>
                                                    {isMin ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                                                </div>
                                            </div>
                                            {!isMin && (
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-200 bg-white">
                                                    {talhoesFiltrados.map(tal => {
                                                        let total = 0; let concluidas = 0; let label = isCUB ? "Árvores" : "Amostras"; 
                                                        let urlDetalhe = `/projetos/${projId}/talhao/${tal.id}${isCUB ? '/cubagem' : ''}`;
                                                        if (isCUB) {
                                                            const d = cubagens.filter(c => String(c.talhaoId) === String(tal.id));
                                                            total = d.length; concluidas = d.filter(c => Number(c.alturaTotal) > 0).length;
                                                        } else {
                                                            const d = amostras.filter(a => String(a.talhaoId) === String(tal.id));
                                                            total = d.length; concluidas = d.filter(a => a.status === 'concluida' || a.status === 'exportada').length;
                                                        }
                                                        const porcentagem = total > 0 ? Math.round((concluidas / total) * 100) : 0;
                                                        return (
                                                            <div key={tal.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative group">
                                                                <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-slate-800 uppercase">{tal.nome}</p><Link href={urlDetalhe} className="text-slate-300 hover:text-emerald-600 transition-colors"><Settings size={14} /></Link></div>
                                                                <div className="space-y-1"><div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase"><span>{concluidas}/{total} {label}</span><span>{porcentagem}%</span></div><div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${porcentagem === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${porcentagem}%` }}></div></div></div>
                                                            </div>
                                                        );
                                                    })}
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

        <div className="space-y-6">
            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-xl border-t-4 border-t-emerald-500">
                <div className="flex justify-between items-center mb-6"><h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><ArrowDownCircle className="text-emerald-500" size={18}/> Receitas</h2><button onClick={() => setShowFaturaForm(!showFaturaForm)} className="bg-emerald-500 text-white p-2 rounded-full hover:bg-emerald-600 transition-all"><Plus size={16} /></button></div>
                {showFaturaForm && (
                    <div className="mb-6 p-4 bg-emerald-50 rounded-2xl space-y-3">
                        <input placeholder="Descrição" className="w-full p-3 rounded-xl border-none text-xs font-bold outline-none" value={novaFatura.descricao} onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} />
                        <div className="flex gap-2"><input type="number" placeholder="Qtd" className="w-1/3 p-3 rounded-xl border-none text-xs font-bold outline-none" value={novaFatura.quantidade} onChange={e => setNovaFatura({...novaFatura, quantidade: e.target.value})} /><input type="number" placeholder="R$ Unid" className="w-2/3 p-3 rounded-xl border-none text-xs font-bold outline-none" value={novaFatura.valorUnitario} onChange={e => setNovaFatura({...novaFatura, valorUnitario: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-2">Data Competência</label><input type="date" className="w-full p-3 rounded-xl border-none text-xs font-bold outline-none bg-white" value={novaFatura.data} onChange={e => setNovaFatura({...novaFatura, data: e.target.value})} /></div>
                        <button onClick={handleSalvarFaturamento} className="w-full bg-slate-900 text-emerald-400 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-black">Lançar Receita</button>
                    </div>
                )}
                <div className="space-y-3">
                    {faturamentos.map(f => (
                        <div key={f.id} className="p-4 bg-emerald-50/50 rounded-2xl group border border-emerald-100 flex justify-between items-center text-slate-900"><div><p className="text-[10px] font-black uppercase mb-1">{f.descricao}</p><p className="text-[8px] text-emerald-600 font-bold">{new Date(f.data).toLocaleDateString()} • {f.quantidade} x R$ {Number(f.valorUnitario).toFixed(2)}</p></div><div className="flex items-center gap-2"><span className="font-black text-emerald-700 text-xs">R$ {(f.quantidade * f.valorUnitario).toFixed(2)}</span><button onClick={() => deleteDoc(doc(db, `clientes/${licenseId}/projetos/${projId}/faturamentos`, f.id))} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button></div></div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-xl border-t-4 border-t-red-500">
                <div className="flex justify-between items-center mb-6"><h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><ArrowUpCircle className="text-red-500" size={18}/> Saídas ADM</h2><button onClick={() => setShowGastoForm(!showGastoForm)} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-all"><Plus size={16} /></button></div>
                {showGastoForm && (
                    <div className="mb-6 p-4 bg-red-50 rounded-2xl space-y-3"><input placeholder="Descrição" className="w-full p-3 rounded-xl border-none text-xs font-bold outline-none" value={novoGasto.descricao} onChange={e => setNovoGasto({...novoGasto, descricao: e.target.value})} /><div className="flex gap-2"><input type="number" placeholder="Valor R$" className="w-2/3 p-3 rounded-xl border-none text-xs font-bold outline-none" value={novoGasto.valor} onChange={e => setNovoGasto({...novoGasto, valor: e.target.value})} /><input type="date" className="w-full p-3 rounded-xl border-none text-xs font-bold outline-none bg-white" value={novoGasto.data} onChange={e => setNovoGasto({...novoGasto, data: e.target.value})} /></div><button onClick={handleSalvarGasto} className="w-full bg-slate-900 text-red-400 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-black">Lançar Saída</button></div>
                )}
                <div className="space-y-2">
                    {gastosAdm.map(g => (
                        <div key={g.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-2xl group text-slate-900"><div><p className="text-[10px] font-black uppercase">{g.descricao}</p><p className="text-[8px] text-red-400 font-bold">{new Date(g.data).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><span className="font-black text-red-700 text-xs">R$ {Number(g.valor).toFixed(2)}</span><button onClick={() => deleteDoc(doc(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`, g.id))} className="text-red-300 hover:text-red-500"><Trash2 size={14}/></button></div></div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}