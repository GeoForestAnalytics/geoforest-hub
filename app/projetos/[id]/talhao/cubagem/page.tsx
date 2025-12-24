"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Table as TableIcon, Ruler, AlertCircle, CheckCircle, Database } from "lucide-react";
import Link from "next/link";

interface SecaoLinha {
  arvoreId: string;
  identificador: string;
  classe: string;
  alturaTotal: number;
  alturaMedicao: number;
  circunferencia: number;
  casca1: number;
  casca2: number;
  dsc: number; // Diâmetro sem casca calculado
}

export default function PlanilhaCubagemTalhao() {
  const params = useParams();
  const router = useRouter();
  const projId = params.id as string;
  const tId = params.talhaoId as string;

  const [talhao, setTalhao] = useState<any>(null);
  const [linhas, setLinhas] = useState<SecaoLinha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarDados = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // 1. Busca informações do talhão (Nome, Área, etc)
        const tSnap = await getDoc(doc(db, `clientes/${user.uid}/talhoes`, tId));
        if (tSnap.exists()) setTalhao(tSnap.data());

        // 2. Busca árvores de cubagem deste talhão
        // Usamos o talhaoId da URL (tratando como string ou número)
        const qCub = query(
          collection(db, `clientes/${user.uid}/dados_cubagem`),
          where("talhaoId", "in", [tId, Number(tId)])
        );
        const cubSnap = await getDocs(qCub);

        const todasLinhas: SecaoLinha[] = [];

        // 3. Entra em cada árvore e busca a subcoleção de seções
        for (const cDoc of cubSnap.docs) {
          const c = cDoc.data();
          const sSnap = await getDocs(collection(cDoc.ref, "secoes"));
          
          sSnap.forEach(sDoc => {
            const s = sDoc.data();
            
            // Cálculo do Diâmetro Sem Casca (DSC)
            const dcc = (s.circunferencia || 0) / Math.PI;
            const espessuraCascaMedia = ((Number(s.casca1_mm || 0) + Number(s.casca2_mm || 0)) / 2) / 10; // converte mm para cm
            const dscCalculado = dcc - (2 * espessuraCascaMedia);

            todasLinhas.push({
              arvoreId: c.identificador,
              identificador: c.identificador,
              classe: c.classe || "N/A",
              alturaTotal: c.alturaTotal || 0,
              alturaMedicao: s.alturaMedicao || 0,
              circunferencia: s.circunferencia || 0,
              casca1: s.casca1_mm || 0,
              casca2: s.casca2_mm || 0,
              dsc: dscCalculado
            });
          });
        }

        // Ordenação Técnica: Agrupa por árvore e depois por altura da seção
        todasLinhas.sort((a, b) => 
          a.identificador.localeCompare(b.identificador) || 
          a.alturaMedicao - b.alturaMedicao
        );
        
        setLinhas(todasLinhas);

      } catch (e) {
        console.error("Erro ao carregar dados de cubagem:", e);
      } finally {
        setLoading(false);
      }
    };

    const unsub = auth.onAuthStateChanged(user => {
      if (user) carregarDados();
      else router.push("/login");
    });
    return () => unsub();
  }, [tId, projId, router]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-emerald-400 font-mono text-[10px]">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="animate-pulse tracking-widest">CARREGANDO DADOS DE CUBAGEM RIGOROSA...</p>
    </div>
  );

  return (
    <div className="p-4 bg-slate-50 min-h-screen font-sans">
      
      {/* HEADER DE CONTEXTO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <div className="flex justify-between items-center">
          <div>
            <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 hover:text-emerald-600 mb-2 transition-colors">
                <ArrowLeft size={12}/> Voltar ao Projeto
            </button>
            <h1 className="text-xl font-black text-slate-800 uppercase">Planilha de Cubagem: {talhao?.nome || "T-ID: "+tId}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <Database size={10} /> {linhas.length} seções processadas para este talhão
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-slate-900 text-white p-4 rounded-xl text-center min-w-[140px] shadow-lg">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Árvores Cubadas</p>
                <p className="text-2xl font-black">{Array.from(new Set(linhas.map(l => l.identificador))).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PLANILHA ESTILO EXCEL (DENSE DATA) */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl overflow-hidden">
        <div className="overflow-auto max-h-[78vh]">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="sticky top-0 bg-slate-800 text-slate-200 z-10">
              <tr>
                <th className="p-3 border-r border-slate-700">Árvore ID</th>
                <th className="p-3 border-r border-slate-700 text-center">Classe</th>
                <th className="p-3 border-r border-slate-700 text-center">H Total (m)</th>
                <th className="p-3 border-r border-slate-700 text-center bg-slate-700 text-emerald-400">H Seção (m)</th>
                <th className="p-3 border-r border-slate-700 text-center">Circunf. (cm)</th>
                <th className="p-3 border-r border-slate-700 text-center text-slate-400">Casca 1 (mm)</th>
                <th className="p-3 border-r border-slate-700 text-center text-slate-400">Casca 2 (mm)</th>
                <th className="p-3 text-center bg-emerald-900 text-white font-black uppercase tracking-tighter">Diâmetro S/C (cm)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                // Validação visual de erro: diâmetro menor ou igual a zero é suspeito
                const hasError = l.dsc <= 0 && l.alturaMedicao < (l.alturaTotal * 0.95);

                return (
                  <tr key={i} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="p-2 border-r border-slate-100 font-black text-slate-700 uppercase">{l.identificador}</td>
                    <td className="p-2 border-r border-slate-100 text-center text-slate-500 font-bold">{l.classe}</td>
                    <td className="p-2 border-r border-slate-100 text-center text-slate-400">{l.alturaTotal.toFixed(1)}</td>
                    <td className="p-2 border-r border-slate-100 text-center bg-emerald-50/30 font-bold text-emerald-800">{l.alturaMedicao.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-100 text-center font-medium">{l.circunferencia.toFixed(1)}</td>
                    <td className="p-2 border-r border-slate-100 text-center text-slate-400">{l.casca1}</td>
                    <td className="p-2 border-r border-slate-100 text-center text-slate-400">{l.casca2}</td>
                    <td className={`p-2 text-center font-black text-sm ${hasError ? 'text-red-600 bg-red-50' : 'text-slate-900 bg-emerald-50/20'}`}>
                      {l.dsc > 0 ? l.dsc.toFixed(2) : '0.00'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {linhas.length === 0 && (
        <div className="flex flex-col items-center justify-center p-24 bg-white rounded-3xl border-4 border-dashed border-slate-100 mt-4">
          <AlertCircle size={40} className="text-slate-200 mb-2" />
          <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma medição encontrada.</p>
          <p className="text-slate-300 text-[10px]">Verifique se os dados de cubagem rigorosa foram sincronizados pelo App.</p>
        </div>
      )}
    </div>
  );
}