"use client"
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../lib/firebase";  
import { doc, getDoc, collection, onSnapshot, query, where, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { useLicense } from "../../hooks/useAuthContext"; 
import { 
  BarChart3, 
  Ruler, 
  ArrowLeft, 
  Settings, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  ListChecks,
  TreeDeciduous,
  Axe,
  Wallet,
  TrendingUp,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Receipt,
  Banknote
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
  const [loadingData, setLoadingData] = useState(true);

  const [showGastoForm, setShowGastoForm] = useState(false);
  const [novoGasto, setNovoGasto] = useState({ descricao: "", valor: "" });
  const [fazendasMinimizadas, setFazendasMinimizadas] = useState<string[]>([]);

  useEffect(() => {
    if (!licenseId) return;

    const carregarTudo = async () => {
      try {
        const docRef = doc(db, `clientes/${licenseId}/projetos`, projId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setProjeto(docSnap.data());

        // Listeners em tempo real
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

        // ✅ CORREÇÃO AQUI: Atribuído à variável unsubCub
        const unsubCub = onSnapshot(query(
          collection(db, `clientes/${licenseId}/dados_cubagem`), 
          where("projetoId", "in", [projId, Number(projId)]) 
        ), (snap) => { setCubagens(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });

        const unsubDiarios = onSnapshot(query(collection(db, `clientes/${licenseId}/diarios_de_campo`), where("projetoId", "in", [projId, Number(projId)])), (snap) => {
            setDiarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubGastos = onSnapshot(collection(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`), (snap) => {
            setGastosAdm(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        setLoadingData(false);

        return () => {
          unsubAtiv(); unsubFaz(); unsubTal(); unsubAmo(); unsubCub(); unsubDiarios(); unsubGastos();
        };
      } catch (error) {
        console.error("Erro na hierarquia:", error);
        setLoadingData(false);
      }
    };

    carregarTudo(); 
  }, [projId, licenseId]);

  const indicadores = useMemo(() => {
    const custoCampo = diarios.reduce((acc, d) => acc + (Number(d.abastecimentoValor || d.abastecimento_valor) || 0) + (Number(d.pedagioValor || d.pedagio_valor) || 0) + (Number(d.alimentacaoRefeicaoValor || d.alimentacao_refeicao_valor) || 0) + (Number(d.outrasDespesasValor || d.outras_despesas_valor) || 0), 0);
    const custoAdm = gastosAdm.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const totalAmostras = amostras.length;
    const concluidas = amostras.filter(a => a.status === 'concluida' || a.status === 'exportada').length;
    const progresso = totalAmostras > 0 ? Math.round((concluidas / totalAmostras) * 100) : 0;

    return {
        custoTotal: custoCampo + custoAdm,
        custoPorParcela: concluidas > 0 ? (custoCampo + custoAdm) / concluidas : 0,
        progresso
    };
  }, [diarios, gastosAdm, amostras]);

  const toggleFazenda = (ativId: string, fazendaId: string) => {
    const chave = `${ativId}-${fazendaId}`;
    setFazendasMinimizadas(prev => 
      prev.includes(chave) ? prev.filter(id => id !== chave) : [...prev, chave]
    );
  };

  const handleSalvarGasto = async () => {
    if (!novoGasto.descricao || !novoGasto.valor) return;
    await addDoc(collection(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`), {
        descricao: novoGasto.descricao,
        valor: Number(novoGasto.valor),
        data: serverTimestamp()
    });
    setNovoGasto({ descricao: "", valor: "" });
    setShowGastoForm(false);
  };

  if (authLoading || loadingData) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center px-4">Sincronizando Hierarquia da Empresa...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      <nav className="mb-6">
        <Link href="/projetos" className="text-xs font-bold text-slate-400 uppercase hover:text-emerald-600 flex items-center gap-1 transition-colors">
          <ArrowLeft size={14} /> Voltar para Projetos
        </Link>
      </nav>

      <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 block">Empresa: {projeto?.empresa}</span>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter uppercase">{projeto?.nome}</h1>
          <p className="text-slate-500 font-medium italic">Responsável: {projeto?.responsavel}</p>
        </div>

        <div className="flex gap-3">
          <Link href={`/projetos/${projId}/analise`} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20">
            <BarChart3 size={18} /> Auditoria QA/QC
          </Link>
          <Link href={`/projetos/${projId}/cubagem`} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
            <Ruler size={18} className="text-emerald-400" /> Cubagem Rigorosa
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl flex flex-col justify-between overflow-hidden relative group">
            <Banknote className="absolute -right-6 -bottom-6 text-emerald-500/10 group-hover:scale-110 transition-transform" size={140} />
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Investimento Acumulado</p>
            <h2 className="text-4xl font-black mt-2">R$ {indicadores.custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            <p className="text-slate-500 text-[8px] mt-4 font-bold uppercase tracking-tighter">Campo + Administrativo</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl w-fit"><Wallet size={24}/></div>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Custo Real / Parcela</p>
                <h2 className="text-3xl font-black text-slate-900">R$ {indicadores.custoPorParcela.toFixed(2)}</h2>
            </div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-slate-100 text-slate-600 p-3 rounded-2xl w-fit"><Clock size={24}/></div>
            <div className="space-y-2">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Progresso: {indicadores.progresso}%</p>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${indicadores.progresso}%` }}></div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {atividades.map((ativ) => {
            const isCUB = ativ.tipo.toUpperCase().includes("CUB");
            const fazendasDestaAtividade = fazendas.filter(f => f.activityId === ativ.id || f.atividadeId === ativ.id);

            if (fazendasDestaAtividade.length === 0) return null;

            return (
              <div key={ativ.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-900 p-5 px-8 flex justify-between items-center">
                  <h2 className="text-white font-black uppercase text-sm tracking-widest">
                    Atividade: <span className="text-emerald-400">{ativ.tipo}</span>
                  </h2>
                  <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{ativ.metodoCubagem || "Inventário"}</span>
                </div>

                <div className="p-8 space-y-8">
                  {fazendasDestaAtividade.map(faz => {
                    const chaveFazenda = `${ativ.id}-${faz.id}`;
                    const isMinimizada = fazendasMinimizadas.includes(chaveFazenda);
                    const talhoesDestaFazenda = talhoes.filter(t => t.fazendaId === faz.id);
                    
                    return (
                      <div key={faz.id} className="space-y-4">
                        <div onClick={() => toggleFazenda(ativ.id, faz.id)} className="flex items-center justify-between cursor-pointer group bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-emerald-500/20 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                            <span className="text-sm font-black text-slate-800 uppercase tracking-tight">🏠 Fazenda: {faz.nome}</span>
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><MapPin size={10} /> {faz.municipio || "N/I"}</span>
                          </div>
                          {isMinimizada ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronUp size={20} className="text-slate-400" />}
                        </div>
                        
                        {!isMinimizada && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pl-4">
                            {talhoesDestaFazenda.map(tal => {
                              let total = 0; let concluidas = 0; let label = "Amostras"; let Icon = ListChecks;
                              let urlAjuste = `/projetos/${projId}/talhao/${tal.id}`;

                              if (isCUB) {
                                  urlAjuste = `/projetos/${projId}/talhao/${tal.id}/cubagem`;
                                  label = "Árvores"; Icon = Axe;
                                  const dadosTalhao = cubagens.filter(c => String(c.talhaoId) === String(tal.id));
                                  total = dadosTalhao.length;
                                  concluidas = dadosTalhao.filter(c => Number(c.alturaTotal) > 0).length;
                              } else {
                                  const dadosTalhao = amostras.filter(a => String(a.talhaoId) === String(tal.id));
                                  total = dadosTalhao.length;
                                  concluidas = dadosTalhao.filter(a => a.status === 'concluida' || a.status === 'exportada').length;
                              }
                              const porcentagem = total > 0 ? (concluidas / total) * 100 : 0;

                              return (
                                <div key={tal.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-500 transition-all group relative">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-2">
                                        <TreeDeciduous size={16} className="text-emerald-600" />
                                        <p className="font-black text-slate-800 text-sm uppercase tracking-tighter">{tal.nome}</p>
                                      </div>
                                      <Link href={urlAjuste} className="text-slate-300 hover:text-emerald-600 transition-colors"><Settings size={14} /></Link>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-black">{tal.areaHa || "0"} HA</span>
                                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">{tal.especie || "N/I"}</span>
                                    </div>
                                    <div className="pt-2 border-t border-slate-50">
                                      <div className="flex justify-between items-end mb-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Icon size={12} /> {label}</span>
                                        <span className="text-[10px] font-black text-slate-700">{concluidas}/{total}</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all duration-500 ${porcentagem === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                          style={{ width: `${porcentagem}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
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

        <div className="space-y-8">
            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-xl">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-2">
                        <Receipt className="text-emerald-500" size={20} />
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Custos de Gestão</h2>
                    </div>
                    <button onClick={() => setShowGastoForm(!showGastoForm)} className="bg-slate-900 text-emerald-400 p-3 rounded-full hover:bg-black transition-all shadow-lg"><Plus size={20} /></button>
                </div>

                {showGastoForm && (
                    <div className="mb-8 p-6 bg-slate-50 rounded-[32px] border border-emerald-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <input placeholder="Descrição (Ex: Hotel)" className="w-full p-4 rounded-2xl border-none text-xs font-bold outline-none shadow-inner" value={novoGasto.descricao} onChange={e => setNovoGasto({...novoGasto, descricao: e.target.value})} />
                        <input type="number" placeholder="Valor R$" className="w-full p-4 rounded-2xl border-none text-xs font-bold outline-none shadow-inner" value={novoGasto.valor} onChange={e => setNovoGasto({...novoGasto, valor: e.target.value})} />
                        <button onClick={handleSalvarGasto} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">Lançar Despesa</button>
                    </div>
                )}

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {gastosAdm.map(g => (
                        <div key={g.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-slate-200 transition-all">
                            <div>
                                <p className="text-[11px] font-black text-slate-700 uppercase">{g.descricao}</p>
                                <p className="text-[9px] text-slate-400 font-bold">{new Date(g.data?.seconds * 1000).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-black text-slate-900 text-xs">R$ {Number(g.valor).toFixed(2)}</span>
                                <button onClick={() => deleteDoc(doc(db, `clientes/${licenseId}/projetos/${projId}/gastos_adm`, g.id))} className="text-red-300 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-10 pt-8 border-t border-slate-100">
                    <div className="flex justify-between items-center text-slate-900 font-black text-sm uppercase">
                        <span>Investimento Total:</span>
                        <span className="text-emerald-600 text-xl font-black">R$ {indicadores.custoTotal.toLocaleString('pt-BR')}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}