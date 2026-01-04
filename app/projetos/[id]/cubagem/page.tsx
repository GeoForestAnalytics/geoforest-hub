"use client"
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ArrowLeft,
  Ruler,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TreeDeciduous,
  Download,
  Layers,
  History,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useLicense } from "@/app/hooks/useAuthContext";
import { registerLog } from "@/app/lib/audit/audit"; // ✅ Auditoria Profissional

interface Secao {
  alturaMedicao: number;
  circunferencia: number;
  diametro: number;
}

interface CubagemAuditada {
  id: string;
  identificador: string;
  classe: string;
  cap: number;
  altura: number;
  fazenda: string;
  talhao: string;
  status: "OK" | "ERRO";
  secoes: Secao[];
}

export default function AuditoriaCubagem() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;

  // ✅ Governança e Identidade
  const { licenseId, role, userId, userName, loading: authLoading } = useLicense();
  const isGerente = role === 'gerente' || role === 'admin';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);

  const [atividadeSel, setAtividadeSel] = useState<string>(""); 
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);

  const [listaCubagem, setListaCubagem] = useState<CubagemAuditada[]>([]);
  const [arvoreSelecionada, setArvoreSelecionada] = useState<CubagemAuditada | null>(null);

  useEffect(() => {
    if (!licenseId) return;
    const carregarEstrutura = async () => {
      try {
        const qAtiv = query(collection(db, `clientes/${licenseId}/atividades`), where("projetoId", "in", [projId, Number(projId)]));
        const ativSnap = await getDocs(qAtiv);
        const atividadesCub = ativSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((a: any) => a.tipo?.toUpperCase().includes("CUB"));

        setAtividades(atividadesCub);

        const fSnap = await getDocs(collection(db, `clientes/${licenseId}/fazendas`));
        const tSnap = await getDocs(collection(db, `clientes/${licenseId}/talhoes`));

        setFazendas(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTalhoes(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
    };
    carregarEstrutura();
  }, [projId, licenseId]);

  const fazendasFiltradas = useMemo(() => {
    if (!atividadeSel) return [];
    return fazendas.filter(f => String(f.atividadeId) === atividadeSel);
  }, [fazendas, atividadeSel]);

  const handleToggleAllFazendas = () => {
    if (fazendasSel.length === fazendasFiltradas.length && fazendasFiltradas.length > 0) {
      setFazendasSel([]);
      setTalhoesSel([]); // Limpa talhões também se desmarcar as fazendas
    } else {
      setFazendasSel(fazendasFiltradas.map(f => f.id));
    }
  };

  const handleToggleAllTalhoes = () => {
    if (talhoesSel.length === talhoesFiltrados.length && talhoesFiltrados.length > 0) {
      setTalhoesSel([]);
    } else {
      setTalhoesSel(talhoesFiltrados.map(t => String(t.id)));
    }
  };

  const talhoesFiltrados = useMemo(() => {
    if (fazendasSel.length === 0) return [];
    return talhoes.filter(t => fazendasSel.includes(String(t.fazendaId)) && String(t.fazendaAtividadeId) === atividadeSel);
  }, [talhoes, fazendasSel, atividadeSel]);

  const rodarAuditoriaCubagem = async () => {
    if (!isGerente) return alert("Permissão negada para rodar análise técnica.");
    if (talhoesSel.length === 0) return alert("Selecione os talhões.");

    setLoading(true);
    setStatusMsg("Validando perfil de afilamento...");

    try {
      const idsNormalizados = talhoesSel.map(id => Number(id));
      const chunks = [];
      for (let i = 0; i < idsNormalizados.length; i += 30) {
        chunks.push(idsNormalizados.slice(i, i + 30));
      }

      const queryPromises = chunks.map(chunk => {
        const q = query(collection(db, `clientes/${licenseId}/dados_cubagem`), where("talhaoId", "in", chunk));
        return getDocs(q);
      });

      const querySnapshots = await Promise.all(queryPromises);
      const allDocs: any[] = [];
      querySnapshots.forEach(snap => allDocs.push(...snap.docs));

      const temporario: CubagemAuditada[] = [];

      for (const cDoc of allDocs) {
        const c = cDoc.data();
        if (!c.alturaTotal || c.alturaTotal === 0) continue;

        const infoTalhao = talhoes.find(t => String(t.id) === String(c.talhaoId));
        const infoFazenda = fazendas.find(f => String(f.id) === String(c.fazendaId || infoTalhao?.fazendaId));

        const sSnap = await getDocs(collection(cDoc.ref, "secoes"));
        const secoes = sSnap.docs.map(s => {
          const data = s.data();
          return {
            alturaMedicao: data.alturaMedicao,
            circunferencia: data.circunferencia,
            diametro: data.circunferencia / Math.PI
          } as Secao;
        }).sort((a, b) => a.alturaMedicao - b.alturaMedicao);

        let erroAfilamento = false;
        for (let i = 1; i < secoes.length; i++) {
          if (secoes[i].circunferencia > secoes[i - 1].circunferencia + 0.1) {
            erroAfilamento = true;
            break;
          }
        }

        temporario.push({
          id: cDoc.id,
          identificador: c.identificador,
          classe: c.classe || "N/A",
          cap: Number(c.valorCAP) || 0,
          altura: Number(c.alturaTotal) || 0,
          fazenda: c.nomeFazenda || infoFazenda?.nome || "N/A",
          talhao: c.nomeTalhao || infoTalhao?.nome || "N/A",
          status: erroAfilamento ? "ERRO" : "OK",
          secoes: secoes
        });
      }

      // ✅ REGISTRO DE AUDITORIA: Registro do processamento técnico
      await registerLog(
        licenseId!, 
        userId!, 
        userName!, 
        'ALTERACAO_DADO_TECNICO', 
        `Executou auditoria de cubagem em ${temporario.length} fustes. Atividade: ${atividadeSel}`
      );

      setListaCubagem(temporario);
      if (temporario.length > 0) setArvoreSelecionada(temporario[0]);

    } catch (e) {
      console.error(e);
      alert("Erro ao processar dados de cubagem.");
    } finally { setLoading(false); }
  };

  if (authLoading) return <div className="p-20 text-center animate-pulse">Autenticando Gestor...</div>;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">

      <aside className={`${sidebarOpen ? "w-80" : "w-0"} bg-slate-900 text-white transition-all duration-300 relative flex flex-col shrink-0 overflow-hidden shadow-2xl`}>
        <div className="p-6 flex flex-col gap-6 h-full min-w-[300px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 hover:text-white"><ArrowLeft size={12} /> Voltar</button>
            <button onClick={() => setSidebarOpen(false)} className="text-emerald-400 p-1 hover:bg-slate-800 rounded"><ChevronLeft size={20} /></button>
          </div>

          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div>
              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Layers size={12} /> 0. Atividade de Cubagem</label>
              <select
                value={atividadeSel}
                onChange={(e) => { setAtividadeSel(e.target.value); setFazendasSel([]); setTalhoesSel([]); }}
                className="w-full mt-2 bg-black/20 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
              >
                <option value="" className="bg-slate-900 text-slate-400">Selecione a Cubagem...</option>
                {atividades.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.tipo.toUpperCase()}</option>)}
              </select>
            </div>

            <div className="flex flex-col h-1/3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">1. Fazendas</label>
                <button onClick={handleToggleAllFazendas} className="text-[9px] font-bold text-emerald-500 uppercase hover:text-emerald-400">[ Todas ]</button>
              </div>
              <div className="flex-1 overflow-y-auto mt-2 border border-slate-800 p-2 rounded-xl bg-black/10 custom-scrollbar">
                {fazendasFiltradas.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-slate-800 rounded cursor-pointer transition-all">
                      <input type="checkbox" className="accent-emerald-500" checked={fazendasSel.includes(f.id)} onChange={(e) => e.target.checked ? setFazendasSel([...fazendasSel, f.id]) : setFazendasSel(fazendasSel.filter(id => id !== f.id))} />
                      <span className={fazendasSel.includes(f.id) ? "text-emerald-400 font-bold" : "text-slate-400"}>{f.nome}</span>
                    </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">2. Talhões</label>
                <button onClick={handleToggleAllTalhoes} className="text-[9px] font-bold text-emerald-500 uppercase hover:text-emerald-400">[ Todas ]</button>
              </div>
              <div className="flex-1 overflow-y-auto mt-2 border border-slate-800 p-2 rounded-xl bg-black/10 custom-scrollbar">
                {talhoesFiltrados.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-[10px] p-1 hover:bg-slate-800 rounded cursor-pointer transition-all">
                    <input type="checkbox" className="accent-emerald-500" checked={talhoesSel.includes(String(t.id))} onChange={(e) => e.target.checked ? setTalhoesSel([...talhoesSel, String(t.id)]) : setTalhoesSel(talhoesSel.filter(id => id !== String(t.id)))} />
                    <span className={talhoesSel.includes(String(t.id)) ? "text-white font-bold" : "text-slate-500"}>{t.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button onClick={rodarAuditoriaCubagem} disabled={loading} className="bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            <Zap size={16} /> {loading ? "Processando..." : "Analisar Cubagem"}
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-50 bg-slate-900 text-emerald-400 p-3 rounded-2xl shadow-2xl border border-emerald-500/30"><ChevronRight size={24} /></button>
      )}

      <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6 relative">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-emerald-600">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-black animate-pulse uppercase tracking-widest text-xs">Analisando Seções Técnicas...</p>
          </div>
        ) : listaCubagem.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[320px] shrink-0">
              <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
                  <TreeDeciduous size={14} className="text-emerald-500" /> Perfil do Fuste: {arvoreSelecionada?.identificador}
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={arvoreSelecionada?.secoes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" dataKey="circunferencia" orientation="top" unit="cm" fontSize={10} fontWeight="bold" />
                      <YAxis type="number" dataKey="alturaMedicao" reversed unit="m" fontSize={10} fontWeight="bold" />
                      <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Area type="monotone" dataKey="circunferencia" stroke="#10b981" fill="#ecfdf5" strokeWidth={4} dot={{r: 4, fill: '#10b981'}} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl flex flex-col justify-center relative overflow-hidden">
                <ShieldCheck className="absolute -right-4 -bottom-4 text-emerald-500/10" size={140} />
                <div>
                  <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Classe Diamétrica</p>
                  <h2 className="text-4xl font-black">{arvoreSelecionada?.classe}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/10 mt-8 pt-8">
                  <div>
                    <p className="text-slate-500 text-[9px] font-bold uppercase">CAP Real</p>
                    <p className="text-2xl font-black text-white">{arvoreSelecionada?.cap} <span className="text-xs">cm</span></p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[9px] font-bold uppercase">Alt. Total</p>
                    <p className="text-2xl font-black text-white">{arvoreSelecionada?.altura} <span className="text-xs">m</span></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-0">
              <div className="p-6 bg-slate-50 border-b flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-2"><Ruler size={18} /> Extrato Técnico de Cubagem</div>
                <div className="flex items-center gap-3">
                    <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full flex items-center gap-2"><History size={14}/> Auditor: {userName}</span>
                </div>
              </div>
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-white border-b z-10 shadow-sm">
                    <tr className="text-slate-400 font-black uppercase">
                      <th className="p-6">IDENTIFICADOR</th>
                      <th className="p-6">FAZENDA / TALHÃO</th>
                      <th className="p-6 text-center">CLASSE</th>
                      <th className="p-6 text-center">CAP (cm)</th>
                      <th className="p-6 text-center">ALT (m)</th>
                      <th className="p-6">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {listaCubagem.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setArvoreSelecionada(c)}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${arvoreSelecionada?.id === c.id ? 'bg-emerald-50/50' : ''}`}
                      >
                        <td className="p-6 font-black text-slate-800 uppercase">{c.identificador}</td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-700 text-[10px] uppercase">{c.fazenda}</span>
                            <span className="text-slate-400 text-[9px] font-bold uppercase mt-0.5">{c.talhao}</span>
                          </div>
                        </td>
                        <td className="p-6 text-center font-bold text-slate-500">{c.classe}</td>
                        <td className="p-6 text-center font-black text-slate-900 text-sm">{c.cap.toFixed(1)}</td>
                        <td className="p-6 text-center font-bold text-slate-600 text-sm">{c.altura.toFixed(1)}</td>
                        <td className="p-6">
                          {c.status === 'OK' ? (
                            <span className="text-emerald-500 flex items-center gap-1 font-black text-[9px] uppercase"><CheckCircle size={12} /> Consistente</span>
                          ) : (
                            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg border border-red-100 font-black text-[9px] uppercase shadow-sm flex items-center gap-1 w-fit"><AlertCircle size={12} /> Afilamento Inválido</span>
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
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <div className="bg-white p-16 rounded-[60px] shadow-sm border border-slate-200 flex flex-col items-center">
                <Ruler size={64} className="mb-6 text-slate-200" />
                <p className="font-black uppercase tracking-[0.2em] text-sm text-center text-slate-400 leading-loose">
                  Selecione Atividade e Talhões<br />para processar as seções técnicas
                </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}