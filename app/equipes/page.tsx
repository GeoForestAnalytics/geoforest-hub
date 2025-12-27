"use client"
import { useEffect, useState, useRef } from "react";
import { db, auth } from "../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  where
} from "firebase/firestore";
import { 
  Users, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Save, 
  UploadCloud,
  ChevronRight,
  UserCheck,
  AlertTriangle,
  BadgeDollarSign,
  Car,
  Edit3,
  Trash2,
  X,
  CalendarDays,
  UserMinus,
  TrendingUp,
  Trees,
  Target
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

// --- TIPAGENS ---
interface Colaborador {
  cpf: string;
  nome: string;
  cargo: string;
  valorDiaria: number;
  salarioBase: number;
  dataAdmissao: string;
  dataDemissao?: string | null;
  horasExtras?: number;
  faltasNoMes?: number;
  statusManual?: 'presente' | 'falta' | null;
}

interface DiarioCampo {
  id: string;
  dataRelatorio: string;
  nomeLider: string;
  equipeNoCarro: string;
}

interface ProducaoItem {
  id: string;
  nomeLider: string;
  dataColeta?: string;
  status?: string;
  alturaTotal?: number; // Para cubagem
}

export default function EquipesPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [diarios, setDiarios] = useState<DiarioCampo[]>([]);
  const [coletas, setColetas] = useState<ProducaoItem[]>([]);
  const [cubagens, setCubagens] = useState<ProducaoItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [previaExcel, setPreviaExcel] = useState<Colaborador[] | null>(null);
  const [editando, setEditando] = useState<Colaborador | null>(null); 
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [termoBusca, setTermoBusca] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const uid = user.uid;

        // 1. Cadastro de RH
        const unsubColab = onSnapshot(query(collection(db, `clientes/${uid}/colaboradores`)), (snap) => {
          setColaboradores(snap.docs.map(doc => doc.data() as Colaborador));
        });

        // 2. Diários de Campo (Presença)
        const unsubDiarios = onSnapshot(query(collection(db, `clientes/${uid}/diarios_de_campo`)), (snap) => {
          setDiarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiarioCampo)));
        });

        // 3. Produção de Inventário
        const unsubColetas = onSnapshot(query(collection(db, `clientes/${uid}/dados_coleta`)), (snap) => {
            setColetas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProducaoItem)));
        });

        // 4. Produção de Cubagem
        const unsubCubagem = onSnapshot(query(collection(db, `clientes/${uid}/dados_cubagem`)), (snap) => {
            setCubagens(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProducaoItem)));
        });

        setLoading(false);
        return () => {
          unsubColab();
          unsubDiarios();
          unsubColetas();
          unsubCubagem();
        };
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // --- UTILITÁRIOS DE INTELIGÊNCIA ---
  const formatarDataExcel = (valor: any) => {
    if (!valor) return "";
    if (typeof valor === 'number') {
      const data = new Date(Math.round((valor - 25569) * 86400 * 1000));
      return data.toISOString().split('T')[0];
    }
    return String(valor).trim();
  };

  const buscarColunaFlexivel = (item: any, possiveisNomes: string[]) => {
    const chaveEncontrada = Object.keys(item).find(key => 
      possiveisNomes.some(nomeAlvo => 
        key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(nomeAlvo.toLowerCase())
      )
    );
    return chaveEncontrada ? item[chaveEncontrada] : null;
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      const formatado = data.map((item: any) => ({
        nome: String(buscarColunaFlexivel(item, ["nome"]) || "").trim(),
        cpf: String(buscarColunaFlexivel(item, ["cpf"]) || "").replace(/\D/g, ""), 
        cargo: String(buscarColunaFlexivel(item, ["cargo", "funcao"]) || "Auxiliar"),
        valorDiaria: Number(String(buscarColunaFlexivel(item, ["diaria", "valor"]) || "0").replace(",", ".")),
        salarioBase: Number(String(buscarColunaFlexivel(item, ["salario", "base"]) || "0").replace(",", ".")),
        dataAdmissao: formatarDataExcel(buscarColunaFlexivel(item, ["admissao", "entrada", "inicio"])),
        dataDemissao: formatarDataExcel(buscarColunaFlexivel(item, ["demissao", "saida", "fim"])),
        horasExtras: 0,
        faltasNoMes: 0
      })).filter(c => c.nome !== "" && c.cpf !== "");
      setPreviaExcel(formatado);
    };
    reader.readAsBinaryString(file);
  };

  const salvarImportacao = async () => {
    if (!previaExcel || !auth.currentUser) return;
    setLoading(true);
    try {
      for (const colab of previaExcel) {
        await setDoc(doc(db, `clientes/${auth.currentUser.uid}/colaboradores`, colab.cpf), colab, { merge: true });
      }
      setPreviaExcel(null);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const salvarEdicaoManual = async () => {
    if (!editando || !auth.currentUser) return;
    await updateDoc(doc(db, `clientes/${auth.currentUser.uid}/colaboradores`, editando.cpf), { ...editando });
    setEditando(null);
  };

  const excluirColaborador = async (cpf: string) => {
    if (!confirm("Excluir permanentemente?") || !auth.currentUser) return;
    await deleteDoc(doc(db, `clientes/${auth.currentUser.uid}/colaboradores`, cpf));
    setEditando(null);
  };

  // --- LÓGICA DE PRODUÇÃO POR COLABORADOR ---
  const getStatsColaborador = (colab: Colaborador) => {
    const nomeBusca = colab.nome.toLowerCase().trim();
    
    // Busca os diários do dia onde este colaborador estava presente (como líder ou equipe)
    const diariosOndeEstava = diarios.filter(d => 
        d.dataRelatorio === dataFiltro && 
        (d.nomeLider.toLowerCase().includes(nomeBusca) || d.equipeNoCarro.toLowerCase().includes(nomeBusca))
    );

    const presente = colab.statusManual === 'presente' || (colab.statusManual !== 'falta' && diariosOndeEstava.length > 0);

    let amostrasCount = 0;
    let cubagensCount = 0;

    // A produção do ajudante é espelhada na do líder do carro dele
    diariosOndeEstava.forEach(diario => {
        const liderDoCarro = diario.nomeLider.toLowerCase().trim();
        
        amostrasCount += coletas.filter(c => 
            c.nomeLider.toLowerCase().trim() === liderDoCarro && 
            c.dataColeta?.split('T')[0] === dataFiltro &&
            (c.status === 'concluida' || c.status === 'exportada')
        ).length;

        cubagensCount += cubagens.filter(cb => 
            cb.nomeLider.toLowerCase().trim() === liderDoCarro && 
            (cb.dataColeta || '').split('T')[0] === dataFiltro &&
            (cb.alturaTotal || 0) > 0
        ).length;
    });

    return { presente, amostrasCount, cubagensCount };
  };

  const colaboradoresFiltrados = colaboradores.filter(c => 
    c.nome.toLowerCase().includes(termoBusca.toLowerCase()) || c.cpf.includes(termoBusca)
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500 mb-4"></div>
      <p className="text-slate-400 font-black text-[10px] tracking-widest">SINCRONIZANDO PRODUÇÃO...</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      
      {/* HEADER */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Equipes & Produção</h1>
          <p className="text-slate-500 font-medium">Controle operacional e financeiro integrado ao campo.</p>
        </div>
        <div className="flex gap-3">
          <input type="file" ref={fileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx, .xls" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
            <FileSpreadsheet size={16} className="text-emerald-600" /> Sincronizar Excel
          </button>
        </div>
      </header>

      {/* DASHBOARD DE PRODUÇÃO (TOPO) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <TrendingUp className="absolute -right-4 -bottom-4 text-emerald-500/10" size={120} />
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Amostras do Dia</p>
            <h2 className="text-5xl font-black mt-2">
                {coletas.filter(c => c.dataColeta?.split('T')[0] === dataFiltro && (c.status === 'concluida' || c.status === 'exportada')).length}
            </h2>
            <p className="text-slate-400 text-[10px] mt-4 font-bold uppercase">Consolidado Geral</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-xl w-fit"><Trees size={20}/></div>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cubagens Realizadas</p>
                <h2 className="text-3xl font-black text-slate-900">
                    {cubagens.filter(c => (c.dataColeta || '').split('T')[0] === dataFiltro && (c.alturaTotal || 0) > 0).length}
                </h2>
            </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl w-fit"><UserCheck size={20}/></div>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Colaboradores Ativos</p>
                <h2 className="text-3xl font-black text-slate-900">
                    {colaboradores.filter(c => getStatsColaborador(c).presente).length}
                </h2>
            </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="bg-red-50 text-red-600 p-2 rounded-xl w-fit"><AlertTriangle size={20}/></div>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Faltas no Dia</p>
                <h2 className="text-3xl font-black text-slate-900">
                    {colaboradores.length - colaboradores.filter(c => getStatsColaborador(c).presente).length}
                </h2>
            </div>
        </div>
      </div>

      {/* BARRA DE BUSCA E DATA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Filtrar por nome ou CPF..." className="w-full pl-14 pr-6 py-5 rounded-[24px] bg-white border border-slate-200 focus:border-emerald-500 outline-none shadow-sm transition-all text-sm font-medium" onChange={(e) => setTermoBusca(e.target.value)} />
        </div>
        <div className="bg-slate-900 text-white rounded-[24px] flex items-center px-6 gap-4 border border-emerald-500/20">
          <CalendarDays className="text-emerald-400" size={20} />
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase text-slate-400">Analisar Data:</span>
            <input type="date" value={dataFiltro} onChange={(e) => setDataFiltro(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-white cursor-pointer" />
          </div>
        </div>
      </div>

      {/* TABELA DE GESTÃO E RH */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden mb-10">
        <div className="p-8 bg-slate-50 border-b flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Relatório de Equipe e Produção</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Data: {new Date(dataFiltro).toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest bg-white border-b border-slate-100">
                <th className="p-8">Colaborador / Cargo</th>
                <th className="p-8 text-center">Status</th>
                <th className="p-8 text-center bg-slate-50/50">Produção Indiv.</th>
                <th className="p-8 text-center">Horas Extras</th>
                <th className="p-8 text-right">Valor Diária</th>
                <th className="p-8 text-right">Gerenciar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {colaboradoresFiltrados.map((c) => {
                const stats = getStatsColaborador(c);
                const isDemitido = c.dataDemissao && new Date(c.dataDemissao) <= new Date();
                
                return (
                  <tr key={c.cpf} className={`hover:bg-slate-50/80 transition-colors group ${isDemitido ? 'opacity-40 grayscale' : ''}`}>
                    <td className="p-8">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{c.nome}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{c.cargo} • CPF: {c.cpf}</span>
                      </div>
                    </td>
                    
                    <td className="p-8 text-center">
                      {isDemitido ? (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[9px] font-black uppercase"><UserMinus size={12}/> Inativo</span>
                      ) : stats.presente ? (
                        <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                          <CheckCircle2 size={12} />
                          <span className="text-[9px] font-black uppercase">Presente</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100">
                          <Clock size={12} />
                          <span className="text-[9px] font-black uppercase">Ausente</span>
                        </div>
                      )}
                    </td>

                    <td className="p-8 text-center bg-slate-50/30">
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-xs font-black text-slate-700">{stats.amostrasCount} Amostras</span>
                            <span className="text-[9px] font-bold text-blue-500 uppercase">{stats.cubagensCount} Cubagens</span>
                        </div>
                    </td>

                    <td className="p-8 text-center font-black text-slate-700">{c.horasExtras || 0}h</td>
                    <td className="p-8 font-black text-slate-900 text-right text-sm">R$ {c.valorDiaria.toFixed(2)}</td>

                    <td className="p-8 text-right">
                      <button onClick={() => setEditando(c)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-emerald-400 transition-all shadow-sm">
                        <Edit3 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO RH (MANUAL) */}
      {editando && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-emerald-500/20">
            <div className="p-10 bg-slate-50 border-b flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Ajuste de Cadastro</h2>
                <p className="text-slate-500 text-sm font-bold">{editando.nome}</p>
              </div>
              <button onClick={() => setEditando(null)} className="bg-white p-2 rounded-full shadow-sm"><X /></button>
            </div>
            
            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Data Admissão</label>
                  <input type="date" value={editando.dataAdmissao} onChange={(e) => setEditando({...editando, dataAdmissao: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Data Demissão</label>
                  <input type="date" value={editando.dataDemissao || ""} onChange={(e) => setEditando({...editando, dataDemissao: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Horas Extras</label>
                  <input type="number" value={editando.horasExtras} onChange={(e) => setEditando({...editando, horasExtras: Number(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Faltas no Mês</label>
                  <input type="number" value={editando.faltasNoMes} onChange={(e) => setEditando({...editando, faltasNoMes: Number(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Sobrepor Presença Automática</label>
                <div className="flex gap-2">
                  <button onClick={() => setEditando({...editando, statusManual: 'presente'})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${editando.statusManual === 'presente' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200'}`}>Presença</button>
                  <button onClick={() => setEditando({...editando, statusManual: 'falta'})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${editando.statusManual === 'falta' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-400 border-slate-200'}`}>Falta</button>
                  <button onClick={() => setEditando({...editando, statusManual: null})} className="p-4 rounded-2xl border border-slate-200 text-slate-300 hover:bg-slate-50"><Trash2 size={20}/></button>
                </div>
              </div>
            </div>

            <div className="p-10 bg-slate-50 border-t flex gap-3">
              <button onClick={() => excluirColaborador(editando.cpf)} className="p-5 rounded-2xl text-red-400 hover:bg-red-50 transition-all"><Trash2 size={24}/></button>
              <button onClick={salvarEdicaoManual} className="flex-1 bg-slate-900 text-emerald-400 py-5 rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* PRÉVIA EXCEL */}
      {previaExcel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-10 border-b flex justify-between items-center bg-emerald-50">
              <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Confirmar Importação</h2>
                <p className="text-emerald-700 text-sm font-bold">Verificamos {previaExcel.length} colaboradores com dados de contrato.</p>
              </div>
              <button onClick={() => setPreviaExcel(null)} className="text-slate-400 hover:text-red-500 transition-colors"><XCircle size={32}/></button>
            </div>
            
            <div className="flex-1 overflow-auto p-10">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 font-black border-b">
                    <th className="pb-4">Nome</th>
                    <th className="pb-4">CPF</th>
                    <th className="pb-4">Cargo</th>
                    <th className="pb-4">Admissão</th>
                    <th className="pb-4 text-right">Diária</th>
                    <th className="pb-4 text-right">Salário Base</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {previaExcel.map((c, i) => (
                    <tr key={i} className="text-sm">
                      <td className="py-4 font-bold text-slate-800">{c.nome}</td>
                      <td className="py-4 text-slate-500">{c.cpf}</td>
                      <td className="py-4 text-slate-400 uppercase font-black text-[9px]">{c.cargo}</td>
                      <td className="py-4 text-slate-600">{c.dataAdmissao ? new Date(c.dataAdmissao).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="py-4 text-right font-medium">R$ {c.valorDiaria.toFixed(2)}</td>
                      <td className="py-4 text-right font-black">R$ {c.salarioBase.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-10 border-t bg-slate-50 flex justify-end gap-4">
               <button onClick={() => setPreviaExcel(null)} className="px-8 py-3 rounded-2xl font-bold text-slate-500">Descartar</button>
               <button onClick={salvarImportacao} className="bg-emerald-600 text-white px-10 py-4 rounded-[20px] font-black uppercase text-xs tracking-widest hover:bg-emerald-700 shadow-lg flex items-center gap-2">
                 <Save size={18}/> Confirmar no Sistema
               </button>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ INFORMATIVO */}
      <div className="mt-8 p-6 bg-amber-50 rounded-3xl border border-amber-100 flex gap-4 items-center">
          <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
            <BadgeDollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Cálculo de Produção</p>
            <p className="text-[11px] text-amber-700">A produção individual é calculada baseada na equipe vinculada ao líder no <b>Diário de Campo</b>. Ajudantes recebem a produção total do veículo do dia.</p>
          </div>
      </div>
    </div>
  );
}