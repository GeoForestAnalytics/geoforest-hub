"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { useLicense } from "@/app/hooks/useAuthContext";
import { registerLog } from "@/app/lib/audit/audit"; // ✅ Sistema de Auditoria
import { ArrowLeft, ShieldCheck, CheckCircle, Edit2, Check, X, AlertTriangle } from "lucide-react";

interface ArvoreAuditada {
  id: string;
  parcelaDocId: string; // ID do documento pai (amostra) no Firestore
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

export default function AuditoriaTabular() {
  const params = useParams();
  const router = useRouter();
  
  // ✅ Governança e Role
  const { licenseId, role, userName, userId, loading: authLoading } = useLicense();
  const isGerente = role === 'gerente' || role === 'admin';
  
  const talhaoIdUrl = params.talhaoId as string;

  const [talhao, setTalhao] = useState<any>(null);
  const [linhas, setLinhas] = useState<ArvoreAuditada[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Estado para controle de edição inline
  const [editando, setEditando] = useState<{ id: string, field: 'cap' | 'altura', value: string } | null>(null);

  const carregarDados = async () => {
    if (!licenseId) return;
    setLoading(true);
    
    try {
      const tRef = doc(db, `clientes/${licenseId}/talhoes`, talhaoIdUrl);
      const tSnap = await getDoc(tRef);
      if (tSnap.exists()) setTalhao(tSnap.data());

      const qPar = query(
        collection(db, `clientes/${licenseId}/dados_coleta`),
        where("talhaoId", "in", [talhaoIdUrl, Number(talhaoIdUrl)])
      );

      const pSnap = await getDocs(qPar);
      const listaTemp: ArvoreAuditada[] = [];

      for (const pDoc of pSnap.docs) {
        const pData = pDoc.data();
        const aSnap = await getDocs(collection(pDoc.ref, "arvores"));
        
        aSnap.forEach(aDoc => {
          const a = aDoc.data();
          const cap = Number(a.cap) || 0;
          const alt = Number(a.altura) || 0;
          const dap = cap / Math.PI;
          const relHD = alt > 0 && dap > 0 ? (alt / (dap / 100)) : 0;

          listaTemp.push({
            id: aDoc.id,
            parcelaDocId: pDoc.id,
            parcela: pData.idParcela,
            linha: Number(a.linha),
            posicao: Number(a.posicaoNaLinha),
            cap, dap, altura: alt, relacaoHD: relHD, // Propriedade : Variável
            codigo: a.codigo,
            statusQA: cap > 220 || alt > 45 ? "ERRO" : relHD > 160 ? "ALERTA" : "OK",
            mensagens: cap > 220 ? ["CAP Extremo"] : alt > 45 ? ["Altura Extrema"] : relHD > 160 ? ["H/D Incoerente"] : []
          });
        });
      }
      listaTemp.sort((a, b) => Number(a.parcela) - Number(b.parcela) || a.linha - b.linha || a.posicao - b.posicao);
      setLinhas(listaTemp);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ✅ FUNÇÃO PROFISSIONAL PARA SALVAR ALTERAÇÃO COM AUDITORIA
  const salvarEdicao = async () => {
    if (!editando || !licenseId || !isGerente) return;

    const { id, field, value } = editando;
    const item = linhas.find(l => l.id === id);
    if (!item) return;

    const valorAntigo = field === 'cap' ? item.cap : item.altura;
    const novoValor = Number(value.replace(',', '.'));

    if (isNaN(novoValor)) return setEditando(null);
    if (novoValor === valorAntigo) return setEditando(null);

    try {
      // Caminho dinâmico para a subcoleção de árvores
      const docRef = doc(db, `clientes/${licenseId}/dados_coleta`, item.parcelaDocId, "arvores", id);
      await updateDoc(docRef, { [field]: novoValor });

      // ✅ LOG DE AUDITORIA (Fundamento ERP)
      await registerLog(
        licenseId, userId!, userName!, 'ALTERACAO_DADO_TECNICO',
        `Retificou ${field.toUpperCase()} da árvore L${item.linha}/P${item.posicao} (Talhão ${talhao?.nome}) de ${valorAntigo} para ${novoValor}`
      );

      setEditando(null);
      carregarDados(); // Recarrega para reprocessar as cores de erro/alerta
    } catch (e) {
      alert("Erro ao salvar alteração no banco de dados.");
    }
  };

  useEffect(() => {
    if (!authLoading && licenseId) carregarDados();
  }, [licenseId, authLoading]);

  if (loading || authLoading) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase text-xs">Sincronizando fustes...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <div>
            <button onClick={() => router.back()} className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 hover:text-emerald-600 mb-2 transition-all">
              <ArrowLeft size={14}/> Voltar ao Projeto
            </button>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Talhão: {talhao?.nome}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auditoria de Inventário | <span className="text-emerald-600">{linhas.length} árvores</span></p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase">Status de Dados</p>
                <p className="text-xs font-black text-emerald-600 flex items-center gap-1"><ShieldCheck size={14}/> Base Consolidada</p>
            </div>
            <button onClick={carregarDados} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-black transition-all shadow-xl">Atualizar</button>
          </div>
      </header>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[70vh] custom-scrollbar">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="sticky top-0 bg-slate-900 text-white z-10">
              <tr className="uppercase font-black tracking-widest">
                <th className="p-5 border-r border-white/5 text-center">Amostra</th>
                <th className="p-5 border-r border-white/5 text-center">L / P</th>
                <th className="p-5 border-r border-white/5 text-center text-emerald-400">CAP (cm)</th>
                <th className="p-5 border-r border-white/5 text-center">ALT (m)</th>
                <th className="p-5 border-r border-white/5 text-center">H/D %</th>
                <th className="p-5 border-r border-white/5">Código</th>
                <th className="p-5">Diagnóstico QA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((l) => (
                <tr key={l.id} className={`hover:bg-slate-50 transition-colors ${l.statusQA === 'ERRO' ? 'bg-red-50/50' : l.statusQA === 'ALERTA' ? 'bg-amber-50/50' : ''}`}>
                  <td className="p-4 border-r border-slate-100 text-center font-black text-slate-400">P{l.parcela}</td>
                  <td className="p-4 border-r border-slate-100 text-center font-bold text-slate-600">{l.linha} / {l.posicao}</td>
                  
                  {/* ✅ CÉLULA CAP COM LÁPIS (EDIÇÃO INLINE) */}
                  <td className="p-4 border-r border-slate-100 text-center group">
                    {editando?.id === l.id && editando.field === 'cap' ? (
                        <div className="flex items-center justify-center gap-1">
                            <input autoFocus className="w-16 p-1 border-2 border-emerald-500 rounded text-center font-black outline-none" value={editando.value} onChange={e => setEditando({...editando, value: e.target.value})} onKeyDown={e => e.key === 'Enter' && salvarEdicao()}/>
                            <button onClick={salvarEdicao} className="text-emerald-600"><Check size={14}/></button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 font-black text-slate-900 text-sm">
                            {l.cap.toFixed(1)}
                            {isGerente && (
                                <button onClick={() => setEditando({id: l.id, field: 'cap', value: l.cap.toString()})} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-emerald-600 transition-all">
                                    <Edit2 size={12}/>
                                </button>
                            )}
                        </div>
                    )}
                  </td>

                  {/* ✅ CÉLULA ALTURA COM LÁPIS (EDIÇÃO INLINE) */}
                  <td className="p-4 border-r border-slate-100 text-center group">
                    {editando?.id === l.id && editando.field === 'altura' ? (
                        <div className="flex items-center justify-center gap-1">
                            <input autoFocus className="w-16 p-1 border-2 border-emerald-500 rounded text-center font-black outline-none" value={editando.value} onChange={e => setEditando({...editando, value: e.target.value})} onKeyDown={e => e.key === 'Enter' && salvarEdicao()}/>
                            <button onClick={salvarEdicao} className="text-emerald-600"><Check size={14}/></button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 font-bold text-slate-700">
                            {l.altura > 0 ? l.altura.toFixed(1) : '-'}
                            {isGerente && l.altura > 0 && (
                                <button onClick={() => setEditando({id: l.id, field: 'altura', value: l.altura.toString()})} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-emerald-600 transition-all">
                                    <Edit2 size={12}/>
                                </button>
                            )}
                        </div>
                    )}
                  </td>

                  <td className={`p-4 border-r border-slate-100 text-center font-black ${l.relacaoHD > 140 ? 'text-red-500' : 'text-slate-400'}`}>
                    {l.relacaoHD > 0 ? l.relacaoHD.toFixed(0) : '-'}
                  </td>
                  <td className="p-4 border-r border-slate-100 uppercase font-black text-[9px] text-slate-400">{l.codigo}</td>
                  <td className="p-4">
                    {l.statusQA === 'OK' ? (
                        <span className="text-emerald-500 font-black text-[9px] uppercase flex items-center gap-1"><CheckCircle size={12}/> Consistente</span>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 rounded text-[8px] font-black uppercase text-white w-fit ${l.statusQA === 'ERRO' ? 'bg-red-500' : 'bg-amber-500'}`}>
                                {l.statusQA} DETECTADO
                            </span>
                            {l.mensagens.map((m, idx) => (
                                <span key={idx} className="text-[8px] text-slate-400 font-bold uppercase">{m}</span>
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
    </div>
  );
}