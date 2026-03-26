import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Plus, RefreshCw, CheckCircle2, Clock, Navigation, XCircle, ChevronDown, ChevronUp, Phone, MapPin, Route, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Entrega {
  id: number;
  orcamentoId?: number | null;
  cliente: string;
  whatsapp?: string | null;
  endereco?: string | null;
  produtos?: string | null;
  status: string;
  vendedor?: string | null;
  observacoes?: string | null;
  dataEntrega?: string | null;
  criadoEm?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente:   { label: "Pendente",  color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  em_rota:    { label: "Em Rota",   color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Navigation },
  entregue:   { label: "Entregue",  color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelado:  { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200",           icon: XCircle },
};

function formatarData(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatarNumero(whatsapp?: string | null) {
  if (!whatsapp) return null;
  const d = whatsapp.replace(/\D/g, "");
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function EntregaCard({ entrega, onStatusChange }: { entrega: Entrega; onStatusChange: (id: number, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[entrega.status] ?? STATUS_CONFIG.pendente;
  const Icon = cfg.icon;

  const proximoStatus: Record<string, string> = {
    pendente: "em_rota",
    em_rota: "entregue",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">{entrega.cliente}</span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1", cfg.color)}>
                <Icon className="w-3 h-3" />{cfg.label}
              </span>
            </div>
            {entrega.whatsapp && (
              <a
                href={`https://wa.me/55${entrega.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1 hover:underline"
              >
                <Phone className="w-3 h-3" />{formatarNumero(entrega.whatsapp)}
              </a>
            )}
            {entrega.endereco && (
              <p className="text-xs text-slate-500 mt-1 truncate">{entrega.endereco}</p>
            )}
            {entrega.dataEntrega && (
              <p className="text-xs text-slate-400 mt-0.5">📅 {entrega.dataEntrega}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            {proximoStatus[entrega.status] && (
              <button
                onClick={() => onStatusChange(entrega.id, proximoStatus[entrega.status])}
                className="text-xs font-bold px-3 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-all"
              >
                {entrega.status === "pendente" ? "Saiu para entrega" : "Marcar entregue"}
              </button>
            )}
            {entrega.status === "pendente" && (
              <button
                onClick={() => onStatusChange(entrega.id, "cancelado")}
                className="text-xs font-bold px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-slate-400 mt-2 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Menos" : "Mais detalhes"}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-1"
            >
              {entrega.produtos && <p className="text-xs text-slate-600"><span className="font-semibold">Produtos:</span> {entrega.produtos}</p>}
              {entrega.vendedor && <p className="text-xs text-slate-600"><span className="font-semibold">Vendedor:</span> {entrega.vendedor}</p>}
              {entrega.observacoes && <p className="text-xs text-slate-600"><span className="font-semibold">Obs:</span> {entrega.observacoes}</p>}
              <p className="text-xs text-slate-400">Criado: {formatarData(entrega.criadoEm)}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function NovaEntregaModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<Entrega>) => void }) {
  const [form, setForm] = useState({ cliente: "", whatsapp: "", endereco: "", produtos: "", vendedor: "", observacoes: "", dataEntrega: "" });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-extrabold text-slate-900">Nova Entrega</h2>

        {[
          { field: "cliente", label: "Cliente *", placeholder: "Nome do cliente" },
          { field: "whatsapp", label: "WhatsApp", placeholder: "(22) 99999-9999" },
          { field: "endereco", label: "Endereço", placeholder: "Rua, número, bairro" },
          { field: "produtos", label: "Produtos", placeholder: "Ex: Cama Box Casal, Colchão..." },
          { field: "vendedor", label: "Vendedor", placeholder: "Nome do vendedor" },
          { field: "dataEntrega", label: "Data de entrega", placeholder: "Ex: 20/03 manhã" },
        ].map(({ field, label, placeholder }) => (
          <div key={field}>
            <label className="text-xs font-bold text-slate-600 mb-1 block">{label}</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={placeholder}
              value={(form as any)[field]}
              onChange={set(field)}
            />
          </div>
        ))}

        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">Observações</label>
          <textarea
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            rows={2}
            placeholder="Observações adicionais..."
            value={form.observacoes}
            onChange={set("observacoes")}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => form.cliente.trim() && onSave(form)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
            disabled={!form.cliente.trim()}
          >
            Salvar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Cidades cobertas e ordem de rota ──────────────────────────────────────
const ORDEM_CIDADES: { nome: string; keywords: string[] }[] = [
  { nome: "Cabo Frio",         keywords: ["cabo frio", "flamboyant", "passagem", "braga", "palmeiras", "peró"] },
  { nome: "Arraial do Cabo",   keywords: ["arraial do cabo", "arraial"] },
  { nome: "São Pedro da Aldeia", keywords: ["são pedro", "sao pedro", "aldeia"] },
  { nome: "Iguaba Grande",     keywords: ["iguaba"] },
  { nome: "Araruama",          keywords: ["araruama"] },
  { nome: "Búzios",            keywords: ["búzios", "buzios", "armação"] },
  { nome: "Saquarema",         keywords: ["saquarema"] },
];

function detectarCidade(endereco: string): string {
  const lower = endereco.toLowerCase();
  for (const c of ORDEM_CIDADES) {
    if (c.keywords.some(k => lower.includes(k))) return c.nome;
  }
  return "Outras";
}

function ordenarPorRota(entregas: Entrega[]): Entrega[] {
  return [...entregas].sort((a, b) => {
    const cidadeA = detectarCidade(a.endereco || "");
    const cidadeB = detectarCidade(b.endereco || "");
    const idxA = ORDEM_CIDADES.findIndex(c => c.nome === cidadeA);
    const idxB = ORDEM_CIDADES.findIndex(c => c.nome === cidadeB);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });
}

const ORIGEM_CABO_FRIO = "Av. Júlia Kubitschek, 64, Cabo Frio, RJ";
const ORIGEM_ARARUAMA  = "Av. dos Cearenses, Araruama, RJ";

function gerarUrlMaps(paradas: Entrega[], operacao: string = "cabo_frio"): string {
  const origemStr = operacao === "araruama" ? ORIGEM_ARARUAMA : ORIGEM_CABO_FRIO;
  const ORIGEM = encodeURIComponent(origemStr);
  const stops = paradas
    .filter(e => e.endereco?.trim())
    .map(e => encodeURIComponent(`${e.endereco}, ${detectarCidade(e.endereco || "")}, RJ`));
  if (!stops.length) return `https://www.google.com/maps/search/?api=1&query=${ORIGEM}`;
  const destino = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).join("/");
  const base = `https://www.google.com/maps/dir/${ORIGEM}/${waypoints ? waypoints + "/" : ""}${destino}`;
  return base;
}

function RoteiroPedro({ entregas }: { entregas: Entrega[] }) {
  const { colaborador } = useAuth();
  const operacao = colaborador?.operacao ?? "cabo_frio";
  const ativas = entregas.filter(e => e.status === "pendente" || e.status === "em_rota");
  const ordenadas = ordenarPorRota(ativas);
  const mapsUrl = gerarUrlMaps(ordenadas, operacao);

  const porCidade = ORDEM_CIDADES.map(c => ({
    ...c,
    paradas: ordenadas.filter(e => detectarCidade(e.endereco || "") === c.nome),
  })).filter(c => c.paradas.length > 0);

  const semEndereco = ativas.filter(e => !e.endereco?.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-red-700 to-red-900 rounded-2xl p-5 text-white shadow-xl shadow-red-900/30 mb-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg leading-tight">Roteiro de Hoje</h2>
            <p className="text-red-200 text-xs">
              {ordenadas.length} parada{ordenadas.length !== 1 ? "s" : ""} · otimizado por região
            </p>
          </div>
        </div>
        {ordenadas.length > 0 && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 bg-white text-red-700 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg hover:bg-red-50 transition-all active:scale-95 shrink-0"
          >
            <Navigation className="w-4 h-4" />
            Iniciar Rota
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}
      </div>

      {ordenadas.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="font-bold text-green-200">Nada pendente!</p>
          <p className="text-red-200 text-xs mt-1">Todas as entregas foram concluídas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Paradas ordenadas por cidade */}
          {porCidade.map((grupo, gi) => (
            <div key={grupo.nome}>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-red-300 shrink-0" />
                <span className="text-red-200 text-xs font-bold uppercase tracking-wider">{grupo.nome}</span>
                <span className="text-red-300/60 text-xs">({grupo.paradas.length})</span>
              </div>
              <div className="space-y-2">
                {grupo.paradas.map((e, pi) => {
                  const numGlobal = ordenadas.indexOf(e) + 1;
                  return (
                    <div key={e.id}
                      className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 flex items-start gap-3">
                      <span className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">
                        {numGlobal}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-sm leading-tight truncate">{e.cliente}</p>
                        {e.endereco && (
                          <p className="text-red-200 text-xs mt-0.5 leading-snug">{e.endereco}</p>
                        )}
                        {e.produtos && (
                          <p className="text-red-300/70 text-xs mt-0.5 truncate">{e.produtos}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        {e.whatsapp && (
                          <a
                            href={`https://wa.me/55${e.whatsapp.replace(/\D/g, "")}?text=Olá ${e.cliente}! Sou o Pedro, entregador da Castor Cabo Frio. Estou a caminho para entregar o seu pedido!`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 bg-green-500 hover:bg-green-400 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <Phone className="w-3 h-3" /> WA
                          </a>
                        )}
                        {e.endereco && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.endereco + ", " + grupo.nome + ", RJ")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <MapPin className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Sem endereço */}
          {semEndereco.length > 0 && (
            <div>
              <p className="text-red-300 text-xs font-bold uppercase tracking-wider mb-2">⚠️ Sem endereço cadastrado</p>
              {semEndereco.map(e => (
                <div key={e.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm">{e.cliente}</p>
                    <p className="text-red-300 text-xs">Confirmar endereço antes de sair</p>
                  </div>
                  {e.whatsapp && (
                    <a href={`https://wa.me/55${e.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      className="bg-green-500 hover:bg-green-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      <Phone className="w-3 h-3 inline mr-1" /> Ligar
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legenda de rota */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-red-300/70 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Ordem da rota saindo da loja:</p>
            <div className="flex flex-wrap gap-1.5">
              {ORDEM_CIDADES.map((c, i) => (
                <span key={c.nome} className="flex items-center gap-1 text-[10px] text-red-200/60">
                  <span className="font-bold">{i + 1}.</span> {c.nome}
                  {i < ORDEM_CIDADES.length - 1 && <span className="text-red-400/30">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function Logistica() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const { data: entregas = [], isLoading, refetch } = useQuery<Entrega[]>({
    queryKey: ["entregas"],
    queryFn: async () => {
      const res = await fetch("/api/entregas");
      if (!res.ok) throw new Error("Erro ao carregar entregas");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/entregas/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      toast({ title: "Status atualizado!" });
    },
    onError: () => toast({ title: "Erro", variant: "destructive" }),
  });

  const criarEntrega = useMutation({
    mutationFn: async (data: Partial<Entrega>) => {
      const res = await fetch("/api/entregas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar entrega");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      setShowModal(false);
      toast({ title: "Entrega registrada!" });
    },
    onError: () => toast({ title: "Erro ao salvar entrega", variant: "destructive" }),
  });

  const entregasFiltradas = filtroStatus === "todos"
    ? entregas
    : entregas.filter(e => e.status === filtroStatus);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">

      {/* Roteiro otimizado do Pedro — visível para todos, mas protagonista para ENTREGA */}
      <RoteiroPedro entregas={entregas} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Logística
          </h1>
          <p className="text-slate-500 mt-2 text-sm">Controle de entregas e rotas.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:opacity-90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Entrega
          </button>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "todos", label: "Todas" },
          { key: "pendente", label: "Pendentes" },
          { key: "em_rota", label: "Em Rota" },
          { key: "entregue", label: "Entregues" },
          { key: "cancelado", label: "Canceladas" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltroStatus(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
              filtroStatus === f.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {f.label}
            {f.key !== "todos" && (
              <span className="ml-1 opacity-70">
                ({entregas.filter(e => e.status === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando entregas...</span>
        </div>
      ) : entregasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-2">
            <Truck className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Nenhuma entrega aqui</p>
          <p className="text-sm">Clique em "Nova Entrega" para registrar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">{entregasFiltradas.length} entrega{entregasFiltradas.length !== 1 ? "s" : ""}</p>
          {entregasFiltradas.map(e => (
            <EntregaCard
              key={e.id}
              entrega={e}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <NovaEntregaModal
            onClose={() => setShowModal(false)}
            onSave={(data) => criarEntrega.mutate(data)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
