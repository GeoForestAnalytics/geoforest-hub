"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import Link from "next/link";

interface ArvoreAuditada {
  id: string;
  fazenda: string;
  talhao: string;
  parcela: string;
  linha: number;
  posicao: number;
  cap: number;
  dap: number;
  altura: number;
  relacaoHD: number;
  statusQA: "OK" | "ERRO" | "ALERTA";
  mensagens: string[];
}

export default function CentralDeAuditoria() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;

  // Filtros
  const [fazendasDisponiveis, setFazendasDisponiveis] = useState<any[]>([]);
  const [talhoesDisponiveis, setTalhoesDisponiveis] = useState<any[]>([]);
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);
  
  // Dados
  const [planilha, setPlanilha] = useState<ArvoreAuditada[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusDebug, setStatusDebug] = useState("");

  // 1. Carregar estrutura de filtros (Fazendas e Talhões do Cliente)
  useEffect(() => {
    const carregarFiltrosIniciais = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      console.log("--- DEBUG: Carregando filtros para UID:", user.uid);
      try {
        const fSnap = await getDocs(collection(db, `clientes/${user.uid}/fazendas`));
        const tSnap = await getDocs(collection(db, `clientes/${user.uid}/talhoes`));
        
        setFazendasDisponiveis(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTalhoesDisponiveis(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        console.log(`--- DEBUG: ${fSnap.docs.length} fazendas e ${tSnap.docs.length} talhões encontrados.`);
      } catch (e) {
        console.error("Erro ao carregar filtros:", e);
      }
    };

    const unsub = auth.onAuthStateChanged(user => {
      if (user) carregarFiltrosIniciais();
      else router.push("/login");
    });
    return () => unsub();
  }, [router]);

  // 2. FUNÇÃO DE PROCESSAMENTO (O motor da planilha)
  const processarAuditoria = async () => {
    if (fazendasSel.length === 0) return alert("Selecione ao menos uma fazenda.");
    
    setLoading(true);
    setStatusDebug("Buscando parcelas no banco...");
    const uid = auth.currentUser?.uid;
    const listaFinal: ArvoreAuditada[] = [];

    try {
      // Busca parcelas que pertencem a este projeto
      // Tentamos o ID como string e como número para evitar erros de sincronização do Flutter
      const qPar = query(
        collection(db, `clientes/${uid}/dados_coleta`),
        where("projetoId", "in", [projId, Number(projId)])
      );
      
      const pSnap = await getDocs(qPar);
      console.log("--- DEBUG: Parcelas encontradas no projeto:", pSnap.docs.length);

      // Filtro de Fazenda e Talhão em memória (mais rápido e flexível)
      const parcelasFiltradas = pSnap.docs.filter(d => {
        const data = d.data();
        const matchFazenda = fazendasSel.includes(String(data.idFazenda));
        const matchTalhao = talhoesSel.length === 0 || talhoesSel.includes(String(data.talhaoId));
        return matchFazenda && matchTalhao;
      });

      setStatusDebug(`Processando ${parcelasFiltradas.length} amostras...`);

      // Carregamento das árvores em paralelo
      const promessas = parcelasFiltradas.map(async (pDoc) => {
        const p = pDoc.data();
        const aSnap = await getDocs(collection(pDoc.ref, "arvores"));
        
        return aSnap.docs.map(aDoc => {
          const a = aDoc.data();
          const dap = (a.cap || 0) / Math.PI;
          const relHD = a.altura > 0 && dap > 0 ? (a.altura / (dap / 100)) : 0;

          let status: "OK" | "ERRO" | "ALERTA" = "OK";
          let msgs = [];

          // REGRAS TÉCNICAS (PRÉ-PROCESSAMENTO)
          if (a.cap > 200) { status = "ERRO"; msgs.push("CAP > 200"); }
          if (relHD > 160) { status = "ALERTA"; msgs.push("H/D Alto"); }
          if (relHD < 40 && a.altura > 0) { status = "ALERTA"; msgs.push("H/D Baixo"); }

          return {
            id: aDoc.id,
            fazenda: p.nomeFazenda || "N/A",
            talhao: p.nomeTalhao || "N/A",
            parcela: p.idParcela,
            linha: a.linha,
            posicao: a.posicaoNaLinha,
            cap: a.cap,
            dap: dap,
            altura: a.altura || 0,
            relacaoHD: relHD,
            statusQA: status,
            mensagens: msgs
          } as ArvoreAuditada;
        });
      });

      const resultados = await Promise.all(promessas);
      const planilhaChat = resultados.flat().sort((a, b) => 
        a.fazenda.localeCompare(b.fazenda) || 
        Number(a.parcela) - Number(b.parcela)
      );

      setPlanilha(planilhaChat);
      console.log("--- DEBUG: Auditoria concluída com", planilhaChat.length, "fustes.");

    } catch (e) {
      console.error("Erro na auditoria:", e);
      alert("Erro ao processar dados. Verifique o console.");
    } finally {
      setLoading(false);
      setStatusDebug("");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* PAINEL DE CONTROLE (FILTROS) */}
      <header className="bg-slate-900 text-white p-6 shadow-2xl">
        <div className="flex flex-wrap gap-8 items-end">
          <div className="flex-1">
            <h1 className="text-2xl font-black text-emerald-400 tracking-tighter">CENTRAL DE AUDITORIA MESTRE</h1>
            <p className="text-slate-400 text-xs font-bold uppercase">Análise de Consistência Pré-Processamento</p>
          </div>

          {/* Filtro Fazendas */}
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 w-64">
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">1. Selecionar Fazendas</label>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
              {fazendasDisponiveis.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-emerald-400 transition-colors">
                  <input 
                    type="checkbox" 
                    className="accent-emerald-500"
                    onChange={(e) => e.target.checked ? setFazendasSel([...fazendasSel, f.id]) : setFazendasSel(fazendasSel.filter(id => id !== f.id))}
                  />
                  {f.nome}
                </label>
              ))}
            </div>
          </div>

          {/* Filtro Talhões */}
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 w-64">
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">2. Filtrar Talhões</label>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
              {talhoesDisponiveis.filter(t => fazendasSel.includes(String(t.fazendaId))).map(t => (
                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-emerald-400 transition-colors">
                  <input 
                    type="checkbox" 
                    className="accent-emerald-500"
                    onChange={(e) => e.target.checked ? setTalhoesSel([...talhoesSel, t.id]) : setTalhoesSel(talhoesSel.filter(id => id !== t.id))}
                  />
                  {t.nome} <span className="text-[9px] text-slate-500">({t.especie})</span>
                </label>
              ))}
            </div>
          </div>

          <button 
            onClick={processarAuditoria}
            disabled={loading}
            className="bg-emerald-500 text-slate-900 px-10 py-4 rounded-2xl font-black text-sm hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 transition-all disabled:bg-slate-700 disabled:text-slate-500"
          >
            {loading ? "PROCESSANDO..." : "AUDITAR SELEÇÃO"}
          </button>
        </div>
      </header>

      {/* ÁREA DA PLANILHA */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-emerald-600">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-bold animate-pulse">{statusDebug}</p>
          </div>
        ) : planilha.length > 0 ? (
          <>
            <div className="flex gap-4 mb-4">
               <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Fustes Analisados</p>
                  <p className="text-lg font-black text-slate-800">{planilha.length}</p>
               </div>
               <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Inconsistências</p>
                  <p className="text-lg font-black text-red-600">{planilha.filter(l => l.statusQA !== "OK").length}</p>
               </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 z-20 shadow-sm">
                  <tr>
                    <th className="p-4 border-b border-slate-200">Fazenda</th>
                    <th className="p-4 border-b border-slate-200">Talhão</th>
                    <th className="p-4 border-b border-slate-200 text-center">Amostra</th>
                    <th className="p-4 border-b border-slate-200 text-center text-emerald-600 font-bold">CAP (cm)</th>
                    <th className="p-4 border-b border-slate-200 text-center">Alt (m)</th>
                    <th className="p-4 border-b border-slate-200 text-center">H/D %</th>
                    <th className="p-4 border-b border-slate-200">Diagnóstico QA</th>
                  </tr>
                </thead>
                <tbody>
                  {planilha.map((l, i) => (
                    <tr key={i} className={`border-b hover:bg-slate-50 transition-colors ${l.statusQA === 'ERRO' ? 'bg-red-50/50' : l.statusQA === 'ALERTA' ? 'bg-amber-50/50' : ''}`}>
                      <td className="p-3 font-medium text-slate-500 uppercase">{l.fazenda}</td>
                      <td className="p-3 font-bold text-slate-700">{l.talhao}</td>
                      <td className="p-3 text-center font-bold text-slate-400">P{l.parcela} <span className="text-[9px] font-normal">({l.linha}/{l.posicao})</span></td>
                      <td className="p-3 text-center font-black text-slate-900 text-sm">{l.cap.toFixed(1)}</td>
                      <td className="p-3 text-center">{l.altura > 0 ? l.altura.toFixed(1) : '-'}</td>
                      <td className={`p-3 text-center font-bold ${l.relacaoHD > 150 ? 'text-red-600' : 'text-slate-400'}`}>
                        {l.relacaoHD > 0 ? l.relacaoHD.toFixed(0) : '-'}
                      </td>
                      <td className="p-3">
                        {l.mensagens.length > 0 ? (
                          l.mensagens.map((m, idx) => (
                            <span key={idx} className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[9px] font-black mr-1">⚠️ {m}</span>
                          ))
                        ) : (
                          <span className="text-emerald-500 font-bold">✓ Consistente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-4 border-dashed border-slate-100">
             <span className="text-6xl mb-4">🔍</span>
             <p className="text-xl font-black text-slate-800">Pronto para Auditar</p>
             <p className="text-sm max-w-xs text-center">Selecione as fazendas desejadas no topo e clique no botão verde para gerar a planilha consolidada.</p>
          </div>
        )}
      </main>
    </div>
  );
}