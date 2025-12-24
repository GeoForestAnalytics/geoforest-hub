"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Table as TableIcon,
  BarChart2,
  Filter,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Trash2,
} from "lucide-react";

interface ArvoreAuditada {
  id: string;
  parcelaDocId: string;
  fazenda: string;
  talhao: string;
  parcela: string;
  linha: number;
  posicao: number;
  cap: number;
  dap: number;
  altura: number;
  alturaDano: number;
  relacaoHD: number;
  codigo: string;
  statusQA: "OK" | "ERRO" | "ALERTA";
  mensagens: string[];
}

export default function CentralBI() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;

  // Estados de Interface
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ idx: number; campo: string } | null>(null);

  // Estados de Dados
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [fazendasSel, setFazendasSel] = useState<string[]>([]);
  const [talhoesSel, setTalhoesSel] = useState<string[]>([]);
  const [planilhaCompleta, setPlanilhaCompleta] = useState<ArvoreAuditada[]>([]);

  // Filtros de Tabela
  const [filtrosAtivos, setFiltrosAtivos] = useState<{ [key: string]: string[] }>({
    fazenda: [],
    talhao: [],
    parcela: [],
    cap: [],
    altura: [],
    alturaDano: [],
    codigo: [],
    statusQA: [],
  });
  const [menuFiltroAberto, setMenuFiltroAberto] = useState<string | null>(null);

  // Carregamento Inicial
  useEffect(() => {
    const carregarEstrutura = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const fSnap = await getDocs(collection(db, `clientes/${uid}/fazendas`));
        const tSnap = await getDocs(collection(db, `clientes/${uid}/talhoes`));
        setFazendas(fSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTalhoes(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };

    auth.onAuthStateChanged((user) => {
      if (user) carregarEstrutura();
      else router.push("/login");
    });
  }, [router]);

  // Lógica de Filtros
  const toggleFiltroValue = (coluna: string, valor: string) => {
    setFiltrosAtivos((prev) => {
      const atuais = prev[coluna] || [];
      const novos = atuais.includes(valor)
        ? atuais.filter((v) => v !== valor)
        : [...atuais, valor];
      return { ...prev, [coluna]: novos };
    });
  };

  // Função Principal de Auditoria
  const rodarAuditoria = async () => {
    if (fazendasSel.length === 0) return alert("Selecione ao menos uma fazenda.");
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      const qPar = query(
        collection(db, `clientes/${uid}/dados_coleta`),
        where("projetoId", "in", [projId, Number(projId)])
      );
      const pSnap = await getDocs(qPar);

      const nomesFazendasFiltro = fazendas
        .filter((f) => fazendasSel.includes(f.id))
        .map((f) => f.nome.toLowerCase().trim());

      const parcelasFiltradas = pSnap.docs.filter((d) => {
        const data = d.data();
        const fId = String(data.idFazenda || data.fazendaId || "").trim();
        const fNome = String(data.nomeFazenda || "").toLowerCase().trim();
        const tId = String(data.talhaoId || "");
        return (
          (fazendasSel.includes(fId) || nomesFazendasFiltro.includes(fNome)) &&
          (talhoesSel.length === 0 || talhoesSel.includes(tId))
        );
      });

      const promessas = parcelasFiltradas.map(async (pDoc) => {
        const p = pDoc.data();
        let aSnap = await getDocs(collection(pDoc.ref, "arvores"));
        if (aSnap.empty) aSnap = await getDocs(collection(pDoc.ref, "arvore"));

        return aSnap.docs.map((aDoc) => {
          const a = aDoc.data() as any;
          const cap = Number(a.cap) || 0;
          const dap = cap / Math.PI;
          const alt = Number(a.altura) || 0;
          const altD = Number(a.alturaDano) || 0;
          const relacaoHD = alt > 0 && dap > 0 ? alt / (dap / 100) : 0;

          let status: any = "OK";
          let msgs = [];
          if (cap > 220 || (cap < 5 && cap > 0)) {
            status = "ERRO";
            msgs.push("Outlier CAP");
          }
          if (relacaoHD > 165) {
            status = "ALERTA";
            msgs.push("H/D Alto");
          }
          if (a.codigo === "Falha" || cap === 0) {
            status = "ERRO";
            msgs.push("Falha");
          }

          return {
            id: aDoc.id,
            parcelaDocId: pDoc.id,
            fazenda: p.nomeFazenda || "N/A",
            talhao: p.nomeTalhao || "N/A",
            parcela: p.idParcela,
            linha: a.linha,
            posicao: a.posicaoNaLinha,
            cap,
            dap,
            altura: alt,
            alturaDano: altD,
            relacaoHD,
            codigo: a.codigo || "NORMAL",
            statusQA: status,
            mensagens: msgs,
          } as ArvoreAuditada;
        });
      });

      const resultados = await Promise.all(promessas);
      setPlanilhaCompleta(
        resultados
          .flat()
          .sort(
            (a, b) =>
              a.fazenda.localeCompare(b.fazenda) ||
              Number(a.parcela) - Number(b.parcela)
          )
      );
    } finally {
      setLoading(false);
    }
  };

  // Cálculo da Planilha Filtrada
  const planilhaFiltrada = useMemo(() => {
    return planilhaCompleta.filter((item) => {
      return Object.keys(filtrosAtivos).every((key) => {
        const ativos = filtrosAtivos[key];
        if (!ativos || ativos.length === 0) return true;
        return ativos.includes(String(item[key as keyof ArvoreAuditada]));
      });
    });
  }, [planilhaCompleta, filtrosAtivos]);

  // KPIs
  const capMedio = useMemo(() => {
    if (planilhaFiltrada.length === 0) return 0;
    const soma = planilhaFiltrada.reduce((acc, item) => acc + item.cap, 0);
    return soma / planilhaFiltrada.length;
  }, [planilhaFiltrada]);

  const areaBasalTotal = useMemo(() => {
    return planilhaFiltrada.reduce(
      (acc, a) => acc + Math.PI * Math.pow(a.cap / Math.PI / 200, 2),
      0
    );
  }, [planilhaFiltrada]);

  // Navegação do Gráfico para a Tabela
  const handlePointDoubleClick = (data: any) => {
    if (!data || !data.id) return;
    setHighlightedId(data.id);
    const element = document.getElementById(`tree-row-${data.id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedId(null), 3000);
    }
  };

  // Edição
  const salvarEdicaoRapida = async (index: number, campo: string, valor: string) => {
    const item = planilhaFiltrada[index];
    const uid = auth.currentUser?.uid;
    const novoValor = Number(valor.replace(",", "."));
    if (isNaN(novoValor)) return setEditando(null);

    try {
      const docRef = doc(
        db,
        `clientes/${uid}/dados_coleta`,
        item.parcelaDocId,
        "arvores",
        item.id
      );
      await updateDoc(docRef, { [campo]: novoValor });
      const novaPlanilha = planilhaCompleta.map((p) =>
        p.id === item.id ? { ...p, [campo]: novoValor } : p
      );
      setPlanilhaCompleta(novaPlanilha);
      setEditando(null);
    } catch (e) {
      alert("Erro ao salvar.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      {/* SIDEBAR RETRÁTIL */}
      <aside
        className={`${
          sidebarOpen ? "w-80" : "w-0"
        } bg-slate-900 text-white transition-all duration-300 relative flex flex-col shrink-0 overflow-hidden`}
      >
        <div className="p-6 flex flex-col gap-6 h-full min-w-[300px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <button
              onClick={() => router.back()}
              className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 hover:text-white"
            >
              <ArrowLeft size={12} /> Voltar
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-emerald-400 p-1 hover:bg-slate-800 rounded"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Fazendas */}
            <div className="flex flex-col h-1/2">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">
                  1. Fazendas
                </label>
                <button
                  onClick={() =>
                    setFazendasSel(
                      fazendasSel.length === fazendas.length
                        ? []
                        : fazendas.map((f) => f.id)
                    )
                  }
                  className="text-[9px] font-bold text-emerald-500 uppercase hover:text-emerald-400"
                >
                  [ Todas ]
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 border border-slate-800 p-2 rounded-xl bg-black/10 custom-scrollbar">
                {fazendas.map((f, index) => (
                  <label
                    key={`${f.id}-${index}`}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-800 p-1.5 rounded transition-all"
                  >
                    <input
                      type="checkbox"
                      className="accent-emerald-500"
                      checked={fazendasSel.includes(f.id)}
                      onChange={(e) =>
                        e.target.checked
                          ? setFazendasSel([...fazendasSel, f.id])
                          : setFazendasSel(fazendasSel.filter((id) => id !== f.id))
                      }
                    />
                    <span
                      className={
                        fazendasSel.includes(f.id)
                          ? "text-emerald-400 font-bold"
                          : "text-slate-400"
                      }
                    >
                      {f.nome}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Talhões */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">
                  2. Talhões
                </label>
                <button
                  onClick={() =>
                    setTalhoesSel(
                      talhoes
                        .filter((t) => fazendasSel.includes(String(t.fazendaId)))
                        .map((t) => String(t.id))
                    )
                  }
                  className="text-[9px] font-bold text-emerald-500 uppercase hover:text-emerald-400"
                >
                  [ Todas ]
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 border border-slate-800 p-2 rounded-xl bg-black/10 custom-scrollbar">
                {fazendasSel.length > 0 ? (
                  talhoes
                    .filter((t) => fazendasSel.includes(String(t.fazendaId)))
                    .map((t, index) => (
                      <label
                        key={`${t.id}-${index}`}
                        className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-slate-800 p-1 rounded transition-all"
                      >
                        <input
                          type="checkbox"
                          className="accent-emerald-500"
                          checked={talhoesSel.includes(String(t.id))}
                          onChange={(e) =>
                            e.target.checked
                              ? setTalhoesSel([...talhoesSel, String(t.id)])
                              : setTalhoesSel(
                                  talhoesSel.filter((id) => id !== String(t.id))
                                )
                          }
                        />
                        <span
                          className={
                            talhoesSel.includes(String(t.id))
                              ? "text-white font-bold"
                              : "text-slate-500"
                          }
                        >
                          {t.nome}
                        </span>
                      </label>
                    ))
                ) : (
                  <p className="text-[10px] text-slate-600 text-center mt-10 italic">
                    Selecione uma fazenda.
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={rodarAuditoria}
            className="bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-emerald-400 transition-all"
          >
            Auditar Seleção
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-4 top-4 z-50 bg-slate-900 text-emerald-400 p-3 rounded-2xl shadow-2xl border border-emerald-500/30"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <main className="flex-1 flex flex-col overflow-hidden p-6 gap-4 relative">
        {planilhaCompleta.length > 0 && (
          <div className="flex flex-col gap-4 shrink-0">
            {/* BARRA DE KPIs COMPACTA */}
            <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-xl flex flex-row items-center justify-between px-10 border border-emerald-500/10">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                    Fustes
                  </p>
                  <h2 className="text-xl font-black">{planilhaFiltrada.length}</h2>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase">
                    CAP Médio
                  </p>
                  <h2 className="text-lg font-bold">
                    {capMedio.toFixed(1)} <span className="text-[10px]">cm</span>
                  </h2>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div>
                  <p className="text-red-400 text-[9px] font-bold uppercase">Erros QA</p>
                  <h2 className="text-lg font-bold text-red-400">
                    {planilhaFiltrada.filter((l) => l.statusQA !== "OK").length}
                  </h2>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div>
                  <p className="text-slate-500 text-[9px] font-bold uppercase">
                    Área Basal (G)
                  </p>
                  <h2 className="text-lg font-bold text-emerald-400">
                    {areaBasalTotal.toFixed(2)}
                    <span className="text-[10px] ml-1">m²</span>
                  </h2>
                </div>
              </div>

              <div className="text-right border-l border-slate-800 pl-8">
                <p className="text-slate-500 text-[9px] font-bold uppercase">
                  Amostras Únicas
                </p>
                <p className="text-lg font-bold">
                  {new Set(planilhaFiltrada.map((p) => p.parcela)).size}
                </p>
              </div>
            </div>

            {/* GRÁFICO */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[350px]">
              <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2">
                <BarChart2 size={14} /> Dispersão H/D (Consolidado do Estrato)
              </h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      type="number"
                      dataKey="cap"
                      name="CAP"
                      unit="cm"
                      fontSize={10}
                      tick={{ fill: "#94a3b8" }}
                    />
                    <YAxis
                      type="number"
                      dataKey="altura"
                      name="Altura"
                      unit="m"
                      fontSize={10}
                      tick={{ fill: "#94a3b8" }}
                    />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter
                      name="Árvores"
                      data={planilhaFiltrada}
                      onDoubleClick={(data) => handlePointDoubleClick(data)}
                      className="cursor-pointer"
                    >
                      {planilhaFiltrada.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.statusQA === "ERRO"
                              ? "#ef4444"
                              : entry.cap === 0
                              ? "#94a3b8"
                              : "#10b981"
                          }
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* PLANILHA MESTRE */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-0">
          <div className="p-3 bg-slate-50 border-b flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <div className="flex items-center gap-2">
              <TableIcon size={14} /> Planilha Mestre de Auditoria
            </div>
            <button
              onClick={() =>
                setFiltrosAtivos({
                  fazenda: [],
                  talhao: [],
                  parcela: [],
                  cap: [],
                  altura: [],
                  alturaDano: [],
                  codigo: [],
                  statusQA: [],
                })
              }
              className="text-red-500 hover:text-red-700 flex items-center gap-1 transition-all"
            >
              <Trash2 size={12} /> Limpar Filtros
            </button>
          </div>

          <div className="overflow-auto flex-1 scroll-smooth">
            <table className="w-full text-left text-[11px] border-collapse relative">
              <thead className="sticky top-0 bg-white z-20 shadow-sm border-b">
                <tr className="bg-slate-50/50">
                  {[
                    "fazenda",
                    "talhao",
                    "parcela",
                    "cap",
                    "altura",
                    "alturaDano",
                    "codigo",
                    "statusQA",
                  ].map((col) => (
                    <th
                      key={col}
                      className="p-3 text-slate-400 font-black uppercase relative group border-r border-slate-100 last:border-r-0"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>
                          {col === "statusQA"
                            ? "Diagnóstico"
                            : col === "alturaDano"
                            ? "Dano"
                            : col}
                        </span>
                        <button
                          onClick={() =>
                            setMenuFiltroAberto(menuFiltroAberto === col ? null : col)
                          }
                          className={`p-1 rounded ${
                            filtrosAtivos[col].length > 0
                              ? "bg-emerald-500 text-white"
                              : "hover:bg-slate-200"
                          }`}
                        >
                          <ListFilter size={12} />
                        </button>
                      </div>

                      {menuFiltroAberto === col && (
                        <div className="absolute top-10 left-0 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 w-48 z-30 normal-case font-normal text-slate-700">
                          <p className="text-[9px] font-black uppercase mb-2 text-slate-400 border-b pb-1">
                            Filtrar {col}
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {Array.from(
                              new Set(
                                planilhaCompleta.map((p) =>
                                  String(p[col as keyof ArvoreAuditada])
                                )
                              )
                            )
                              .sort((a, b) =>
                                a.localeCompare(b, undefined, { numeric: true })
                              )
                              .map((val) => (
                                <label
                                  key={val}
                                  className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded cursor-pointer text-[10px]"
                                >
                                  <input
                                    type="checkbox"
                                    checked={filtrosAtivos[col].includes(val)}
                                    onChange={() => toggleFiltroValue(col, val)}
                                  />{" "}
                                  {val}
                                </label>
                              ))}
                          </div>
                          <button
                            onClick={() => setMenuFiltroAberto(null)}
                            className="w-full mt-3 py-1 bg-slate-900 text-white text-[9px] rounded font-bold uppercase"
                          >
                            Fechar
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planilhaFiltrada.map((l, i) => (
                  <tr
                    key={i}
                    id={`tree-row-${l.id}`}
                    className={`border-b border-slate-50 transition-all duration-700 ${
                      highlightedId === l.id
                        ? "bg-yellow-50 ring-1 ring-yellow-400 z-10"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="p-3 font-black text-slate-700 text-[10px] uppercase">
                      {l.fazenda}
                    </td>
                    <td className="p-3 text-slate-500 font-bold italic">{l.talhao}</td>
                    <td className="p-3 text-center font-bold text-slate-400">
                      P{l.parcela}{" "}
                      <span className="block text-[8px] font-normal">
                        {l.linha}/{l.posicao}
                      </span>
                    </td>
                    <td
                      className={`p-3 text-center cursor-pointer font-black text-sm ${
                        l.cap === 0 ? "text-red-400 bg-red-50/50" : "text-slate-900"
                      }`}
                      onDoubleClick={() => setEditando({ idx: i, campo: "cap" })}
                    >
                      {editando?.idx === i && editando.campo === "cap" ? (
                        <input
                          autoFocus
                          className="w-16 border-2 border-emerald-500 rounded p-1 text-center"
                          defaultValue={l.cap}
                          onBlur={(e) => salvarEdicaoRapida(i, "cap", e.target.value)}
                        />
                      ) : (
                        l.cap.toFixed(1)
                      )}
                    </td>
                    <td
                      className="p-3 text-center cursor-pointer font-bold text-slate-600"
                      onDoubleClick={() => setEditando({ idx: i, campo: "altura" })}
                    >
                      {editando?.idx === i && editando.campo === "altura" ? (
                        <input
                          autoFocus
                          className="w-16 border-2 border-blue-500 rounded p-1 text-center"
                          defaultValue={l.altura}
                          onBlur={(e) => salvarEdicaoRapida(i, "altura", e.target.value)}
                        />
                      ) : l.altura > 0 ? (
                        l.altura.toFixed(1)
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 text-center text-slate-400 font-bold">
                      {l.alturaDano > 0 ? l.alturaDano.toFixed(1) : "-"}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          l.codigo !== "NORMAL"
                            ? "bg-amber-100 text-amber-700"
                            : "text-slate-400"
                        }`}
                      >
                        {l.codigo}
                      </span>
                    </td>
                    <td className="p-3">
                      {l.statusQA === "OK" ? (
                        <span className="text-emerald-500 flex items-center gap-1 font-bold text-[9px] uppercase">
                          <CheckCircle size={10} /> Consistente
                        </span>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {l.mensagens.map((m, idx) => (
                            <span
                              key={idx}
                              className="bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 text-[9px] font-black uppercase flex items-center gap-1"
                            >
                              {m}
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
      </main>
    </div>
  );
}