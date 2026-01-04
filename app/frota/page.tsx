"use client"
import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import { 
  collection, onSnapshot, query, doc, setDoc, 
  updateDoc, deleteDoc, serverTimestamp, addDoc, orderBy 
} from "firebase/firestore";
import { useLicense } from "../hooks/useAuthContext";
import { registerLog } from "../lib/audit/audit"; // ✅ Sistema de Auditoria
import { 
  Car, Plus, Trash2, Gauge, 
  AlertTriangle, CheckCircle2, 
  Wrench, X, ArrowLeft, User,
  Edit3, Receipt, History, Coins, Search,
  Settings2
} from "lucide-react";
import { useRouter } from "next/navigation";

// --- TIPAGENS ---
interface Manutencao {
  id: string;
  descricao: string;
  valor: number;
  kmOcorrido: number;
  data: any;
}

interface Veiculo {
  id: string; 
  placaOriginal: string;
  modelo: string;
  motorista: string;
  kmInicial: number;
  kmAtual: number;
  kmProximaRevisao: number;
  status: 'operacional' | 'manutencao' | 'parado';
  dataCadastro: any;
  custoManutencaoAcumulado?: number;
}

export default function FrotaPage() {
  // ✅ Puxando Governança do Hook Profissional
  const { licenseId, role, userId, userName, loading: authLoading } = useLicense();
  const isGerente = role === 'gerente' || role === 'admin';

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [diarios, setDiarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState("");
  const router = useRouter();

  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<Veiculo | null>(null);
  const [historico, setHistorico] = useState<Manutencao[]>([]);

  // Estados dos Formulários
  const [veiculoEmEdicao, setVeiculoEmEdicao] = useState<Veiculo | null>(null);
  const [formData, setFormData] = useState({
    placa: "", modelo: "", motorista: "", kmInicial: "", kmProximaRevisao: ""
  });
  const [gastoForm, setGastoForm] = useState({ descricao: "", valor: "", km: "" });

  const normalizarPlaca = (placa: string) => {
    return placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  };

  useEffect(() => {
    if (!licenseId) return;

    const unsubFrota = onSnapshot(collection(db, `clientes/${licenseId}/frota`), (snap) => {
      setVeiculos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Veiculo)));
    });

    const unsubDiarios = onSnapshot(collection(db, `clientes/${licenseId}/diarios_de_campo`), (snap) => {
      setDiarios(snap.docs.map(doc => doc.data()));
      setLoading(false);
    });

    return () => { unsubFrota(); unsubDiarios(); };
  }, [licenseId]);

  useEffect(() => {
    if (!licenseId || !veiculoSelecionado) return;
    const q = query(
      collection(db, `clientes/${licenseId}/frota/${veiculoSelecionado.id}/manutencoes`),
      orderBy("data", "desc")
    );
    return onSnapshot(q, (snap) => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() } as Manutencao)));
    });
  }, [licenseId, veiculoSelecionado]);

  // --- LÓGICA DE FILTRAGEM E KPIs DINÂMICOS ---
  const dadosFiltrados = useMemo(() => {
    const processados = veiculos.map(v => {
      const registrosDoCarro = diarios.filter(d => normalizarPlaca(d.veiculoPlaca || d.veiculo_placa || "") === v.id);
      const maiorKmCampo = registrosDoCarro.reduce((max, d) => Math.max(max, Number(d.kmFinal || d.km_final || 0)), v.kmInicial);
      return {
        ...v,
        kmAtual: maiorKmCampo,
        precisaRevisao: maiorKmCampo >= (v.kmProximaRevisao - 500)
      };
    });

    const busca = termoBusca.toLowerCase().trim();
    const filtrados = processados.filter(v => 
      v.placaOriginal.toLowerCase().includes(busca) || 
      v.modelo.toLowerCase().includes(busca) || 
      v.motorista.toLowerCase().includes(busca)
    );

    return { 
      filtrados, 
      kpis: {
        custoTotal: filtrados.reduce((acc, v) => acc + (v.custoManutencaoAcumulado || 0), 0),
        kmTotal: filtrados.reduce((acc, v) => acc + (v.kmAtual - v.kmInicial), 0),
        alertaCount: filtrados.filter(v => v.precisaRevisao).length,
        frotaExibida: filtrados.length
      } 
    };
  }, [veiculos, diarios, termoBusca]);

  // --- AÇÕES PROFISSIONAIS ---
  const handleSalvarVeiculo = async () => {
    if (!isGerente) return;
    const placaLimpa = normalizarPlaca(formData.placa);
    if (!placaLimpa || !formData.modelo) return alert("Placa e Modelo são obrigatórios");
    
    const payload = {
      placaOriginal: formData.placa.toUpperCase(),
      modelo: formData.modelo,
      motorista: formData.motorista || "Não definido",
      kmInicial: Number(formData.kmInicial),
      kmProximaRevisao: Number(formData.kmProximaRevisao),
    };

    try {
      if (veiculoEmEdicao) {
        await updateDoc(doc(db, `clientes/${licenseId}/frota`, veiculoEmEdicao.id), payload);
        await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Editou parâmetros do veículo: ${payload.placaOriginal}`);
      } else {
        await setDoc(doc(db, `clientes/${licenseId}/frota`, placaLimpa), { 
          ...payload, 
          kmAtual: Number(formData.kmInicial), 
          status: 'operacional', 
          dataCadastro: serverTimestamp(), 
          custoManutencaoAcumulado: 0 
        });
        await registerLog(licenseId!, userId!, userName!, 'ALTERACAO_DADO_TECNICO', `Cadastrou novo veículo na frota: ${payload.placaOriginal}`);
      }
      setIsModalOpen(false);
    } catch (e) { alert("Erro ao processar dados do veículo."); }
  };

  const handleLancarManutencao = async () => {
    if (!isGerente || !veiculoSelecionado || !gastoForm.descricao || !gastoForm.valor) return;
    
    const valorNum = Number(gastoForm.valor);
    try {
      await addDoc(collection(db, `clientes/${licenseId}/frota/${veiculoSelecionado.id}/manutencoes`), {
        descricao: gastoForm.descricao,
        valor: valorNum,
        kmOcorrido: Number(gastoForm.km) || veiculoSelecionado.kmAtual,
        data: serverTimestamp()
      });

      await updateDoc(doc(db, `clientes/${licenseId}/frota`, veiculoSelecionado.id), {
        custoManutencaoAcumulado: (veiculoSelecionado.custoManutencaoAcumulado || 0) + valorNum
      });

      // ✅ Auditoria Financeira de Manutenção
      await registerLog(licenseId!, userId!, userName!, 'MANUTENCAO_VEICULO', `Lançou R$ ${valorNum} em manutenção para ${veiculoSelecionado.placaOriginal}: ${gastoForm.descricao}`);

      setGastoForm({ descricao: "", valor: "", km: "" });
    } catch (e) { alert("Erro ao registrar manutenção."); }
  };

  if (authLoading || loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando Ativos Logísticos...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans">
      
      <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-2">
            <ArrowLeft size={14} /> Voltar
          </button>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Gestão de Ativos</h1>
          <p className="text-slate-500 font-medium italic mt-2">Monitoramento de Logística: {userName} ({role})</p>
        </div>
        {isGerente && (
          <button onClick={() => { setVeiculoEmEdicao(null); setFormData({placa:"", modelo:"", motorista:"", kmInicial:"", kmProximaRevisao:""}); setIsModalOpen(true); }} className="bg-slate-900 text-emerald-400 px-8 py-4 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-2xl flex items-center gap-2">
            <Plus size={18} /> Novo Ativo
          </button>
        )}
      </header>

      {/* BARRA DE PESQUISA */}
      <div className="relative mb-8">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Localizar por Placa, Modelo ou Motorista..." 
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          className="w-full pl-16 pr-8 py-6 rounded-[32px] bg-white border border-slate-200 shadow-sm focus:border-emerald-500 outline-none font-medium text-slate-700 transition-all"
        />
        {termoBusca && (
          <button onClick={() => setTermoBusca("")} className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-red-500">
            <X size={16}/>
          </button>
        )}
      </div>

      {/* KPIs DINÂMICOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl flex flex-col justify-between overflow-hidden relative">
            <Coins className="absolute -right-4 -bottom-4 text-emerald-500/10" size={120} />
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Total Oficina (Seleção)</p>
            <h2 className="text-3xl font-black">R$ {dadosFiltrados.kpis.custoTotal.toLocaleString('pt-BR')}</h2>
            <p className="text-[8px] text-slate-500 font-bold uppercase mt-2">Investimento em manutenção preventiva</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <Gauge className="text-blue-500 mb-4" size={28}/>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">KM Rodados Acumulados</p>
                <h2 className="text-3xl font-black text-slate-900">{dadosFiltrados.kpis.kmTotal.toLocaleString()} <span className="text-xs">km</span></h2>
            </div>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between">
            <AlertTriangle className="text-red-500 mb-4" size={28}/>
            <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Alertas de Revisão</p>
                <h2 className="text-3xl font-black text-red-600">{dadosFiltrados.kpis.alertaCount}</h2>
            </div>
        </div>
      </div>

      {/* GRID DE VEÍCULOS FILTRADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {dadosFiltrados.filtrados.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
             Nenhum ativo encontrado para "{termoBusca}"
          </div>
        )}
        {dadosFiltrados.filtrados.map((v) => (
          <div key={v.id} className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">
            {v.precisaRevisao && <div className="absolute top-0 right-0 bg-red-500 text-white px-6 py-2 rounded-bl-3xl text-[9px] font-black uppercase animate-pulse">Revisão Necessária</div>}
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{v.placaOriginal}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{v.modelo}</p>
              </div>
              {isGerente && (
                <button 
                  onClick={() => { setVeiculoEmEdicao(v); setFormData({placa: v.placaOriginal, modelo: v.modelo, motorista: v.motorista, kmInicial: v.kmInicial.toString(), kmProximaRevisao: v.kmProximaRevisao.toString()}); setIsModalOpen(true); }}
                  className="bg-slate-50 p-3 rounded-2xl text-slate-300 hover:text-emerald-600 transition-all"
                >
                  <Settings2 size={18} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mb-6 bg-slate-50 p-4 rounded-3xl">
                <div className="flex items-center gap-2">
                    <User size={16} className="text-emerald-600" />
                    <span className="text-[10px] font-black text-slate-700 uppercase">{v.motorista}</span>
                </div>
                <div className="flex flex-col text-right text-slate-900">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Gasto Oficina</span>
                    <span className="text-xs font-black">R$ {(v.custoManutencaoAcumulado || 0).toLocaleString('pt-BR')}</span>
                </div>
            </div>

            <div className="space-y-3 mb-8">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-900">
                    <span className="text-slate-400">KM Atual: {v.kmAtual.toLocaleString()}</span>
                    <span className="text-red-500">Alvo: {v.kmProximaRevisao.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ${v.precisaRevisao ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min((v.kmAtual / v.kmProximaRevisao) * 100, 100)}%` }}
                    ></div>
                </div>
            </div>

            <button 
                onClick={() => { setVeiculoSelecionado(v); setIsHistoryOpen(true); }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <History size={16} className="text-emerald-400" /> Detalhes & Manutenções
            </button>
          </div>
        ))}
      </div>

      {/* PAINEL LATERAL DE HISTÓRICO */}
      {isHistoryOpen && veiculoSelecionado && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-10 bg-slate-50 border-b flex justify-between items-center text-slate-900">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter">{veiculoSelecionado.placaOriginal}</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Oficina e Atividades Logísticas</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="bg-white p-4 rounded-full shadow-lg hover:text-red-500 transition-all"><X /></button>
            </div>

            {isGerente && (
              <div className="p-10 border-b bg-emerald-50/30 space-y-4 text-slate-900">
                <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2"><Receipt size={14}/> Registrar Pagamento em Oficina</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input placeholder="Descrição" className="p-4 rounded-2xl bg-white border-none text-xs font-bold outline-none" value={gastoForm.descricao} onChange={e => setGastoForm({...gastoForm, descricao: e.target.value})} />
                    <input type="number" placeholder="Valor R$" className="p-4 rounded-2xl bg-white border-none text-xs font-bold outline-none" value={gastoForm.valor} onChange={e => setGastoForm({...gastoForm, valor: e.target.value})} />
                    <input type="number" placeholder="KM Ocorrido" className="p-4 rounded-2xl bg-white border-none text-xs font-bold outline-none" value={gastoForm.km} onChange={e => setGastoForm({...gastoForm, km: e.target.value})} />
                </div>
                <button onClick={handleLancarManutencao} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">Confirmar Lançamento</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-10 space-y-4 custom-scrollbar text-slate-900">
                {historico.map(h => (
                  <div key={h.id} className="flex justify-between items-center p-6 bg-slate-50 rounded-[32px] group border border-transparent hover:border-emerald-200 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-2xl shadow-sm text-slate-400 group-hover:text-emerald-500"><Wrench size={20}/></div>
                        <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{h.descricao}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{h.kmOcorrido.toLocaleString()} KM • {new Date(h.data?.seconds * 1000).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-lg font-black text-slate-900">R$ {h.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        {isGerente && (
                          <button onClick={async () => {
                              if(confirm("Remover este lançamento financeiro?")) {
                                  await deleteDoc(doc(db, `clientes/${licenseId}/frota/${veiculoSelecionado.id}/manutencoes`, h.id));
                                  await updateDoc(doc(db, `clientes/${licenseId}/frota`, veiculoSelecionado.id), { custoManutencaoAcumulado: (veiculoSelecionado.custoManutencaoAcumulado || 0) - h.valor });
                                  await registerLog(licenseId!, userId!, userName!, 'EXCLUSAO_PROJETO', `Estornou manutenção de R$ ${h.valor} do veículo ${veiculoSelecionado.placaOriginal}`);
                              }
                          }} className="text-red-300 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                        )}
                    </div>
                  </div>
                ))}
            </div>
            
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <p className="text-xs font-black uppercase text-slate-500">Investimento Total no Ativo</p>
                <h3 className="text-3xl font-black text-emerald-400">R$ {veiculoSelecionado.custoManutencaoAcumulado?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO / EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-md overflow-hidden border border-emerald-500/20 text-slate-900">
            <div className="p-10 bg-slate-50 border-b flex justify-between items-center">
              <h2 className="text-3xl font-black uppercase tracking-tighter">{veiculoEmEdicao ? "Atualizar Ativo" : "Novo Ativo Logístico"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:text-red-500 transition-all"><X /></button>
            </div>
            <div className="p-10 space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Placa de Identificação</label>
                <input placeholder="ABC 0000" disabled={!!veiculoEmEdicao} className="w-full p-4 rounded-2xl bg-slate-50 font-black text-xl uppercase disabled:opacity-50 outline-none" value={formData.placa} onChange={e => setFormData({...formData, placa: e.target.value})} />
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Modelo do Veículo</label>
                <input placeholder="Ex: Triton 4x4" className="w-full p-4 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} />
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Motorista Responsável</label>
                <input placeholder="Nome completo" className="w-full p-4 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.motorista} onChange={e => setFormData({...formData, motorista: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2">KM Inicial</label><input type="number" className="w-full p-4 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.kmInicial} onChange={e => setFormData({...formData, kmInicial: e.target.value})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 text-red-500">Meta de Revisão</label><input type="number" className="w-full p-4 rounded-2xl bg-slate-900 text-red-400 font-bold outline-none shadow-lg" value={formData.kmProximaRevisao} onChange={e => setFormData({...formData, kmProximaRevisao: e.target.value})} /></div>
                </div>
                <button onClick={handleSalvarVeiculo} className="w-full bg-emerald-500 text-slate-900 py-6 rounded-[28px] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-400 transition-all mt-4">Confirmar Dados</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}