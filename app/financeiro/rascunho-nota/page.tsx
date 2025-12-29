"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/firebase";
import { 
  collection, onSnapshot, query, where, getDocs, 
  doc, updateDoc, serverTimestamp, writeBatch 
} from "firebase/firestore";
import { useLicense } from "../../hooks/useAuthContext";
import { 
  FileText, ArrowLeft, CheckCircle2, 
  Calculator, MapPin, TreeDeciduous,
  DollarSign, Lock, AlertCircle, Coins, Axe
} from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- INTERFACES ---
interface Projeto { id: string; nome: string; empresa: string; }
interface Atividade { id: string; tipo: string; projetoId: string | number; }
interface Fazenda { id: string; nome: string; activityId?: string; atividadeId?: string; }
interface Talhao { id: string; nome: string; fazendaId: string; statusFaturamento?: any; }

interface ProducaoFinal {
  id: string;
  nome: string;
  fazendaId: string;
  fazendaNome: string;
  ativId: string;
  ativTipo: string;
  totalProducao: number;
  totalPlanejado: number;
  isCub: boolean;
  foiFaturadoNestaAtividade: boolean; // Trava inteligente
}

export default function RascunhoNotaPage() {
  const { licenseId, loading: authLoading } = useLicense();
  const router = useRouter();

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [projetoSel, setProjetoSel] = useState<string>("");
  const [producaoTotal, setProducaoTotal] = useState<ProducaoFinal[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]); 
  const [valorUnidade, setValorUnidade] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);

  // 1. Carregamento de Estrutura (Idêntico ao Detail Page)
  useEffect(() => {
    if (!licenseId) return;
    const unsubProj = onSnapshot(collection(db, `clientes/${licenseId}/projetos`), (snap) => {
      setProjetos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Projeto)));
    });
    const unsubFaz = onSnapshot(collection(db, `clientes/${licenseId}/fazendas`), (snap) => {
        setFazendas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Fazenda)));
    });
    return () => { unsubProj(); unsubFaz(); };
  }, [licenseId]);

  // 2. Motor de Busca com as Regras de 100% e Cubagem sem projetoId
  useEffect(() => {
    if (!projetoSel || !licenseId || fazendas.length === 0) {
        setProducaoTotal([]);
        return;
    }
    setLoading(true);

    const sincronizarDados = async () => {
      try {
        // A. Pega Atividades do Projeto
        const qAtiv = query(collection(db, `clientes/${licenseId}/atividades`), where("projetoId", "in", [projetoSel, Number(projetoSel)]));
        const ativSnap = await getDocs(qAtiv);
        const listaAtiv = ativSnap.docs.map(d => ({ id: d.id, ...d.data() } as Atividade));
        setAtividades(listaAtiv);

        // B. Pega Talhões Globais
        const talSnap = await getDocs(collection(db, `clientes/${licenseId}/talhoes`));
        const todosTalhoes = talSnap.docs.map(d => ({ id: d.id, ...d.data() } as Talhao));

        // C. Pega Produção Bruta (Coleta e Cubagem)
        const qColeta = query(collection(db, `clientes/${licenseId}/dados_coleta`), where("projetoId", "in", [projetoSel, Number(projetoSel)]));
        const qCubagem = query(collection(db, `clientes/${licenseId}/dados_cubagem`)); // Sem projetoId no banco
        
        const [snapA, snapC] = await Promise.all([getDocs(qColeta), getDocs(qCubagem)]);
        const amostras = snapA.docs.map(d => d.data());
        const cubagens = snapC.docs.map(d => d.data());

        const listaFinal: ProducaoFinal[] = [];

        listaAtiv.forEach(ativ => {
            const isCub = ativ.tipo.toUpperCase().includes("CUB");
            const fazendasDestaAtiv = fazendas.filter(f => f.activityId === ativ.id || f.atividadeId === ativ.id);

            fazendasDestaAtiv.forEach(faz => {
                const talhoesDestaFaz = todosTalhoes.filter(t => t.fazendaId === faz.id);

                talhoesDestaFaz.forEach(tal => {
                    let concluidas = 0; let planejadas = 0;

                    if (isCub) {
                        const dadosTalhao = cubagens.filter(c => String(c.talhaoId) === String(tal.id));
                        planejadas = dadosTalhao.length;
                        concluidas = dadosTalhao.filter(c => Number(c.alturaTotal || 0) > 0).length;
                    } else {
                        const dadosTalhao = amostras.filter(a => String(a.talhaoId) === String(tal.id));
                        planejadas = dadosTalhao.length;
                        concluidas = dadosTalhao.filter(a => {
                            const s = String(a.status || "").toLowerCase();
                            return s.includes("concluid") || s.includes("exportad");
                        }).length;
                    }

                    // ✅ NOVA TRAVA: Verifica se já foi faturado ESTA ATIVIDADE NESTE TALHÃO
                    // O campo no banco será um Objeto: { "ativ_id_1": true, "ativ_id_2": true }
                    const faturados = tal.statusFaturamento || {};
                    const jaFaturadoNestaAtividade = faturados[ativ.id] === true;

                    if (planejadas > 0) {
                        listaFinal.push({
                            id: tal.id,
                            nome: tal.nome,
                            fazendaId: faz.id,
                            fazendaNome: faz.nome,
                            ativId: ativ.id,
                            ativTipo: ativ.tipo,
                            totalProducao: concluidas,
                            totalPlanejado: planejadas,
                            isCub,
                            foiFaturadoNestaAtividade: jaFaturadoNestaAtividade
                        });
                    }
                });
            });
        });
        setProducaoTotal(listaFinal);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    sincronizarDados();
  }, [projetoSel, licenseId, fazendas]);

  // Agrupamento para UI
  const estruturaHierarquica = useMemo(() => {
    const tree: any = {};
    producaoTotal.forEach(p => {
      if (!tree[p.ativId]) tree[p.ativId] = { tipo: p.ativTipo, fazendas: {} };
      if (!tree[p.ativId].fazendas[p.fazendaId]) tree[p.ativId].fazendas[p.fazendaId] = { nome: p.fazendaNome, talhoes: [] };
      tree[p.ativId].fazendas[p.fazendaId].talhoes.push(p);
    });
    return tree;
  }, [producaoTotal]);

  const fechamento = useMemo(() => {
    const itens = producaoTotal.filter(t => selecionados.includes(`${t.ativId}-${t.id}`));
    const valorTotal = itens.reduce((acc, t) => acc + (t.totalProducao * (valorUnidade[t.ativId] || 0)), 0);
    return { itens, valorTotal };
  }, [producaoTotal, selecionados, valorUnidade]);

  // ✅ SALVAMENTO BLINDADO: Carimba a Atividade dentro do Talhão
  const handleFinalizarMedicao = async () => {
    if (!fechamento.itens.length) return alert("Selecione talhões 100%.");
    if (!confirm(`Finalizar faturamento de ${fechamento.itens.length} itens?`)) return;
    
    setLoading(true);
    const batch = writeBatch(db);

    try {
      for (const item of fechamento.itens) {
        const talhaoRef = doc(db, "clientes", String(licenseId), "talhoes", String(item.id));
        
        // Usamos o ID da Atividade como chave para permitir faturar IPC e CUB separadamente
        batch.update(talhaoRef, {
          [`statusFaturamento.${item.ativId}`]: true,
          dataUltimoFaturamento: serverTimestamp()
        });
      }
      await batch.commit();
      gerarPDF();
      alert("Medição concluída com sucesso!");
      router.push("/financeiro");
    } catch (e: any) { alert("Erro técnico: " + e.message); } finally { setLoading(false); }
  };

  const gerarPDF = () => {
    const docPdf = new jsPDF();
    const proj = projetos.find(p => p.id === projetoSel);
    docPdf.setFontSize(16);
    docPdf.text("EXTRATO DE MEDIÇÃO PARA NOTA FISCAL", 14, 20);
    const body = fechamento.itens.map(t => [
        t.ativTipo, t.fazendaNome, t.nome, 
        `${t.totalProducao}/${t.totalPlanejado}`, 
        `R$ ${(valorUnidade[t.ativId] || 0).toFixed(2)}`, 
        `R$ ${(t.totalProducao * (valorUnidade[t.ativId] || 0)).toFixed(2)}`
    ]);
    autoTable(docPdf, {
      startY: 35,
      head: [['Atividade', 'Fazenda', 'Talhão', 'Produção', 'Unit.', 'Subtotal']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      foot: [['', '', '', '', 'TOTAL GERAL', `R$ ${fechamento.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`]],
      footStyles: { fillColor: [16, 185, 129] }
    });
    docPdf.save(`Rascunho_NF_${proj?.nome}.pdf`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900">
      <header className="mb-10">
        <button onClick={() => router.back()} className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-2 hover:text-emerald-600 transition-all">
          <ArrowLeft size={14} /> Voltar
        </button>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-tight">Espelho de Nota Fiscal</h1>
        <p className="text-slate-500 font-medium italic">Regra: Apenas 100% finalizados e não faturados.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">1. Contrato de Origem</label>
            <select className="w-full bg-slate-900 text-white rounded-2xl p-4 font-bold outline-none cursor-pointer" value={projetoSel} onChange={(e) => { setProjetoSel(e.target.value); setSelecionados([]); }}>
              <option value="">Selecione o Projeto...</option>
              {projetos.map(p => <option key={p.id} value={p.id}>{p.nome.toUpperCase()}</option>)}
            </select>
          </div>

          {loading ? (
             <div className="p-20 text-center animate-pulse text-slate-400 font-black uppercase text-xs">Validando produção técnica...</div>
          ) : Object.entries(estruturaHierarquica).map(([ativId, ativData]: any) => (
            <div key={ativId} className="space-y-4">
              <div className="bg-slate-900 rounded-[32px] p-6 flex flex-col md:flex-row justify-between items-center border-l-8 border-emerald-500 shadow-xl">
                <div className="flex items-center gap-3">
                  {ativData.tipo.includes("CUB") ? <Axe className="text-emerald-400" size={24}/> : <TreeDeciduous className="text-emerald-400" size={24} />}
                  <h2 className="text-white font-black uppercase text-sm">{ativData.tipo}</h2>
                </div>
                <div className="relative w-48">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                  <input type="number" placeholder="Vlr Unit." className="w-full bg-slate-800 text-white p-3 pl-8 rounded-xl font-black text-xs outline-none focus:ring-1 focus:ring-emerald-500" value={valorUnidade[ativId] || ""} onChange={(e) => setValorUnidade({...valorUnidade, [ativId]: Number(e.target.value)})} />
                </div>
              </div>

              <div className="pl-4 md:pl-8 space-y-6">
                {Object.entries(ativData.fazendas).map(([fazId, fazData]: any) => (
                  <div key={fazId}>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 mb-4"><MapPin size={12}/> Fazenda: {fazData.nome}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fazData.talhoes.map((t: ProducaoFinal) => {
                        const isCompleto = (t.totalProducao === t.totalPlanejado) && t.totalPlanejado > 0;
                        const isFaturado = t.foiFaturadoNestaAtividade;
                        const key = `${ativId}-${t.id}`;
                        const isSel = selecionados.includes(key);

                        return (
                          <div 
                            key={t.id}
                            onClick={() => (isCompleto && !isFaturado) && setSelecionados(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                            className={`p-6 rounded-[32px] border-2 transition-all flex justify-between items-center ${
                              isFaturado ? 'bg-slate-100 border-slate-200 opacity-60' :
                              !isCompleto ? 'bg-amber-50 border-amber-100' :
                              isSel ? 'border-emerald-500 bg-emerald-50' : 'bg-white border-slate-100 hover:border-slate-300 cursor-pointer'
                            }`}
                          >
                            <div>
                              <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{t.nome}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${isCompleto ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {t.totalProducao}/{t.totalPlanejado} {t.isCub ? 'Árvores' : 'Parcelas'}
                                </span>
                                {isFaturado && <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1"><Coins size={10}/> Pago</span>}
                              </div>
                            </div>
                            
                            {isFaturado ? <Lock size={16} className="text-slate-400" /> :
                             !isCompleto ? <AlertCircle size={16} className="text-amber-500" /> :
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}>
                                {isSel && <CheckCircle2 size={14} className="text-white" />}
                             </div>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl sticky top-8 border-t-8 border-emerald-500">
            <h3 className="font-black uppercase text-xs mb-8 tracking-widest text-emerald-400 flex items-center gap-2"><Calculator size={18}/> Fechamento</h3>
            <div className="space-y-5 mb-10">
              {Object.keys(valorUnidade).map(ativId => {
                const ativ = atividades.find(a => a.id === ativId);
                const itensAtiv = fechamento.itens.filter(i => i.ativId === ativId);
                const qtd = itensAtiv.reduce((acc, i) => acc + i.totalProducao, 0);
                if (qtd === 0) return null;
                return (
                  <div key={ativId} className="flex justify-between items-start border-b border-white/5 pb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase">{ativ?.tipo} ({qtd})</span>
                    <span className="font-black text-xs">R$ {(qtd * (valorUnidade[ativId] || 0)).toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="pt-4">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Total Geral</p>
                <h2 className="text-4xl font-black text-emerald-50 leading-none">R$ {fechamento.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
              </div>
            </div>
            <button 
              onClick={handleFinalizarMedicao}
              disabled={selecionados.length === 0 || fechamento.valorTotal <= 0}
              className="w-full bg-emerald-500 text-slate-900 py-6 rounded-[28px] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-400 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
            >
              <FileText size={18} /> Confirmar Medição e PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}