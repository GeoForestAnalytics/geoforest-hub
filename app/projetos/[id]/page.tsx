"use client"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";  
import { doc, getDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";

export default function DetalhesProjeto() {
  const params = useParams(); 
  const router = useRouter();
  const projId = params.id as string;
  
  const [projeto, setProjeto] = useState<any>(null);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const uid = user.uid;

        try {
          // 1. BUSCA O PROJETO
          const docRef = doc(db, `clientes/${uid}/projetos`, projId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setProjeto(docSnap.data());

          // 2. BUSCA ATIVIDADES (Vínculo: projetoId)
          const qAtiv = query(collection(db, `clientes/${uid}/atividades`), where("projetoId", "in", [projId, Number(projId)]));
          onSnapshot(qAtiv, (snap) => {
            setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });

          // 3. BUSCA FAZENDAS (Geral do cliente)
          onSnapshot(collection(db, `clientes/${uid}/fazendas`), (snap) => {
            setFazendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });

          // 4. BUSCA TALHÕES (Geral do cliente)
          onSnapshot(collection(db, `clientes/${uid}/talhoes`), (snap) => {
            setTalhoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });

          setLoading(false);
        } catch (error) {
          console.error("Erro na hierarquia:", error);
          setLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribeAuth();
  }, [projId, router]);

  if (loading) return <div className="p-10 text-center animate-pulse">Carregando Ecossistema...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <nav className="flex gap-2 text-xs font-bold text-slate-400 uppercase mb-4">
        <Link href="/projetos" className="hover:text-emerald-600">Projetos</Link>
        <span>/</span>
        <span className="text-slate-900">{projeto?.nome}</span>
      </nav>

      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-8">
        <h1 className="text-4xl font-black text-slate-900 mb-2">{projeto?.nome}</h1>
        <p className="text-slate-500 font-medium">Cliente: {projeto?.empresa} | Responsável: {projeto?.responsavel}</p>
      </div>

      <div className="space-y-8">
        {atividades.map((ativ) => (
          <div key={ativ.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-900 p-4 px-8 flex justify-between items-center">
              <h2 className="text-white font-bold">Atividade: {ativ.tipo}</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Filtra as fazendas que pertencem a esta atividade */}
              {fazendas.filter(f => f.atividadeId === ativ.id).map(faz => (
                <div key={faz.id} className="border-l-4 border-emerald-500 pl-6 space-y-4">
                  <span className="text-sm font-black text-slate-800 uppercase">🏠 Fazenda: {faz.nome}</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {talhoes.filter(t => t.fazendaId === faz.id).map(tal => (
                      <div key={tal.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="font-bold text-slate-800 text-sm">🌲 {tal.nome}</p>
                        <p className="text-[10px] text-slate-500">{tal.areaHa} ha | {tal.especie}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}