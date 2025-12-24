"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import Link from "next/link";
// IMPORTANTE: Adicionada a importação do ícone abaixo
import { ArrowLeft } from "lucide-react";

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
  
  // IDs vindos da URL
  const projIdUrl = params.id as string;
  const talhaoIdUrl = params.talhaoId as string;

  const [talhao, setTalhao] = useState<any>(null);
  const [linhas, setLinhas] = useState<ArvoreAuditada[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (m: string) => setLogs(p => [...p, `${new Date().toLocaleTimeString()}: ${m}`]);

  const executarAuditoria = async (uid: string) => {
    addLog("Iniciando auditoria tabular...");
    
    try {
      // 1. BUSCA DADOS DO TALHÃO
      const tRef = doc(db, `clientes/${uid}/talhoes`, talhaoIdUrl);
      const tSnap = await getDoc(tRef);
      if (tSnap.exists()) setTalhao(tSnap.data());

      // 2. BUSCA PARCELAS (DADOS_COLETA)
      addLog(`Buscando parcelas do talhão ${talhaoIdUrl}...`);
      
      const qPar = query(
        collection(db, `clientes/${uid}/dados_coleta`),
        where("talhaoId", "in", [talhaoIdUrl, Number(talhaoIdUrl)])
      );

      const pSnap = await getDocs(qPar);
      addLog(`Encontradas ${pSnap.docs.length} parcelas.`);

      if (pSnap.empty) {
        addLog("Nenhum dado encontrado para os filtros.");
        setLoading(false);
        return;
      }

      const listaTemp: ArvoreAuditada[] = [];

      // 3. LEITURA DAS SUBCOLEÇÕES (ARVORES)
      for (const pDoc of pSnap.docs) {
        const pData = pDoc.data();
        addLog(`Lendo árvores da Amostra P${pData.idParcela}...`);
        
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
      addLog(`Sucesso: ${listaTemp.length} fustes carregados.`);

    } catch (e: any) {
      addLog(`ERRO: ${e.message}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) executarAuditoria(user.uid);
      else router.push("/login");
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="p-8 bg-slate-900 min-h-screen text-emerald-400 font-mono text-[10px]">
        <h2 className="text-sm font-bold mb-4 animate-pulse uppercase tracking-widest">Auditor de Pré-Processamento</h2>
        {logs.map((log, i) => <p key={i} className="mb-1">{log}</p>)}
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      {/* HEADER RESUMO COM BOTÃO VOLTAR */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <div className="flex justify-between items-center">
          <div>
            <button 
              onClick={() => router.back()} 
              className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 hover:text-emerald-600 mb-2 transition-colors"
            >
              <ArrowLeft size={12}/> Voltar ao Projeto
            </button>
            
            <h1 className="text-xl font-black text-slate-800 uppercase">Talhão: {talhao?.nome}</h1>
            <p className="text-xs text-slate-500">
              Análise Tabular de Consistência | <span className="font-bold text-emerald-600">{linhas.length} fustes</span>
            </p>
          </div>
          
          <button 
            onClick={() => executarAuditoria(auth.currentUser!.uid)} 
            className="text-[10px] font-bold bg-slate-100 px-4 py-2 rounded-lg border hover:bg-slate-200 transition-colors"
          >
            ATUALIZAR DADOS
          </button>
        </div>
      </div>

      {/* PLANILHA DENSE (ESTILO EXCEL) */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xl overflow-hidden">
        <div className="overflow-auto max-h-[75vh]">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="sticky top-0 bg-slate-800 text-slate-200 z-10">
              <tr>
                <th className="p-2 border-r border-slate-700 text-center">Amostra</th>
                <th className="p-2 border-r border-slate-700 text-center">L / P</th>
                <th className="p-2 border-r border-slate-700 text-center text-emerald-400">CAP (cm)</th>
                <th className="p-2 border-r border-slate-700 text-center">DAP (cm)</th>
                <th className="p-2 border-r border-slate-700 text-center">Alt (m)</th>
                <th className="p-2 border-r border-slate-700 text-center">H/D %</th>
                <th className="p-2 border-r border-slate-700">Código</th>
                <th className="p-2">Diagnóstico QA</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className={`border-b hover:bg-blue-50 ${l.statusQA === 'ERRO' ? 'bg-red-50' : l.statusQA === 'ALERTA' ? 'bg-amber-50' : 'even:bg-slate-50/50'}`}>
                  <td className="p-1.5 border-r border-slate-200 text-center font-bold">P{l.parcela}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center">{l.linha} / {l.posicao}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center font-black text-slate-800">{l.cap.toFixed(1)}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center">{l.dap.toFixed(1)}</td>
                  <td className="p-1.5 border-r border-slate-200 text-center">{l.altura > 0 ? l.altura.toFixed(1) : '-'}</td>
                  <td className={`p-1.5 border-r border-slate-200 text-center ${l.relacaoHD > 140 ? 'text-red-600 font-bold' : ''}`}>
                    {l.relacaoHD > 0 ? l.relacaoHD.toFixed(0) : '-'}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 uppercase font-bold text-slate-500">{l.codigo}</td>
                  <td className="p-1.5">
                    {l.mensagens.map((m, idx) => (
                      <span key={idx} className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold mr-1">{m}</span>
                    ))}
                    {l.statusQA === 'OK' && <span className="text-emerald-600 font-bold">✓ Ok</span>}
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