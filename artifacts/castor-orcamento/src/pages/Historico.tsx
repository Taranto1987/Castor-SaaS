import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ChevronDown, ChevronUp, Copy, CheckCircle2, Phone, Package,
  RefreshCw, FileText, ShoppingBag, MapPin, X, AlertCircle, MessageCircle,
  Radar, Target, Bell, Layers
} from "lucide-react";
import type { HistoricoItem } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

function formatarData(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function formatarNumero(whatsapp?: string) {
  if (!whatsapp) return null;
  const digitos = whatsapp.replace(/\D/g, "");
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function diasDesde(iso?: string): number {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function gerarMensagemFollowUp(item: HistoricoItem): string {
  const produtos = Array.isArray(item.produtosJson) ? item.produtosJson as any[] : [];
  const nomeProdutos = produtos.map((p: any) => p.nome).filter(Boolean).slice(0, 2).join(" e ");
  const valor = item.totalPix ? ` — valor PIX: *${item.totalPix}*` : "";
  const vendedor = item.vendedor ? `\n\nAtenciosamente,\n${item.vendedor} — Castor` : "\n\nAtenciosamente,\nEquipe Castor";
  return `Olá, *${item.cliente}*! 😊\n\nAqui é da *Castor Cabo Frio*. Vi que preparamos um orçamento para você${nomeProdutos ? ` com *${nomeProdutos}*` : ""}${valor} e gostaríamos de saber se surgiu alguma dúvida ou se posso ajudar em algo.\n\nEstou à disposição! 🛏️✨${vendedor}`;
}

function FecharVendaModal({
  item,
  onClose,
  onConfirm,
}: {
  item: HistoricoItem;
  onClose: () => void;
  onConfirm: (endereco: string, observacoes: string, dataEntrega: string) => void;
}) {
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Fechar Venda</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Cliente: <span className="font-bold text-slate-700">{item.cliente}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Endereço de entrega
            </label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Rua, número, bairro, cidade"
              value={endereco}
              onChange={e => setEndereco(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Data de entrega (opcional)</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ex: 27/03 manhã"
              value={dataEntrega}
              onChange={e => setDataEntrega(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Observações (opcional)</label>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              rows={2}
              placeholder="Ex: ligar antes, portão azul..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(endereco, observacoes, dataEntrega)}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            Confirmar venda
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ItemCard({ item }: { item: HistoricoItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFechar, setShowFechar] = useState(false);
  const [fechando, setFechando] = useState(false);

  const produtos = Array.isArray(item.produtosJson) ? item.produtosJson as any[] : [];
  const vendido = item.status === "vendido";
  const dias = diasDesde(item.criadoEm);
  const atrasado = !vendido && dias >= 2;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.texto);
      setCopied(true);
      toast({ title: "Copiado!", description: "Texto do orçamento copiado." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  const handleWhatsApp = () => {
    const numero = (item.whatsapp || "").replace(/\D/g, "");
    const texto = encodeURIComponent(item.texto);
    const url = numero ? `https://wa.me/55${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank");
  };

  const handleFollowUp = () => {
    const numero = (item.whatsapp || "").replace(/\D/g, "");
    const msg = encodeURIComponent(gerarMensagemFollowUp(item));
    const url = numero ? `https://wa.me/55${numero}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  };

  const handleFecharVenda = async (endereco: string, observacoes: string, dataEntrega: string) => {
    setFechando(true);
    try {
      const res = await fetch(`/api/orcamento/${item.id}/fechar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": user?.sessionToken || "" },
        body: JSON.stringify({ endereco, observacoes, dataEntrega }),
      });
      if (!res.ok) throw new Error("Erro");
      toast({ title: "Venda fechada!", description: "Entrega criada no roteiro automaticamente." });
      setShowFechar(false);
      queryClient.invalidateQueries({ queryKey: ["historico-orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
    } catch {
      toast({ title: "Erro", description: "Não foi possível fechar a venda.", variant: "destructive" });
    } finally {
      setFechando(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "bg-white border rounded-2xl overflow-hidden shadow-sm",
          vendido ? "border-emerald-200 bg-emerald-50/30" : atrasado ? "border-amber-200" : "border-slate-200"
        )}
      >
        <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">{item.cliente}</span>
              {vendido && (
                <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3" /> Vendido
                </span>
              )}
              {atrasado && (
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap">
                  <AlertCircle className="w-3 h-3" />
                  {dias === 1 ? "1 dia" : `${dias} dias`} em aberto
                </span>
              )}
              {item.whatsapp && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1 whitespace-nowrap">
                  <Phone className="w-3 h-3" />{formatarNumero(item.whatsapp)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{formatarData(item.criadoEm)}
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />{produtos.length} {produtos.length === 1 ? "produto" : "produtos"}
              </span>
              {item.totalPix && <span className="text-emerald-600 font-bold">PIX {item.totalPix}</span>}
              {item.totalPrazo && <span className="text-blue-600 font-bold">Prazo {item.totalPrazo}</span>}
              {item.descontoPix && item.descontoPix > 0 ? (
                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold">-{item.descontoPix}% PIX</span>
              ) : null}
            </div>
            {produtos.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {produtos.slice(0, 3).map((p: any, i: number) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p.nome}</span>
                ))}
                {produtos.length > 3 && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">+{produtos.length - 3}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:flex-shrink-0 sm:justify-end">
            {!vendido && (
              <button
                onClick={() => setShowFechar(true)}
                disabled={fechando}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 w-full sm:w-auto"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Fechar venda
              </button>
            )}
            {!vendido && item.whatsapp && (
              <button
                onClick={handleFollowUp}
                title="Enviar follow-up no WhatsApp"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center sm:flex-none",
                  atrasado
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                )}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {atrasado ? "Cobrar" : "Follow-up"}
              </button>
            )}
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-600 text-white transition-all flex-1 justify-center sm:flex-none"
            >
              <Phone className="w-3.5 h-3.5" />
              WA
            </button>
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center sm:flex-none",
                copied ? "bg-green-100 text-green-700" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-500 shrink-0"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Alert de follow-up */}
        {atrasado && item.whatsapp && !vendido && (
          <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 font-semibold flex-1">
              {dias >= 7 ? "Urgente:" : "Sugestão:"} fazer follow-up — {dias} dia{dias !== 1 ? "s" : ""} sem resposta
            </p>
            <button
              onClick={handleFollowUp}
              className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-all"
            >
              Cobrar agora
            </button>
          </div>
        )}

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Texto do Orçamento</p>
                <div className="whatsapp-bubble p-4 text-[13px] whitespace-pre-wrap leading-relaxed">
                  {item.texto}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showFechar && (
          <FecharVendaModal
            item={item}
            onClose={() => setShowFechar(false)}
            onConfirm={handleFecharVenda}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Pipeline de Oportunidades (COCA) ──────────────────────────────────────────

interface PipelineOpportunity {
  id: number;
  orcamentoId: number;
  customerId: number | null;
  cliente: string;
  whatsapp: string | null;
  status: string;
  score: number;
  closingProbability: number;
  valorNumerico: number;
  valorBrl: string | null;
  diasSemResposta: number;
  proximaAcao: string | null;
  responsavel: string | null;
  criadoEm: string | null;
  followupsTotal: number;
  followupsPendentes: number;
}

interface PipelineData {
  statusOrder: string[];
  statusCounts: Record<string, number>;
  opportunities: PipelineOpportunity[];
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  CRITICO:             { label: "Crítico",             cls: "bg-red-100 text-red-700 border-red-200" },
  INTERVENCAO_HUMANA:  { label: "Intervenção Humana",  cls: "bg-red-100 text-red-700 border-red-200" },
  QUENTE:              { label: "Quente",              cls: "bg-orange-100 text-orange-700 border-orange-200" },
  NEGOCIANDO:          { label: "Negociando",          cls: "bg-amber-100 text-amber-700 border-amber-200" },
  AGUARDANDO_RESPOSTA: { label: "Aguardando Resposta", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  ORCAMENTO_ENVIADO:   { label: "Orçamento Enviado",   cls: "bg-slate-100 text-slate-700 border-slate-200" },
  NOVO:                { label: "Novo",                cls: "bg-slate-100 text-slate-600 border-slate-200" },
  REATIVACAO:          { label: "Reativação",          cls: "bg-violet-100 text-violet-700 border-violet-200" },
  GANHO:               { label: "Ganho",               cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  PERDIDO:             { label: "Perdido",             cls: "bg-slate-100 text-slate-400 border-slate-200" },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

function scoreBadge(score: number) {
  if (score >= 90) return "bg-red-600 text-white";
  if (score >= 70) return "bg-orange-500 text-white";
  if (score >= 40) return "bg-amber-400 text-amber-950";
  return "bg-slate-200 text-slate-600";
}

function OpportunityCard({ o }: { o: PipelineOpportunity }) {
  const digits = (o.whatsapp ?? "").replace(/\D/g, "");
  const waHref = digits ? `https://wa.me/55${digits}` : undefined;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start gap-3">
      <span className={cn("shrink-0 grid place-items-center w-11 h-11 rounded-xl font-extrabold", scoreBadge(o.score))}>
        {o.score}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-900 truncate">{o.cliente}</span>
          <span className="text-xs text-slate-400">#{o.orcamentoId}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
          {o.valorBrl && <span className="font-bold text-emerald-600">{o.valorBrl}</span>}
          <span className="flex items-center gap-1"><Target className="w-3 h-3" />{o.closingProbability}% fechamento</span>
          {o.diasSemResposta > 0 && <span>{o.diasSemResposta}d sem resposta</span>}
          {o.followupsTotal > 0 && (
            <span className="flex items-center gap-1">
              <Bell className="w-3 h-3" />{o.followupsPendentes}/{o.followupsTotal} follow-ups
            </span>
          )}
        </div>
        {o.proximaAcao && (
          <p className="text-xs font-semibold text-slate-600 mt-1">Próxima ação: {o.proximaAcao}</p>
        )}
      </div>
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-600 text-white transition-all"
        >
          <Phone className="w-3.5 h-3.5" /> WA
        </a>
      )}
    </div>
  );
}

function PipelineView() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? "";
  const { data, isLoading } = useQuery<PipelineData>({
    queryKey: ["operacoes-pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/operacoes/pipeline", { headers: { "x-session-token": token } });
      if (!res.ok) throw new Error("Erro ao carregar o pipeline");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium">Carregando pipeline...</p>
      </div>
    );
  }

  if (!data || data.opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-2">
          <Radar className="w-8 h-8 text-slate-300" />
        </div>
        <p className="font-bold text-slate-600">Nenhuma oportunidade ainda</p>
        <p className="text-sm text-slate-400 max-w-md text-center">
          Cada orçamento salvo vira uma oportunidade aqui, organizada por status e prioridade.
        </p>
      </div>
    );
  }

  const visibleStatuses = data.statusOrder.filter((s) => (data.statusCounts[s] ?? 0) > 0);

  return (
    <div className="space-y-6">
      {visibleStatuses.map((status) => {
        const meta = statusMeta(status);
        const items = data.opportunities.filter((o) => o.status === status);
        return (
          <div key={status} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border", meta.cls)}>
                {meta.label}
              </span>
              <span className="text-xs text-slate-400 font-semibold">{items.length}</span>
            </div>
            {items.map((o) => <OpportunityCard key={o.id} o={o} />)}
          </div>
        );
      })}
    </div>
  );
}

export default function Historico() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"pipeline" | "orcamentos">("pipeline");
  const params = new URLSearchParams();
  if (user?.nome) params.set("vendedor", user.nome);
  if (user?.papel) params.set("papel", user.papel);

  const { data: historico, isLoading, refetch } = useQuery<HistoricoItem[]>({
    queryKey: ["historico-orcamentos", user?.nome, user?.papel],
    queryFn: async () => {
      const res = await fetch(`/api/orcamento/historico?${params.toString()}`, {
        headers: { "x-session-token": user?.sessionToken || "" },
      });
      if (!res.ok) throw new Error("Erro ao carregar histórico");
      return res.json();
    },
  });

  const pendentes = historico?.filter(i => i.status !== "vendido") ?? [];
  const vendidos = historico?.filter(i => i.status === "vendido") ?? [];

  const atrasadosCount = pendentes.filter(i => diasDesde(i.criadoEm) >= 2).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Histórico
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base">
            {user?.papel === "dono"
              ? "Todos os orçamentos da equipe."
              : `Seus orçamentos, ${user?.nome?.split(" ")[0] ?? ""}.`}
          </p>
          {atrasadosCount > 0 && (
            <p className="text-xs text-amber-600 font-bold mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {atrasadosCount} orçamento{atrasadosCount !== 1 ? "s" : ""} sem resposta — considere fazer follow-up
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Abas: Pipeline (COCA) | Orçamentos */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab("pipeline")}
          className={cn(
            "px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors flex items-center gap-1.5",
            tab === "pipeline" ? "border-red-600 text-red-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <Layers className="w-4 h-4" /> Pipeline
        </button>
        <button
          onClick={() => setTab("orcamentos")}
          className={cn(
            "px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors flex items-center gap-1.5",
            tab === "orcamentos" ? "border-red-600 text-red-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <FileText className="w-4 h-4" /> Orçamentos
        </button>
      </div>

      {tab === "pipeline" ? <PipelineView /> : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Carregando histórico...</p>
        </div>
      ) : !historico || historico.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-2">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Nenhum orçamento salvo ainda</p>
          <p className="text-sm text-slate-400">Gere um orçamento e clique em "Salvar" para aparecer aqui.</p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 font-bold uppercase tracking-wide">
                Em aberto — {pendentes.length} orçamento{pendentes.length !== 1 ? "s" : ""}
              </p>
              {pendentes.map((item: any) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {vendidos.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Vendas fechadas — {vendidos.length} venda{vendidos.length !== 1 ? "s" : ""}
              </p>
              {vendidos.map((item: any) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
