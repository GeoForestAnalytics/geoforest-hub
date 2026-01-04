"use client"
import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { db } from "../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useLicense } from "../hooks/useAuthContext";
import { 
  ArrowLeft, Trees, ChevronRight, ShieldCheck, CircleDollarSign 
} from "lucide-react";
import { useRouter } from "next/navigation";

// --- COMPONENTE DO MAPA (ISOLADO PARA CLIENT-SIDE) ---
// Criamos este componente aqui mesmo para usar os hooks do Leaflet sem erro de SSR
const MapContent = ({ geoData, zoom, setZoom, mapType, setSelectedInfo }: any) => {
  // Importamos os hooks apenas quando o componente for montado no navegador
  const { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } = require('react-leaflet');

  // Componente interno para escutar eventos do mapa
  const Events = () => {
    useMapEvents({
      zoomend: (e: any) => setZoom(e.target.getZoom()),
    });
    return null;
  };

  return (
    <MapContainer 
      center={[geoData[0]?.lat || -23.5, geoData[0]?.lng || -46.6]} 
      zoom={zoom} 
      className="w-full h-full"
    >
      <Events />
      <TileLayer
        key={mapType}
        url={mapType === "satellite" 
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />

      {geoData.map((faz: any, i: number) => (
        <div key={`${faz.id}-${i}`}>
          {/* EFEITO 1: Balão de Resumo (Zoom Out < 14) */}
          {zoom < 14 && (
            <CircleMarker 
              center={[faz.lat, faz.lng]} 
              radius={2} 
              pathOptions={{ opacity: 0, fillOpacity: 0 }}
            >
              <Tooltip permanent direction="center" className="custom-map-label">
                <div className="bg-white text-slate-900 p-3 rounded-2xl shadow-2xl border-2 border-emerald-500 flex flex-col items-center min-w-[120px]">
                  <span className="text-[10px] font-black uppercase leading-tight">{faz.nome}</span>
                  <span className="text-sm font-black text-emerald-600">{faz.concluidas} / {faz.total}</span>
                </div>
              </Tooltip>
            </CircleMarker>
          )}

          {/* EFEITO 2: Detalhes Individuais (Zoom In >= 14) */}
          {zoom >= 14 && faz.amostras.map((amo: any) => (
            <CircleMarker 
              key={amo.id}
              center={[amo.latitude, amo.longitude]}
              radius={8}
              eventHandlers={{ click: () => setSelectedInfo(amo) }}
              pathOptions={{
                fillColor: ["concluida", "exportada"].includes(String(amo.status).toLowerCase()) ? '#10b981' : '#f59e0b',
                color: 'white', weight: 2, fillOpacity: 1
              }}
            />
          ))}
        </div>
      ))}
    </MapContainer>
  );
};

// Carregamos o MapContent dinamicamente desativando o SSR (Server Side Rendering)
const MapSSRFree = dynamic(() => Promise.resolve(MapContent), { ssr: false });

// --- PÁGINA PRINCIPAL ---
export default function MapaProjetosPage() {
  const { licenseId, userName, loading: authLoading } = useLicense();
  const router = useRouter();

  const [zoom, setZoom] = useState(10);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [amostras, setAmostras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<"streets" | "satellite">("satellite");
  const [selectedInfo, setSelectedInfo] = useState<any>(null);

  useEffect(() => {
    if (!licenseId) return;
    const unsub = [
      onSnapshot(collection(db, `clientes/${licenseId}/fazendas`), (s) => setFazendas(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, `clientes/${licenseId}/talhoes`), (s) => setTalhoes(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, `clientes/${licenseId}/dados_coleta`), (s) => {
          setAmostras(s.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
      })
    ];
    return () => unsub.forEach(u => u());
  }, [licenseId]);

  const geoData = useMemo(() => {
    return fazendas.map(faz => {
        const amostrasFaz = amostras.filter(a => a.idFazenda === faz.id);
        const concluidas = amostrasFaz.filter(a => ["concluida", "exportada"].includes(String(a.status).toLowerCase())).length;
        const coords = amostrasFaz.find(a => a.latitude && a.longitude);
        
        return {
            ...faz,
            concluidas,
            total: amostrasFaz.length,
            lat: coords?.latitude || -23.5,
            lng: coords?.longitude || -46.6,
            amostras: amostrasFaz
        };
    }).filter(f => f.total > 0);
  }, [fazendas, amostras]);

  if (authLoading || loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando SIG...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 font-sans text-white overflow-hidden">
      
      {/* HEADER PREMIUM */}
      <header className="p-6 flex justify-between items-center bg-slate-900 border-b border-white/5 z-10">
        <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-3 bg-white/5 rounded-2xl hover:bg-emerald-500/20 transition-all text-emerald-400">
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-emerald-400">SIG Florestal Ativo</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-500"/> Auditoria Geográfica v1.0
                </p>
            </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
            <button onClick={() => setMapType("streets")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mapType === "streets" ? "bg-emerald-500 text-slate-900" : "text-slate-400"}`}>Ruas</button>
            <button onClick={() => setMapType("satellite")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${mapType === "satellite" ? "bg-emerald-500 text-slate-900" : "text-slate-400"}`}>Satélite</button>
        </div>
      </header>

      <main className="flex-1 relative">
        {/* Chamada para o mapa sem SSR */}
        <MapSSRFree 
          geoData={geoData} 
          zoom={zoom} 
          setZoom={setZoom} 
          mapType={mapType} 
          setSelectedInfo={setSelectedInfo} 
        />

        {/* EFEITO 3: Barra de Status Inferior (Redirecionamento Corrigido) */}
{selectedInfo && (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 p-6 rounded-[32px] shadow-2xl z-[1000] animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 rounded-xl text-slate-900"><Trees size={20}/></div>
                <div>
                    <h4 className="font-black text-white uppercase text-sm">Amostra: {selectedInfo.idParcela}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {selectedInfo.nomeFazenda} • Talhão: {selectedInfo.nomeTalhao}
                    </p>
                </div>
            </div>
            <button onClick={() => setSelectedInfo(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-500">
                <XIcon size={20}/>
            </button>
        </div>
        
        <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
            <div>
                <p className="text-[8px] font-black text-slate-500 uppercase">Status Técnica</p>
                <p className={`text-xs font-black uppercase ${["concluida", "exportada"].includes(String(selectedInfo.status).toLowerCase()) ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedInfo.status}
                </p>
            </div>
            <div>
                <p className="text-[8px] font-black text-slate-500 uppercase">Responsável</p>
                <p className="text-xs font-black text-white uppercase">{selectedInfo.nomeLider || 'Equipe'}</p>
            </div>

            {/* ✅ BOTÃO CORRIGIDO: Agora vai direto para a Auditoria do Talhão */}
            <button 
                onClick={() => {
                    // Se tivermos os dados de projeto e talhão, vamos para a página técnica
                    if (selectedInfo.projetoId && selectedInfo.talhaoId) {
                        router.push(`/projetos/${selectedInfo.projetoId}/talhao/${selectedInfo.talhaoId}`);
                    } else {
                        // Fallback caso algum ID falhe
                        router.push(`/projetos`);
                    }
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1 transition-all shadow-lg active:scale-95"
            >
                Auditar Amostras <ChevronRight size={14}/>
            </button>
        </div>
    </div>
)}
      </main>
    </div>
  );
}

const XIcon = ({ size, className }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);