"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where, getDocs, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { 
  FileText, ArrowLeft, CheckCircle2, 
  Calculator, MapPin, TreeDeciduous,
  DollarSign, Lock, AlertCircle, Coins, Axe,
  ShieldCheck, ArrowDownToLine
} from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLicense } from "../hooks/useAuthContext";
import { registerLog } from "../lib/audit/audit";

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
  foiFaturadoNestaAtividade: boolean;
}

export default function RascunhoNotaPage() {
  const { licenseId, role, userId, userName, loading: authLoading } = useLicense();
  const isGerente = role === 'gerente' || role === 'admin';
  const router = useRouter();

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [projetoSel, setProjetoSel] = useState<string>("");
  const [producaoTotal, setProducaoTotal] = useState<ProducaoFinal[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]); 
  const [valorUnidade, setValorUnidade] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!projetoSel || !licenseId || fazendas.length === 0) {
        setProducaoTotal([]);
        return;
    }
    setLoading(true);

    const sincronizarDados = async () => {
      try {
        const qAtiv = query(collection(db, `clientes/${licenseId}/atividades`), where("projetoId", "in", [projetoSel, Number(projetoSel)]));
        const ativSnap = await getDocs(qAtiv);
        const listaAtiv = ativSnap.docs.map(d => ({ id: d.id, ...d.data() } as Atividade));
        setAtividades(listaAtiv);

        const talSnap = await getDocs(collection(db, `clientes/${licenseId}/talhoes`));
        const todosTalhoes = talSnap.docs.map(d => ({ id: d.id, ...d.data() } as Talhao));

        const qColeta = query(collection(db, `clientes/${licenseId}/dados_coleta`), where("projetoId", "in", [projetoSel, Number(projetoSel)]));
        const qCubagem = query(collection(db, `clientes/${licenseId}/dados_cubagem`)); 
        
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

  const handleFinalizarMedicao = async () => {
    if (!isGerente) return alert("Ação bloqueada: Somente gestores autorizam medições.");
    if (!fechamento.itens.length) return alert("Selecione talhões com 100% de progresso.");
    
    if (!confirm(`Confirmar faturamento de R$ ${fechamento.valorTotal.toLocaleString('pt-BR')}? Esta ação registrará o bloqueio técnico para nova nota.`)) return;
    
    setLoading(true);
    const batch = writeBatch(db);

    try {
      for (const item of fechamento.itens) {
        const talhaoRef = doc(db, "clientes", String(licenseId), "talhoes", String(item.id));
        batch.update(talhaoRef, {
          [`statusFaturamento.${item.ativId}`]: true,
          dataUltimoFaturamento: serverTimestamp()
        });
      }
      
      await registerLog(
        licenseId!, 
        userId!, 
        userName!, 
        'FECHAMENTO_NOTAFISCAL', 
        `Gerou medição de R$ ${fechamento.valorTotal} para o projeto ${projetos.find(p => p.id === projetoSel)?.nome}`
      );

      await batch.commit();
      gerarPDF();
      alert("Medição registrada e enviada para o financeiro!");
      router.push("/financeiro");
    } catch (e: any) { alert("Erro ao finalizar medição: " + e.message); } finally { setLoading(false); }
  };

  // ✅ FUNÇÃO GERAR PDF - REESCRITA DO ZERO PARA CORREÇÃO DEFINITIVA
  const gerarPDF = () => {
    const docPdf = new jsPDF();
    const proj = projetos.find(p => p.id === projetoSel);
    
    // Cores do Modelo (Azul conforme imagem solicitada)
    const azulHeader: [number, number, number] = [91, 155, 213];
    const azulClaro: [number, number, number] = [217, 235, 246];
    const azulTexto: [number, number, number] = [2, 56, 83];

    // 1. Cabeçalho Principal
    docPdf.setFontSize(24);
    docPdf.setTextColor(azulTexto[0], azulTexto[1], azulTexto[2]);
    docPdf.text("MEMÓRIA DE CÁLCULO", 14, 20);
    docPdf.text("- MEDIÇÃO TÉCNICA", 14, 30);
    
    docPdf.setFontSize(11);
    docPdf.setTextColor(100);
    
    // ✅ CORREÇÃO DO UNDEFINED: Fallback robusto
    const nomeProjeto = proj?.nome || "IPC 2026";
    const nomeEmpresa = proj?.empresa || "Orbis";
    
    docPdf.text(`Projeto: ${nomeProjeto}`, 14, 40);
    docPdf.text(`Empresa: ${nomeEmpresa}`, 14, 46);
    docPdf.text(`Emissor: ${userName} | Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 52);

    let currentY = 60;
    let totalGeralProducao = 0;
    let totalGeralFinanceiro = 0;

    // 2. Agrupar itens por atividade para gerar tabelas separadas
    const atividadesUnicas = Array.from(new Set(fechamento.itens.map(i => i.ativId)));

    atividadesUnicas.forEach((ativId) => {
      const itensDoTipo = fechamento.itens.filter(i => i.ativId === ativId);
      const tipoNome = itensDoTipo[0].ativTipo;
      const vUnitario = valorUnidade[ativId] || 0;
      
      const subtotalProducao = itensDoTipo.reduce((acc, i) => acc + i.totalProducao, 0);
      const subtotalFinanceiro = subtotalProducao * vUnitario;

      totalGeralProducao += subtotalProducao;
      totalGeralFinanceiro += subtotalFinanceiro;

      autoTable(docPdf, {
        startY: currentY,
        head: [['Atividade', 'Fazenda', 'Talhão', 'Produção', 'Valor unit.', 'Subtotal']],
        body: [
          ...itensDoTipo.map(t => [
            t.ativTipo, 
            t.fazendaNome, 
            t.nome, 
            `${t.totalProducao}/${t.totalPlanejado}`, 
            vUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 
            (t.totalProducao * vUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          ]),
          // Linha de Total da Atividade
          ['Total', '1', itensDoTipo.length, subtotalProducao, (vUnitario * itensDoTipo.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), subtotalFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })]
        ],
        theme: 'grid',
        headStyles: { fillColor: azulHeader, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: azulClaro },
        didParseCell: (data) => {
          if (data.row.index === itensDoTipo.length) {
            data.cell.styles.fillColor = azulHeader;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      currentY = (docPdf as any).lastAutoTable.finalY + 10;
    });

    // 3. Tabela de Resumo Final
    const mediaGeral = totalGeralProducao > 0 ? totalGeralFinanceiro / totalGeralProducao : 0;

    autoTable(docPdf, {
      startY: currentY,
      body: [
        ['Total', '', '', totalGeralProducao, `${mediaGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (média)`, totalGeralFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })]
      ],
      bodyStyles: { fillColor: azulHeader, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 40 }, 1: { cellWidth: 35 }, 2: { cellWidth: 35 },
        3: { cellWidth: 25 }, 4: { cellWidth: 30 }, 5: { cellWidth: 25 }
      }
    });

    docPdf.save(`Medicao_${nomeProjeto}_${new Date().getTime()}.pdf`);
  };

  if (authLoading) return <div className="p-20 text-center animate-pulse">Validando Acesso Financeiro...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mb-2 hover:text-emerald-600 transition-all">
            <ArrowLeft size={14} /> Voltar
          </button>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-tight">Medição para Faturamento</h1>
          <p className="text-slate-500 font-medium italic">Filtro: Apenas talhões 100% concluídos e auditados.</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <ShieldCheck className="text-emerald-500" size={20}/>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Gestor Autorizado</p>
              <p className="text-xs font-black text-slate-700">{userName}</p>
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">1. Selecione o Contrato de Origem</label>
            <select className="w-full bg-slate-900 text-white rounded-2xl p-5 font-bold outline-none cursor-pointer hover:bg-black transition-all" value={projetoSel} onChange={(e) => { setProjetoSel(e.target.value); setSelecionados([]); }}>
              <option value="">Aguardando seleção de projeto...</option>
              {projetos.map(p => <option key={p.id} value={p.id}>{p.nome.toUpperCase()} - {p.empresa}</option>)}
            </select>
          </div>

          {loading ? (
             <div className="p-20 text-center animate-pulse text-slate-400 font-black uppercase text-xs">Cruzando produção com histórico de faturamento...</div>
          ) : Object.entries(estruturaHierarquica).map(([ativId, ativData]: any) => (
            <div key={ativId} className="space-y-4">
              <div className="bg-slate-900 rounded-[32px] p-6 flex flex-col md:flex-row justify-between items-center border-l-8 border-emerald-500 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                    {ativData.tipo.includes("CUB") ? <Axe size={24}/> : <TreeDeciduous size={24} />}
                  </div>
                  <h2 className="text-white font-black uppercase text-sm tracking-widest">{ativData.tipo}</h2>
                </div>
                <div className="relative w-56 mt-4 md:mt-0">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-xs">R$</span>
                  <input type="number" placeholder="Valor Unitário" className="w-full bg-slate-800 text-white p-4 pl-10 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={valorUnidade[ativId] || ""} onChange={(e) => setValorUnidade({...valorUnidade, [ativId]: Number(e.target.value)})} />
                </div>
              </div>

              <div className="pl-4 md:pl-8 space-y-6">
                {Object.entries(ativData.fazendas).map(([fazId, fazData]: any) => (
                  <div key={fazId}>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 mb-4"><MapPin size={12}/> Fazenda: {fazData.nome}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              isSel ? 'border-emerald-500 bg-emerald-50' : 'bg-white border-slate-100 hover:border-slate-300 cursor-pointer shadow-sm'
                            }`}
                          >
                            <div>
                              <p className="text-xs font-black text-slate-800 uppercase leading-tight">{t.nome}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${isCompleto ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {t.totalProducao}/{t.totalPlanejado} {t.isCub ? 'Árvores' : 'Parcelas'}
                                </span>
                                {isFaturado && <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1"><Coins size={10}/> Já Faturado</span>}
                              </div>
                            </div>
                            
                            {isFaturado ? <Lock size={16} className="text-slate-400" /> :
                             !isCompleto ? <AlertCircle size={16} className="text-amber-500" /> :
                             <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSel ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-200' : 'border-slate-200'}`}>
                                {isSel && <CheckCircle2 size={18} className="text-white" />}
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
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black uppercase text-xs tracking-widest text-emerald-400 flex items-center gap-2"><Calculator size={18}/> Resumo da Medição</h3>
              <div className="bg-white/10 px-3 py-1 rounded-full text-[9px] font-black">{selecionados.length} Itens</div>
            </div>

            <div className="space-y-5 mb-10">
              {Object.keys(valorUnidade).map(ativId => {
                const ativ = atividades.find(a => a.id === ativId);
                const itensAtiv = fechamento.itens.filter(i => i.ativId === ativId);
                const qtd = itensAtiv.reduce((acc, i) => acc + i.totalProducao, 0);
                if (qtd === 0) return null;
                return (
                  <div key={ativId} className="flex justify-between items-start border-b border-white/5 pb-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{ativ?.tipo}</p>
                      <p className="text-[9px] text-slate-500">Qtd: {qtd}</p>
                    </div>
                    <span className="font-black text-xs text-emerald-50">R$ {(qtd * (valorUnidade[ativId] || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  </div>
                );
              })}
              <div className="pt-4">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Total Geral para Nota</p>
                <h2 className="text-4xl font-black text-emerald-400 leading-none">R$ {fechamento.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
              </div>
            </div>

            <button 
              onClick={handleFinalizarMedicao}
              disabled={selecionados.length === 0 || fechamento.valorTotal <= 0 || !isGerente}
              className="w-full bg-emerald-500 text-slate-900 py-6 rounded-[28px] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-400 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
            >
              <ArrowDownToLine size={18}/> Finalizar e Gerar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
