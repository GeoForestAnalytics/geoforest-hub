"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useLicense } from "@/app/hooks/useAuthContext"; // ✅ Importado
import { ArrowLeft, ShieldCheck, ListFilter, CheckCircle } from "lucide-react";

interface ArvoreAuditada {
  id: string;
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
  const { licenseId, loading: authLoading, userName } = useLicense(); // ✅ Usando hook master
  
  const talhaoIdUrl = params.talhaoId as string;

  const [talhao, setTalhao] = useState<any>(null);
  const [linhas, setLinhas] = useState<ArvoreAuditada[]>([]);
  const [loading, setLoading] = useState(true);

  const executarAuditoria = async () => {
    if (!licenseId) return;
    setLoading(true);
    
    try {
      // 1. BUSCA DADOS DO TALHÃO USANDO LICENSEID
      const tRef = doc(db, `clientes/${licenseId}/talhoes`, talhaoIdUrl);
      const tSnap = await getDoc(tRef);
      if (tSnap.exists()) setTalhao(tSnap.data());

      // 2. BUSCA PARCELAS
      const qPar = query(
        collection(db, `clientes/${licenseId}/dados_coleta`),
        where("talhaoId", "in", [talhaoIdUrl, Number(talhaoIdUrl)])
      );

      const pSnap = await getDocs(qPar);
      if (pSnap.empty) {
        setLoading(false);
        return;
      }

      const listaTemp: ArvoreAuditada[] = [];

      for (const pDoc of pSnap.docs) {
        const pData = pDoc.data();
        const aSnap = await getDocs(collection(pDoc.ref, "arvores"));
        
        aSnap.forEach(aDoc => {
          const a = aDoc.data();
          const cap = Number(a.cap) || 0;
          const dap = cap / Math.PI;
          const alt = Number(a.altura) || 0;
          const relHD = alt > 0 && dap > 0 ? (alt / (dap / 100)) : 0;

          let status: "OK" | "ERRO" | "ALERTA" = "OK";
          let msgs = [];

          if (cap > 220) { status = "ERRO"; msgs.push("CAP > 220"); }
          if (relHD > 160) { status = "ALERTA"; msgs.push("H/D Alto"); }
          if (alt > 45) { status = "ERRO"; msgs.push("Altura > 45m"); }

          listaTemp.push({
            id: aDoc.id,
            parcela: pData.idParcela,
            linha: Number(a.linha),
            posicao: Number(a.posicaoNaLinha),
            cap: cap,
            dap: dap,
            altura: alt,
            relacaoHD: relHD,
            codigo: a.codigo,
            statusQA: status,
            mensagens: msgs
          });
        });
      }

      listaTemp.sort((a, b) => Number(a.parcela) - Number(b.parcela) || a.linha - b.linha || a.posicao - b.posicao);
      setLinhas(listaTemp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && licenseId) executarAuditoria();
  }, [licenseId, authLoading]);

  if (loading || authLoading) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando fustes...</div>;

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
            <button onClick={executarAuditoria} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-black transition-all">Atualizar</button>
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
                <th className="p-5 border-r border-white/5 text-center">DAP (cm)</th>
                <th className="p-5 border-r border-white/5 text-center">Alt (m)</th>
                <th className="p-5 border-r border-white/5 text-center">H/D %</th>
                <th className="p-5 border-r border-white/5">Código</th>
                <th className="p-5">Diagnóstico QA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((l, i) => (
                <tr key={i} className={`hover:bg-slate-50 transition-colors ${l.statusQA === 'ERRO' ? 'bg-red-50/50' : l.statusQA === 'ALERTA' ? 'bg-amber-50/50' : ''}`}>
                  <td className="p-4 border-r border-slate-100 text-center font-black text-slate-400">P{l.parcela}</td>
                  <td className="p-4 border-r border-slate-100 text-center font-bold text-slate-600">{l.linha} / {l.posicao}</td>
                  <td className="p-4 border-r border-slate-100 text-center font-black text-slate-900 text-sm">{l.cap.toFixed(1)}</td>
                  <td className="p-4 border-r border-slate-100 text-center text-slate-500">{l.dap.toFixed(1)}</td>
                  <td className="p-4 border-r border-slate-100 text-center font-bold text-slate-700">{l.altura > 0 ? l.altura.toFixed(1) : '-'}</td>
                  <td className={`p-4 border-r border-slate-100 text-center font-black ${l.relacaoHD > 140 ? 'text-red-500' : 'text-slate-400'}`}>
                    {l.relacaoHD > 0 ? l.relacaoHD.toFixed(0) : '-'}
                  </td>
                  <td className="p-4 border-r border-slate-100 uppercase font-black text-[9px] text-slate-400">{l.codigo}</td>
                  <td className="p-4">
                    {l.mensagens.map((m, idx) => (
                      <span key={idx} className="bg-red-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase mr-1 shadow-sm">{m}</span>
                    ))}
                    {l.statusQA === 'OK' && <span className="text-emerald-500 font-black text-[9px] uppercase flex items-center gap-1"><CheckCircle size={12}/> Consistente</span>}
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