"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, Save, Table as TableIcon, BarChart2, Filter, CheckCircle, AlertCircle } from "lucide-react";

interface ArvoreAuditada {
  id: string;
  parcelaDocId: string; // ID do documento da parcela para edição
  fazenda: string;
  talhao: string;
  parcela: string;
  linha: number;
  posicao: number;
  cap: number;
  dap: number;
  altura: number;
  relacaoHD: number;
  codigo: string;
  statusQA: "OK" | "ERRO" | "ALERTA";
  mensagens: string[];
}

export default function CentralProcessamento() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;

  // Listas de Estrutura
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  
  // Filtros Selecionados
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);
  
  // Dados e UI
  const [planilha, setPlanilha] = useState<ArvoreAuditada[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<{idx: number, campo: string, valor: any} | null>(null);

  useEffect(() => {
    const carregarEstrutura = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const fSnap = await getDocs(collection(db, `clientes/${uid}/fazendas`));
      const tSnap = await getDocs(collection(db, `clientes/${uid}/talhoes`));
      setFazendas(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTalhoes(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    auth.onAuthStateChanged(user => { if(user) carregarEstrutura(); });
  }, []);

  const rodarProcessamento = async () => {
    if (fazendasSel.length === 0) return alert("Selecione ao menos uma fazenda.");
    setLoading(true);
    const uid = auth.currentUser?.uid;
    const listaFinal: ArvoreAuditada[] = [];

    try {
      const qPar = query(collection(db, `clientes/${uid}/dados_coleta`), where("projetoId", "in", [projId, Number(projId)]));
      const pSnap = await getDocs(qPar);

      const parcelasFiltradas = pSnap.docs.filter(d => {
        const data = d.data();
        const fId = data.idFazenda || data.fazendaId;
        const tId = data.talhaoId;
        return fazendasSel.includes(String(fId)) && (talhoesSel.length === 0 || talhoesSel.includes(String(tId)));
      });

      const promessas = parcelasFiltradas.map(async (pDoc) => {
        const p = pDoc.data();
        const aSnap = await getDocs(collection(pDoc.ref, "arvores"));
        return aSnap.docs.map(aDoc => {
          const a = aDoc.data() as any; // 'as any' silencia erros de tipagem rápida do Firebase
          const cap = Number(a.cap) || 0;
          const dap = cap / Math.PI;
          const alt = Number(a.altura) || 0;
          const relHD = alt > 0 && dap > 0 ? (alt / (dap / 100)) : 0;
          
          let status: any = "OK";
          let msgs = [];
          if (cap > 220 || cap < 5 && cap > 0) { status = "ERRO"; msgs.push("CAP Outlier"); }
          if (relHD > 160) { status = "ALERTA"; msgs.push("H/D Alto"); }

          return {
            id: aDoc.id, parcelaDocId: pDoc.id, fazenda: p.nomeFazenda, talhao: p.nomeTalhao,
            parcela: p.idParcela, linha: a.linha, posicao: a.posicaoNaLinha,
            cap, dap, altura: alt, relacaoHD: relHD, codigo: a.codigo, statusQA: status, mensagens: msgs
          } as ArvoreAuditada;
        });
      });

      const resultados = await Promise.all(promessas);
      setPlanilha(resultados.flat().sort((a, b) => a.fazenda.localeCompare(b.fazenda) || Number(a.parcela) - Number(b.parcela)));
    } finally { setLoading(false); }
  };

  // FUNÇÃO PARA SALVAR EDIÇÃO DIRETA
  const salvarEdicao = async (index: number, campo: string, novoValor: any) => {
    const item = planilha[index];
    const uid = auth.currentUser?.uid;
    const valorNumerico = Number(novoValor.replace(',', '.'));

    try {
      const docRef = doc(db, `clientes/${uid}/dados_coleta`, item.parcelaDocId, "arvores", item.id);
      await updateDoc(docRef, { [campo]: valorNumerico });
      
      // Atualiza localmente para não precisar recarregar tudo
      const novaPlanilha = [...planilha];
      novaPlanilha[index] = { ...item, [campo]: valorNumerico };
      setPlanilha(novaPlanilha);
      setEditando(null);
    } catch (e) { alert("Erro ao salvar no Firebase"); }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* SIDEBAR DE FILTROS (ESCOLHER TUDO) */}
      <aside className="w-72 bg-slate-900 text-white p-6 flex flex-col gap-6 overflow-y-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4">
          <ArrowLeft size={16} /> Voltar
        </button>
        
        <h2 className="text-xl font-black flex items-center gap-2"><Filter size={20} /> Filtros de Auditoria</h2>
        
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Fazendas</label>
          <div className="space-y-1 mt-2">
            {fazendas.map(f => (
              <label key={f.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-800 p-1 rounded">
                <input type="checkbox" onChange={(e) => e.target.checked ? setFazendasSel([...fazendasSel, f.id]) : setFazendasSel(fazendasSel.filter(id => id !== f.id))} />
                {f.nome}
              </label>
            ))}
          </div>
        </div>

        {fazendasSel.length > 0 && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Talhões</label>
            <div className="space-y-1 mt-2 max-h-48 overflow-y-auto border-t border-slate-800 pt-2">
              {talhoes.filter(t => fazendasSel.includes(String(t.fazendaId))).map(t => (
                <label key={t.id} className="flex items-center gap-2 text-[10px] text-slate-300">
                  <input type="checkbox" onChange={(e) => e.target.checked ? setTalhoesSel([...talhoesSel, t.id]) : setTalhoesSel(talhoesSel.filter(id => id !== t.id))} />
                  {t.nome}
                </label>
              ))}
            </div>
          </div>
        )}

        <button onClick={rodarProcessamento} className="mt-auto bg-emerald-500 text-slate-900 py-3 rounded-xl font-black text-sm uppercase shadow-lg">
          Processar Seleção
        </button>
      </aside>

      {/* ÁREA DE ANÁLISE */}
      <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
        
        {planilha.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-1/3">
              {/* GRÁFICO DE DISPERSÃO H/D */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                    <BarChart2 size={14} /> Dispersão Altura x CAP (H/D)
                </h3>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" dataKey="cap" name="CAP" unit="cm" fontSize={10} />
                      <YAxis type="number" dataKey="altura" name="Altura" unit="m" fontSize={10} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter name="Árvores" data={planilha}>
                        {planilha.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.statusQA === 'ERRO' ? '#ef4444' : '#10b981'} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* RESUMO RÁPIDO */}
              <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col justify-center">
                 <div className="flex justify-between items-center">
                    <div>
                        <p className="text-emerald-400 text-xs font-black uppercase mb-1">Amostragem Consolidada</p>
                        <h2 className="text-3xl font-black">{planilha.length} Fustes</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs font-bold uppercase mb-1">CAP Médio</p>
                        <h2 className="text-3xl font-black">{(planilha.reduce((acc, a) => acc + a.cap, 0) / planilha.length).toFixed(1)} cm</h2>
                    </div>
                 </div>
              </div>
            </div>

            {/* TABELA MANIPULÁVEL */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><TableIcon size={16} /> Planilha de Edição</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Dica: Clique em CAP ou ALTURA para editar o dado</p>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-white z-10 shadow-sm border-b-2">
                    <tr>
                      <th className="p-3 text-slate-400">Fazenda/Talhão</th>
                      <th className="p-3 text-center">Amostra/Pos</th>
                      <th className="p-3 text-center text-emerald-600 font-black">CAP (cm)</th>
                      <th className="p-3 text-center text-blue-600 font-black">ALT (m)</th>
                      <th className="p-3 text-center">H/D %</th>
                      <th className="p-3">Diagnóstico QA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planilha.map((l, i) => (
                      <tr key={i} className="border-b hover:bg-slate-50 transition-colors group">
                        <td className="p-3">
                           <span className="font-bold text-slate-700 uppercase">{l.fazenda}</span>
                           <span className="text-slate-400 ml-2">[{l.talhao}]</span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-400">P{l.parcela} <span className="font-normal text-slate-300">({l.linha}/{l.posicao})</span></td>
                        
                        {/* CÉLULA EDITÁVEL: CAP */}
                        <td className="p-3 text-center cursor-pointer hover:bg-emerald-50" onDoubleClick={() => setEditando({idx: i, campo: 'cap', valor: l.cap})}>
                          {editando?.idx === i && editando.campo === 'cap' ? (
                            <input autoFocus className="w-16 border-2 border-emerald-500 rounded p-1 text-center font-black" defaultValue={l.cap} onBlur={(e) => salvarEdicao(i, 'cap', e.target.value)} />
                          ) : (
                            <span className="font-black text-slate-900 text-sm">{l.cap.toFixed(1)}</span>
                          )}
                        </td>

                        {/* CÉLULA EDITÁVEL: ALTURA */}
                        <td className="p-3 text-center cursor-pointer hover:bg-blue-50" onDoubleClick={() => setEditando({idx: i, campo: 'altura', valor: l.altura})}>
                           {editando?.idx === i && editando.campo === 'altura' ? (
                            <input autoFocus className="w-16 border-2 border-blue-500 rounded p-1 text-center font-black" defaultValue={l.altura} onBlur={(e) => salvarEdicao(i, 'altura', e.target.value)} />
                          ) : (
                            <span className="font-bold text-slate-600">{l.altura > 0 ? l.altura.toFixed(1) : '-'}</span>
                          )}
                        </td>

                        <td className="p-3 text-center font-bold text-slate-400">{l.relacaoHD > 0 ? l.relacaoHD.toFixed(0) : '-'}</td>
                        <td className="p-3">
                           {l.statusQA === 'OK' ? (
                             <span className="text-emerald-500 flex items-center gap-1 font-bold"><CheckCircle size={12}/> OK</span>
                           ) : (
                             <div className="flex gap-1 flex-wrap">
                                {l.mensagens.map((m, idx) => (
                                    <span key={idx} className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[9px] font-black flex items-center gap-1">
                                        <AlertCircle size={10}/> {m}
                                    </span>
                                ))}
                             </div>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-4 border-dashed border-slate-100 p-12 text-center">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Filter size={40} className="text-slate-200" />
             </div>
             <p className="text-xl font-black text-slate-800">Selecione o Estrato de Auditoria</p>
             <p className="text-sm max-w-sm mt-2">Escolha as fazendas no painel lateral para consolidar os dados e iniciar a análise de consistência biológica.</p>
          </div>
        )}
      </main>
    </div>
  );
}