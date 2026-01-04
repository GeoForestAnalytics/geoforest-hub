"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useLicense } from "@/app/hooks/useAuthContext"; // ✅ Importado
import { ArrowLeft, CheckCircle, AlertCircle, Ruler, ShieldCheck } from "lucide-react";

interface SecaoLinha {
  arvoreId: string;
  identificador: string;
  classe: string;
  tipoMedida: string;
  cap130: number;
  dap130: number;
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
  const { licenseId, loading: authLoading } = useLicense(); // ✅ Usando licenseId
  const tId = params.talhaoId as string;

  const [talhao, setTalhao] = useState<any>(null);
  const [linhas, setLinhas] = useState<SecaoLinha[]>([]);
  const [loading, setLoading] = useState(true);

  const validarClasse = (classeStr: string, capArvore: number) => {
    try {
      const limites = classeStr.replace(',', '.').split('-').map(v => parseFloat(v.trim()));
      if (limites.length !== 2) return true;
      return capArvore >= limites[0] && capArvore <= limites[1];
    } catch (e) { return true; }
  };

  useEffect(() => {
    if (!licenseId) return;

    const carregarDados = async () => {
      try {
        const tSnap = await getDoc(doc(db, `clientes/${licenseId}/talhoes`, tId));
        if (tSnap.exists()) setTalhao(tSnap.data());

        const qCub = query(
          collection(db, `clientes/${licenseId}/dados_cubagem`),
          where("talhaoId", "in", [tId, Number(tId)])
        );
        const cubSnap = await getDocs(qCub);

        const todasLinhas: SecaoLinha[] = [];
        for (const cDoc of cubSnap.docs) {
          const c = cDoc.data();
          const valorLido = Number(c.valorCAP || 0);
          const tipo = c.tipoMedidaCAP || 'fita';
          
          let cap130 = tipo === 'fita' ? valorLido : valorLido * Math.PI;
          let dap130 = tipo === 'fita' ? valorLido / Math.PI : valorLido;

          const statusClasse = validarClasse(c.classe || "", cap130);
          const sSnap = await getDocs(collection(cDoc.ref, "secoes"));
          
          sSnap.forEach(sDoc => {
            const s = sDoc.data();
            const dcc = (s.circunferencia || 0) / Math.PI;
            const espessuraCascaMedia = ((Number(s.casca1_mm || 0) + Number(s.casca2_mm || 0)) / 2) / 10;
            todasLinhas.push({
              arvoreId: c.identificador, identificador: c.identificador, classe: c.classe || "N/A",
              tipoMedida: tipo, cap130, dap130, dentroDaClasse: statusClasse,
              alturaTotal: c.alturaTotal || 0, alturaMedicao: s.alturaMedicao || 0,
              circunferencia: s.circunferencia || 0, casca1: s.casca1_mm || 0,
              casca2: s.casca2_mm || 0, dsc: dcc - (2 * espessuraCascaMedia)
            });
          });
        }
        todasLinhas.sort((a, b) => a.identificador.localeCompare(b.identificador) || a.alturaMedicao - b.alturaMedicao);
        setLinhas(todasLinhas);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    carregarDados();
  }, [tId, licenseId]);

  if (loading || authLoading) return <div className="p-20 text-center animate-pulse font-black text-emerald-600 uppercase text-xs">Processando seções técnicas...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      <header className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <button onClick={() => router.back()} className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 hover:text-emerald-600 mb-2 transition-all">
                <ArrowLeft size={14}/> Voltar ao Projeto
            </button>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Cubagem: {talhao?.nome}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Análise de Afilamento e Casca | <span className="text-emerald-600">{linhas.length} seções</span>
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-slate-900 px-6 py-4 rounded-[24px] text-center shadow-xl">
                <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Árvores</p>
                <p className="text-2xl font-black text-white">{Array.from(new Set(linhas.map(l => l.identificador))).length}</p>
            </div>
            <div className="bg-white border-2 border-amber-500 px-6 py-4 rounded-[24px] text-center">
                <p className="text-[8px] font-black text-amber-600 uppercase mb-1">Fora da Classe</p>
                <p className="text-2xl font-black text-amber-700">{Array.from(new Set(linhas.filter(l => !l.dentroDaClasse).map(l => l.identificador))).length}</p>
            </div>
          </div>
      </header>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[75vh] custom-scrollbar">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="sticky top-0 bg-slate-900 text-white z-10">
              <tr className="font-black uppercase tracking-widest">
                <th className="p-5 border-r border-white/5">ID Árvore</th>
                <th className="p-5 border-r border-white/5 text-center">Classe Alvo</th>
                <th className="p-5 border-r border-white/5 text-center bg-slate-800 text-emerald-400">CAP Real</th>
                <th className="p-5 border-r border-white/5 text-center">DAP (cm)</th>
                <th className="p-5 border-r border-white/5 text-center">Valid.</th>
                <th className="p-5 border-r border-white/5 text-center">H (m)</th>
                <th className="p-5 border-r border-white/5 text-center">Circ (cm)</th>
                <th className="p-5 text-center bg-emerald-600">DSC (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((l, i) => (
                  <tr key={i} className={`hover:bg-slate-50 transition-colors ${!l.dentroDaClasse ? 'bg-amber-50/50' : ''}`}>
                    <td className="p-4 border-r border-slate-100 font-black text-slate-800 uppercase">{l.identificador}</td>
                    <td className="p-4 border-r border-slate-100 text-center text-slate-400 font-bold">{l.classe}</td>
                    <td className={`p-4 border-r border-slate-100 text-center font-black text-sm ${!l.dentroDaClasse ? 'text-amber-600' : 'text-emerald-700'}`}>{l.cap130.toFixed(1)}</td>
                    <td className="p-4 border-r border-slate-100 text-center text-slate-500">{l.dap130.toFixed(1)}</td>
                    <td className="p-4 border-r border-slate-100 text-center">
                        {l.dentroDaClasse ? 
                            <span className="text-emerald-500 font-black text-[9px] uppercase">✓ OK</span> : 
                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-black text-[8px] uppercase">Fora</span>
                        }
                    </td>
                    <td className="p-4 border-r border-slate-100 text-center font-bold text-slate-600">{l.alturaMedicao.toFixed(2)}</td>
                    <td className="p-4 border-r border-slate-100 text-center text-slate-500">{l.circunferencia.toFixed(1)}</td>
                    <td className="p-4 text-center font-black text-sm text-slate-900 bg-emerald-50/30">{l.dsc.toFixed(2)}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}