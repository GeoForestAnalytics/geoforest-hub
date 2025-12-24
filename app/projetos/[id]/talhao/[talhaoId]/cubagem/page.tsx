"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Database, AlertCircle, CheckCircle, Ruler } from "lucide-react";

interface SecaoLinha {
  arvoreId: string;
  identificador: string;
  classe: string;
  tipoMedida: string; // fita ou suta
  cap130: number; // Circunferência a 1.30m
  dap130: number; // Diâmetro a 1.30m
  dentroDaClasse: boolean;
  alturaTotal: number;
  alturaMedicao: number;
  circunferencia: number;
  casca1: number;
  casca2: number;
  dsc: number; 
}

export default function PlanilhaCubagemTalhao() {
  const params = useParams();
  const router = useRouter();
  const tId = params.talhaoId as string;

  const [talhao, setTalhao] = useState<any>(null);
  const [linhas, setLinhas] = useState<SecaoLinha[]>([]);
  const [loading, setLoading] = useState(true);

  // Lógica de validação: Compara sempre CAP (árvore) contra os limites da Classe (CAP)
  const validarClasse = (classeStr: string, capArvore: number) => {
    try {
      // Limpa a string da classe: "12,6 - 18,8" -> [12.6, 18.8]
      const limites = classeStr.replace(',', '.').split('-').map(v => parseFloat(v.trim()));
      if (limites.length !== 2) return true;
      
      // Comparação direta de CAP com CAP
      return capArvore >= limites[0] && capArvore <= limites[1];
    } catch (e) {
      return true;
    }
  };

  useEffect(() => {
    const carregarDados = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const tSnap = await getDoc(doc(db, `clientes/${user.uid}/talhoes`, tId));
        if (tSnap.exists()) setTalhao(tSnap.data());

        const qCub = query(
          collection(db, `clientes/${user.uid}/dados_cubagem`),
          where("talhaoId", "in", [tId, Number(tId)])
        );
        const cubSnap = await getDocs(qCub);

        const todasLinhas: SecaoLinha[] = [];

        for (const cDoc of cubSnap.docs) {
          const c = cDoc.data();
          
          // --- LÓGICA DE NORMALIZAÇÃO CAP/DAP ---
          const valorLido = Number(c.valorCAP || 0);
          const tipo = c.tipoMedidaCAP || 'fita'; // 'fita' (CAP) ou 'suta' (DAP)
          
          let cap130 = 0;
          let dap130 = 0;

          if (tipo === 'fita') {
            cap130 = valorLido;
            dap130 = valorLido / Math.PI;
          } else {
            cap130 = valorLido * Math.PI;
            dap130 = valorLido;
          }

          const statusClasse = validarClasse(c.classe || "", cap130);
          // --------------------------------------

          const sSnap = await getDocs(collection(cDoc.ref, "secoes"));
          
          sSnap.forEach(sDoc => {
            const s = sDoc.data();
            const dcc = (s.circunferencia || 0) / Math.PI;
            const espessuraCascaMedia = ((Number(s.casca1_mm || 0) + Number(s.casca2_mm || 0)) / 2) / 10;
            const dscCalculado = dcc - (2 * espessuraCascaMedia);

            todasLinhas.push({
              arvoreId: c.identificador,
              identificador: c.identificador,
              classe: c.classe || "N/A",
              tipoMedida: tipo,
              cap130: cap130,
              dap130: dap130,
              dentroDaClasse: statusClasse,
              alturaTotal: c.alturaTotal || 0,
              alturaMedicao: s.alturaMedicao || 0,
              circunferencia: s.circunferencia || 0,
              casca1: s.casca1_mm || 0,
              casca2: s.casca2_mm || 0,
              dsc: dscCalculado
            });
          });
        }

        todasLinhas.sort((a, b) => a.identificador.localeCompare(b.identificador) || a.alturaMedicao - b.alturaMedicao);
        setLinhas(todasLinhas);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    auth.onAuthStateChanged(user => { if (user) carregarDados(); });
  }, [tId]);

  if (loading) return <div className="p-10 text-emerald-500 animate-pulse font-mono">Processando Auditoria de Cubagem...</div>;

  return (
    <div className="p-4 bg-slate-50 min-h-screen font-sans">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <div className="flex justify-between items-center">
          <div>
            <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 hover:text-emerald-600 mb-2 transition-colors">
                <ArrowLeft size={12}/> Voltar
            </button>
            <h1 className="text-xl font-black text-slate-800 uppercase">Auditoria de Cubagem: {talhao?.nome}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Frequência de Classes e Afilamento | <span className="text-emerald-600">{linhas.length} seções</span>
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center min-w-[120px]">
                <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Árvores Totais</p>
                <p className="text-2xl font-black text-emerald-700">
                    {Array.from(new Set(linhas.map(l => l.identificador))).length}
                </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center min-w-[120px]">
                <p className="text-[8px] font-bold text-amber-600 uppercase mb-1">Fora da Classe</p>
                <p className="text-2xl font-black text-amber-700">
                    {Array.from(new Set(linhas.filter(l => !l.dentroDaClasse).map(l => l.identificador))).length}
                </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[78vh]">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="sticky top-0 bg-slate-800 text-slate-200 z-10">
              <tr>
                <th className="p-3 border-r border-slate-700">Árvore ID</th>
                <th className="p-3 border-r border-slate-700 text-center">Classe Alvo (CAP)</th>
                <th className="p-3 border-r border-slate-700 text-center bg-slate-700 text-emerald-400">CAP Real (cm)</th>
                <th className="p-3 border-r border-slate-700 text-center">DAP Real (cm)</th>
                <th className="p-3 border-r border-slate-700 text-center">Valid. Classe</th>
                <th className="p-3 border-r border-slate-700 text-center">H Seção (m)</th>
                <th className="p-3 border-r border-slate-700 text-center">Circunf. (cm)</th>
                <th className="p-3 border-r border-slate-700 text-center">Cascas (mm)</th>
                <th className="p-3 text-center bg-emerald-900 text-white font-black uppercase">DSC (cm)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                return (
                  <tr key={i} className={`border-b border-slate-100 transition-colors ${!l.dentroDaClasse ? 'bg-amber-50/40' : 'hover:bg-blue-50'}`}>
                    <td className="p-2 border-r border-slate-100 font-black text-slate-700 uppercase">{l.identificador}</td>
                    <td className="p-2 border-r border-slate-100 text-center text-slate-500 font-bold">{l.classe}</td>
                    
                    {/* CAP REAL (Comparador) */}
                    <td className={`p-2 border-r border-slate-100 text-center font-black ${!l.dentroDaClasse ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {l.cap130.toFixed(1)}
                    </td>

                    {/* DAP REAL */}
                    <td className="p-2 border-r border-slate-100 text-center text-slate-400">
                        {l.dap130.toFixed(1)}
                    </td>

                    {/* STATUS DA CLASSE */}
                    <td className="p-2 border-r border-slate-100 text-center">
                        {l.dentroDaClasse ? 
                            <span className="text-emerald-500 flex items-center justify-center gap-1 font-bold text-[9px] uppercase"><CheckCircle size={10}/> OK</span> : 
                            <span className="text-amber-600 flex items-center justify-center gap-1 font-bold text-[9px] uppercase"><AlertCircle size={10}/> FORA</span>
                        }
                    </td>

                    <td className="p-2 border-r border-slate-100 text-center font-bold text-slate-600">{l.alturaMedicao.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-100 text-center">{l.circunferencia.toFixed(1)}</td>
                    <td className="p-2 border-r border-slate-100 text-center text-slate-400">{l.casca1} / {l.casca2}</td>
                    <td className="p-2 text-center font-black text-sm text-slate-900 bg-emerald-50/20">
                      {l.dsc.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}