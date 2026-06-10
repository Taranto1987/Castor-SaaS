import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, DollarSign, Flame, Clock, MessageCircle, RefreshCw,
  Plus, Search, Filter, LayoutGrid, List, Archive, ShoppingBag,
  Edit2, XCircle, AlertTriangle, Thermometer, Snowflake,
  CheckCircle2, TrendingUp, BarChart2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AuthUser } from "@/contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL ?? "";

function getAuthHeaders(): Record<string, string> {
  const raw = sessionStorage.getItem("castor_auth_user");
  if (!raw) return {};
  const user = JSON.parse(raw);
  if (user?.sessionToken) return { "x-session-token": user.sessionToken };
  return {};
}

function userIsDono(user: AuthUser | null): boolean {
  return user?.papel === "dono" || user?.papel === "ADMIN" || user?.papel === "GERENTE";
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: number;
  nome: string;
  whatsapp?: string | null;
  email?: string | null;
  estagio: string;
  origem: string;
  tags: string[];
  observacoes?: string | null;
  vendedorAtribuido?: string | null;
  pontuacao: number;
  ultimoContato?: string | null;
  criadoEm: string;
  atualizadoEm?: string | null;
  // Enriched from salesOpportunities
  valorNumerico?: number | null;
  valorBrl?: string | null;
  closingProbability?: number | null;
  proximaAcao?: string | null;
  oppDiasSemResposta?: number | null;
}

const ESTAGIOS = [
  { key: "novo",       label: "Novo",       color: "bg-slate-100 text-slate-700 border-slate-200"       },
  { key: "contato",    label: "Contato",    color: "bg-blue-100 text-blue-700 border-blue-200"          },
  { key: "proposta",   label: "Proposta",   color: "bg-violet-100 text-violet-700 border-violet-200"    },
  { key: "negociacao", label: "Negociação", color: "bg-amber-100 text-amber-700 border-amber-200"       },
  { key: "ganho",      label: "Ganho",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "perdido",    label: "Perdido",    color: "bg-red-100 text-red-600 border-red-200"              },
  { key: "arquivado",  label: "Arquivado",  color: "bg-slate-100 text-slate-500 border-slate-300"       },
  { key: "cancelado",  label: "Cancelado",  color: "bg-orange-100 text-orange-600 border-orange-200"    },
] as const;

const PIPELINE_STAGES = ["novo", "contato", "proposta", "negociacao", "ganho"];
const ACTIVE_STAGES   = ["novo", "contato", "proposta", "negociacao"];
const ARCHIVED_STAGES = ["arquivado", "cancelado", "perdido"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreIcon(score: number) {
  if (score >= 70) return <Flame className="w-3.5 h-3.5 text-red-500" />;
  if (score >= 40) return <Thermometer className="w-3.5 h-3.5 text-amber-500" />;
  return <Snowflake className="w-3.5 h-3.5 text-slate-400" />;
}

function scoreLabel(score: number) {
  if (score >= 70) return { label: "Quente", color: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 40) return { label: "Morno",  color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Frio", color: "bg-slate-100 text-slate-500 border-slate-200" };
}

function diasDesde(iso?: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function getDias(lead: Lead): number {
  if ((lead.oppDiasSemResposta ?? 0) > 0) return lead.oppDiasSemResposta!;
  return diasDesde(lead.ultimoContato);
}

function diasBadge(dias: number) {
  if (dias === 0) return { text: "hoje",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (dias === 1) return { text: "ontem", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  if (dias <= 3)  return { text: `${dias}d`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (dias <= 7)  return { text: `${dias}d`, cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { text: `${dias}d`, cls: "bg-red-50 text-red-700 border-red-200" };
}

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(str?: string | null): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function makeWaUrl(whatsapp: string, nome: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = encodeURIComponent(`Olá, *${nome}*! 😊 Aqui é da *Castor Exclusiva*. Podemos continuar?`);
  return `https://wa.me/${num}?text=${msg}`;
}

function getLeadValue(lead: Lead): number {
  if ((lead.valorNumerico ?? 0) > 0) return lead.valorNumerico!;
  if (lead.valorBrl) return parseBRL(lead.valorBrl);
  return 0;
}

function origemLabel(o: string): string {
  const map: Record<string, string> = {
    loja: "Loja", chat: "Chat", indicacao: "Indicação",
    instagram: "Instagram", google: "Google", whatsapp_direto: "WhatsApp",
    mapa_sono: "Mapa do Sono", orcamento: "Orçamento", diagnostico: "Diagnóstico",
  };
  return map[o] ?? o;
}

// ── WA Button ─────────────────────────────────────────────────────────────────

function WaBtn({ whatsapp, nome, size = "md" }: { whatsapp: string; nome: string; size?: "sm" | "md" }) {
  return (
    <a
      href={makeWaUrl(whatsapp, nome)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex items-center justify-center rounded-full bg-[#25D366] hover:bg-[#1ebe5a] text-white transition-all active:scale-95 shadow-sm shrink-0",
        size === "sm" ? "w-7 h-7" : "w-9 h-9",
      )}
      title={`WhatsApp — ${nome}`}
    >
      <MessageCircle className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
    </a>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", accent)}>
        <Icon className="w-4.5 h-4.5 text-white" size={18} />
      </div>
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide leading-none mb-1">{label}</p>
      <p className="text-xl font-extrabold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Lead Card (Kanban) ────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onEdit,
  onCancel,
}: {
  lead: Lead;
  onEdit?: (lead: Lead) => void;
  onCancel?: (lead: Lead) => void;
}) {
  const score  = lead.pontuacao ?? 0;
  const sl     = scoreLabel(score);
  const dias   = getDias(lead);
  const db     = diasBadge(dias);
  const valor  = getLeadValue(lead);
  const isTerminal = ARCHIVED_STAGES.includes(lead.estagio);

  return (
    <Link href={`/equipe/clientes/${lead.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
      >
        {/* Row 1: Name + WA */}
        <div className="flex items-start gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-slate-900 text-sm leading-tight block truncate">{lead.nome}</span>
            {lead.vendedorAtribuido && (
              <span className="text-[10px] text-slate-400">{lead.vendedorAtribuido}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1 px-1.5 py-0.5", sl.color)}>
              {scoreIcon(score)}
              {score > 0 && <span>{Math.round(score)}</span>}
            </Badge>
            {lead.whatsapp && <WaBtn whatsapp={lead.whatsapp} nome={lead.nome} size="sm" />}
          </div>
        </div>

        {/* Row 2: Value */}
        {valor > 0 && (
          <p className="text-sm font-bold text-emerald-700 mb-1.5">
            {lead.valorBrl ?? formatBRL(valor)}
          </p>
        )}

        {/* Row 3: Next action */}
        {lead.proximaAcao && lead.proximaAcao !== "Concluído" && (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 mb-1.5 truncate">
            → {lead.proximaAcao}
          </p>
        )}

        {/* Row 4: Days + Origin + Actions */}
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[10px] font-semibold border rounded-full px-1.5 py-0.5", db.cls)}>
              {db.text}
            </span>
            {lead.origem && lead.origem !== "loja" && (
              <span className="text-[10px] text-slate-400">{origemLabel(lead.origem)}</span>
            )}
          </div>
          <div className="hidden group-hover:flex items-center gap-0.5">
            {onEdit && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(lead); }}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Editar"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
            {onCancel && !isTerminal && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(lead); }}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Cancelar"
              >
                <XCircle className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        {(lead.tags as string[]).length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {(lead.tags as string[]).slice(0, 2).map((t) => (
              <span key={t} className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">{t}</span>
            ))}
          </div>
        )}
      </motion.div>
    </Link>
  );
}

// ── Pipeline Board ────────────────────────────────────────────────────────────

function PipelineBoard({
  leads,
  onEdit,
  onCancel,
}: {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onCancel: (lead: Lead) => void;
}) {
  const cols = ESTAGIOS.filter((e) => PIPELINE_STAGES.includes(e.key as string));

  return (
    <div className="overflow-x-auto pb-4 -mx-1 px-1">
      <div className="flex gap-3 min-w-max">
        {cols.map((col) => {
          const itens    = leads.filter((l) => l.estagio === col.key);
          const colValue = itens.reduce((s, l) => s + getLeadValue(l), 0);
          return (
            <div key={col.key} className="w-64 shrink-0">
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-xl border mb-3", col.color)}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{col.label}</span>
                  <span className="text-[11px] font-bold bg-white/60 rounded-full px-1.5 leading-5">{itens.length}</span>
                </div>
                {colValue > 0 && (
                  <span className="text-[10px] font-semibold opacity-80">{formatBRL(colValue)}</span>
                )}
              </div>
              <div className="space-y-2">
                {itens.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onEdit={onEdit} onCancel={onCancel} />
                ))}
                {itens.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center text-xs text-slate-400">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Lista Row ─────────────────────────────────────────────────────────────────

function LeadRow({
  lead,
  onEdit,
  onCancel,
}: {
  lead: Lead;
  onEdit?: (lead: Lead) => void;
  onCancel?: (lead: Lead) => void;
}) {
  const score  = lead.pontuacao ?? 0;
  const sl     = scoreLabel(score);
  const estagio = ESTAGIOS.find((e) => e.key === lead.estagio);
  const dias   = getDias(lead);
  const db     = diasBadge(dias);
  const valor  = getLeadValue(lead);
  const isTerminal = ARCHIVED_STAGES.includes(lead.estagio);

  return (
    <Link href={`/equipe/clientes/${lead.id}`}>
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 group">
        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{lead.nome}</span>
            <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1 px-1.5", sl.color)}>
              {scoreIcon(score)}
              <span className="hidden sm:inline">{sl.label}</span>
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {lead.whatsapp && (
              <span className="text-[11px] text-slate-400">{lead.whatsapp}</span>
            )}
            {lead.proximaAcao && lead.proximaAcao !== "Concluído" && (
              <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[180px]">
                → {lead.proximaAcao}
              </span>
            )}
          </div>
        </div>

        {/* Value */}
        {valor > 0 && (
          <span className="text-sm font-bold text-emerald-700 shrink-0 hidden md:block">
            {lead.valorBrl ?? formatBRL(valor)}
          </span>
        )}

        {/* Stage */}
        <Badge variant="outline" className={cn("text-[10px] shrink-0 hidden sm:flex", estagio?.color)}>
          {estagio?.label}
        </Badge>

        {/* Days */}
        <span className={cn("text-[10px] font-semibold border rounded-full px-1.5 py-0.5 shrink-0", db.cls)}>
          {db.text}
        </span>

        {/* WA + Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {lead.whatsapp && (
            <WaBtn whatsapp={lead.whatsapp} nome={lead.nome} size="sm" />
          )}
          <div className="hidden group-hover:flex items-center gap-0.5">
            {onEdit && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(lead); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Editar"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onCancel && !isTerminal && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(lead); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Cancelar"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Novo Lead Modal ───────────────────────────────────────────────────────────

function NovoLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [origem, setOrigem] = useState("loja");

  const criar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ nome, whatsapp, origem, vendedorAtribuido: user?.nome }),
      });
      if (!res.ok) throw new Error("Erro ao criar lead");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      setNome(""); setWhatsapp(""); setOrigem("loja");
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(22) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="loja">Loja física</SelectItem>
                <SelectItem value="chat">Chat / ThallesZzz</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="whatsapp_direto">WhatsApp direto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending ? "Criando..." : "Criar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Editar Lead Modal ─────────────────────────────────────────────────────────

function EditarLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(lead.nome);
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp ?? "");
  const [origem, setOrigem] = useState(lead.origem ?? "loja");
  const [estagio, setEstagio] = useState(lead.estagio);
  const [observacoes, setObservacoes] = useState(lead.observacoes ?? "");
  const [tagsRaw, setTagsRaw] = useState((lead.tags as string[]).join(", "));
  const [motivoGanho, setMotivoGanho] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      const extra: Record<string, unknown> = {};
      if (estagio === "ganho" && motivoGanho.trim()) extra.motivoGanho = motivoGanho.trim();
      if (estagio === "perdido" && motivoPerda.trim()) extra.motivoPerda = motivoPerda.trim();
      const res = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ nome: nome.trim(), whatsapp: whatsapp.trim() || null, origem, estagio, observacoes: observacoes.trim() || null, tags, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
  });

  const EDIT_ESTAGIOS = ESTAGIOS.filter((e) => e.key !== "cancelado");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lead — {lead.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(22) 99999-9999" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loja">Loja física</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="whatsapp_direto">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estágio</Label>
              <Select value={estagio} onValueChange={setEstagio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDIT_ESTAGIOS.map((e) => (
                    <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="interesse, urgente..." />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas sobre o cliente..."
              rows={3}
            />
          </div>
          {estagio === "ganho" && (
            <div className="space-y-1.5">
              <Label>Motivo do ganho <span className="text-slate-400 text-xs">(opcional)</span></Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                value={motivoGanho}
                onChange={(e) => setMotivoGanho(e.target.value)}
                placeholder="Ex: produto ideal, preço competitivo, urgência..."
                rows={2}
              />
            </div>
          )}
          {estagio === "perdido" && (
            <div className="space-y-1.5">
              <Label>Motivo da perda <span className="text-slate-400 text-xs">(opcional)</span></Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                placeholder="Ex: comprou de concorrente, sem orçamento, desistiu..."
                rows={2}
              />
            </div>
          )}
          {salvar.isError && (
            <p className="text-xs text-red-500">{(salvar.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cancelar Lead Modal ───────────────────────────────────────────────────────

function CancelarLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");

  const cancelar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ estagio: "cancelado", motivo: motivo.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao cancelar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <XCircle className="w-5 h-5" />
            Cancelar Lead
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-slate-600">
            Cancelar <strong>{lead.nome}</strong>? O lead fica no histórico com status "Cancelado".
          </p>
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: comprou de concorrente, desistiu, sem contato..."
              rows={3}
              autoFocus
            />
          </div>
          {cancelar.isError && (
            <p className="text-xs text-red-500">{(cancelar.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={!motivo.trim() || cancelar.isPending}
            onClick={() => cancelar.mutate()}
          >
            {cancelar.isPending ? "Cancelando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Resetar CRM Modal ─────────────────────────────────────────────────────────

function ResetarCRMModal({
  activeCount,
  totalResettableCount,
  onClose,
}: {
  activeCount: number;
  totalResettableCount: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [tudo, setTudo] = useState(false);

  const count  = tudo ? totalResettableCount : activeCount;
  const PALAVRA = tudo ? "LIMPAR TUDO" : "RESETAR";

  const resetar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/leads/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ tudo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao resetar");
      }
      return res.json() as Promise<{ arquivados: number }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            {tudo ? "Limpar CRM" : "Resetar CRM"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          {!tudo ? (
            <p className="text-sm text-slate-600">
              Arquiva <strong>{activeCount} lead{activeCount !== 1 ? "s" : ""}</strong> em estágio ativo
              (Novo, Contato, Proposta, Negociação). Nenhum dado é apagado.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Arquiva <strong>todos os {totalResettableCount} leads</strong> incluindo ganhos e perdidos.
              Use para limpar dados de teste.
            </p>
          )}

          <button
            type="button"
            onClick={() => { setTudo((v) => !v); setConfirm(""); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left",
              tudo
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-200 hover:bg-slate-50 text-slate-600"
            )}
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>{tudo ? "✓ Limpar tudo (incluindo ganhos e perdidos)" : "Incluir ganhos e perdidos"}</span>
          </button>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">
              Digite{" "}
              <span className="font-mono font-bold text-slate-700">{PALAVRA}</span>{" "}
              para confirmar
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={PALAVRA}
              className="font-mono"
              autoFocus
            />
          </div>
          {resetar.isError && (
            <p className="text-xs text-red-500">{(resetar.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={confirm.trim().toUpperCase() !== PALAVRA || resetar.isPending || count === 0}
            onClick={() => resetar.mutate()}
          >
            {resetar.isPending ? "Arquivando..." : `Arquivar ${count} lead${count !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Clientes Histórico (orcamentos) ───────────────────────────────────────────

function ClientesHistorico() {
  const { user } = useAuth();
  const params = new URLSearchParams();
  if (user?.nome)  params.set("vendedor", user.nome);
  if (user?.papel) params.set("papel",    user.papel);

  const { data: historico, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["historico-orcamentos", user?.sessionToken],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/orcamento/historico?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!user?.sessionToken,
    staleTime: 0,
  });

  const clientes = useMemo(() => {
    if (!historico) return [];
    const mapa = new Map<string, any>();
    for (const item of historico) {
      const chave = item.whatsapp
        ? item.whatsapp.replace(/\D/g, "")
        : (item.cliente ?? "").toLowerCase().trim();
      if (!chave) continue;
      if (!mapa.has(chave)) {
        mapa.set(chave, { chave, nome: item.cliente ?? "Cliente", whatsapp: item.whatsapp, orcamentos: 0, compras: 0, totalGasto: 0, ultimoContato: item.criadoEm });
      }
      const cli = mapa.get(chave)!;
      cli.orcamentos += 1;
      if (item.status === "vendido") {
        cli.compras += 1;
        cli.totalGasto += parseBRL(item.totalPix ?? item.totalPrazo);
      }
      if (!cli.ultimoContato || (item.criadoEm && item.criadoEm > cli.ultimoContato)) {
        cli.ultimoContato = item.criadoEm;
      }
    }
    return Array.from(mapa.values())
      .map((c) => ({ ...c, taxaRetorno: c.orcamentos > 0 ? Math.round((c.compras / c.orcamentos) * 100) : 0 }))
      .sort((a, b) => b.totalGasto - a.totalGasto || b.orcamentos - a.orcamentos);
  }, [historico]);

  const totalReceita = clientes.reduce((s: number, c: any) => s + c.totalGasto, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users,        label: "Total",       value: clientes.length,                                  accent: "bg-blue-500"    },
          { icon: CheckCircle2, label: "Compraram",   value: clientes.filter((c: any) => c.compras > 0).length, accent: "bg-emerald-500" },
          { icon: TrendingUp,   label: "Recorrentes", value: clientes.filter((c: any) => c.compras >= 2).length, accent: "bg-violet-500" },
          { icon: DollarSign,   label: "Receita",     value: formatBRL(totalReceita),                          accent: "bg-green-600"   },
        ].map((k) => (
          <KpiCard key={k.label} icon={k.icon} label={k.label} value={k.value} accent={k.accent} />
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">Nenhum cliente ainda.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
          {clientes.map((c: any) => {
            const dias = diasDesde(c.ultimoContato);
            const db   = diasBadge(dias);
            return (
              <div key={c.chave} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{c.nome}</span>
                    {c.compras >= 2 && <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">⭐ Recorrente</Badge>}
                    {c.compras === 1 && <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">✓ Cliente</Badge>}
                    {c.compras === 0 && <Badge variant="outline" className="text-[10px] text-slate-500">Prospect</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c.orcamentos} orç · {c.compras} compra{c.compras !== 1 ? "s" : ""} · {c.totalGasto > 0 ? formatBRL(c.totalGasto) : "—"}
                  </p>
                </div>
                <span className={cn("text-[10px] font-semibold border rounded-full px-1.5 py-0.5 shrink-0", db.cls)}>{db.text}</span>
                {c.whatsapp && (
                  <WaBtn whatsapp={c.whatsapp} nome={c.nome} size="sm" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Clientes() {
  const { user } = useAuth();
  const [novoModal,      setNovoModal]      = useState(false);
  const [editLead,       setEditLead]       = useState<Lead | null>(null);
  const [cancelLead,     setCancelLead]     = useState<Lead | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [search,         setSearch]         = useState("");
  const [filterEstagio,  setFilterEstagio]  = useState("todos");

  const isDono = userIsDono(user);

  const { data, isLoading, isError, refetch } = useQuery<{ leads: Lead[] }>({
    queryKey: ["leads", user?.sessionToken],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/leads`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user?.sessionToken,
    staleTime: 0,
    refetchOnMount: true,
  });

  const leads = data?.leads ?? [];

  // ── KPI computations ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active   = leads.filter((l) => ACTIVE_STAGES.includes(l.estagio));
    const pipeline = active.reduce((s, l) => s + getLeadValue(l), 0);
    const quentes  = leads.filter((l) => ACTIVE_STAGES.includes(l.estagio) && (l.pontuacao ?? 0) >= 70).length;
    const overdue  = leads.filter((l) => ACTIVE_STAGES.includes(l.estagio) && getDias(l) > 7).length;
    return { activeCount: active.length, pipelineValue: pipeline, quentes, overdue };
  }, [leads]);

  const activeLeadsCount     = kpis.activeCount;
  const archivedLeads        = leads.filter((l) => ARCHIVED_STAGES.includes(l.estagio));
  const totalResettableCount = leads.filter((l) => !ARCHIVED_STAGES.includes(l.estagio)).length;

  // ── Filtered views ────────────────────────────────────────────────────────
  function applyFilter(list: Lead[]) {
    let l = list;
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((r) => r.nome.toLowerCase().includes(q) || (r.whatsapp ?? "").includes(q));
    }
    if (filterEstagio !== "todos") l = l.filter((r) => r.estagio === filterEstagio);
    return l;
  }

  const pipelineLeads = useMemo(
    () => applyFilter(leads.filter((l) => PIPELINE_STAGES.includes(l.estagio))),
    [leads, search, filterEstagio],
  );

  const listaLeads = useMemo(
    () => applyFilter(leads.filter((l) => !ARCHIVED_STAGES.includes(l.estagio))),
    [leads, search, filterEstagio],
  );

  const arquivadosFiltered = useMemo(
    () => applyFilter(archivedLeads),
    [archivedLeads, search, filterEstagio],
  );

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight">CRM</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {activeLeadsCount} lead{activeLeadsCount !== 1 ? "s" : ""} ativo{activeLeadsCount !== 1 ? "s" : ""}
            {archivedLeads.length > 0 && ` · ${archivedLeads.length} arquivado${archivedLeads.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDono && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetModal(true)}
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5" />
              Resetar CRM
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setNovoModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label="Leads ativos"
          value={kpis.activeCount}
          sub="no pipeline"
          accent="bg-blue-500"
        />
        <KpiCard
          icon={DollarSign}
          label="Em pipeline"
          value={kpis.pipelineValue > 0 ? formatBRL(kpis.pipelineValue) : "—"}
          sub="valor potencial"
          accent="bg-emerald-600"
        />
        <KpiCard
          icon={Flame}
          label="Leads quentes"
          value={kpis.quentes}
          sub="score ≥ 70"
          accent="bg-red-500"
        />
        <KpiCard
          icon={Clock}
          label="Sem contato"
          value={kpis.overdue}
          sub="há mais de 7 dias"
          accent={kpis.overdue > 0 ? "bg-amber-500" : "bg-slate-400"}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <TabsList className="self-start">
            <TabsTrigger value="pipeline" className="gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5">
              <List className="w-3.5 h-3.5" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="arquivados" className="gap-1.5">
              <Archive className="w-3.5 h-3.5" />
              Arquivados
              {archivedLeads.length > 0 && (
                <span className="ml-0.5 text-[10px] bg-slate-200 text-slate-600 rounded-full px-1.5 leading-5">{archivedLeads.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              Clientes
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm w-40"
              />
            </div>
            <Select value={filterEstagio} onValueChange={setFilterEstagio}>
              <SelectTrigger className="h-8 text-sm w-36 gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTAGIOS.map((e) => (
                  <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Pipeline ── */}
        <TabsContent value="pipeline">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              Carregando...
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p className="text-sm font-medium text-red-500">Erro ao carregar leads.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <PipelineBoard leads={pipelineLeads} onEdit={setEditLead} onCancel={setCancelLead} />
          )}
        </TabsContent>

        {/* ── Lista ── */}
        <TabsContent value="lista">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Carregando...
              </div>
            ) : isError ? (
              <div className="text-center py-16">
                <p className="text-sm font-medium text-red-500">Erro ao carregar leads.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button>
              </div>
            ) : listaLeads.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                {leads.length === 0 ? (
                  <>
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                    <p className="font-semibold text-slate-500">Nenhum lead cadastrado</p>
                    <p className="text-sm mt-1">Clique em "Novo Lead" para começar.</p>
                  </>
                ) : (
                  <p>Nenhum resultado para os filtros.</p>
                )}
              </div>
            ) : (
              listaLeads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onEdit={setEditLead} onCancel={setCancelLead} />
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Arquivados ── */}
        <TabsContent value="arquivados">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Carregando...
              </div>
            ) : arquivadosFiltered.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Archive className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="font-semibold text-slate-500">Nenhum lead arquivado</p>
                <p className="text-sm mt-1">Leads cancelados, perdidos e arquivados aparecem aqui.</p>
              </div>
            ) : (
              arquivadosFiltered.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onEdit={setEditLead} />
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Clientes (histórico orçamentos) ── */}
        <TabsContent value="clientes">
          <ClientesHistorico />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NovoLeadModal open={novoModal} onClose={() => setNovoModal(false)} />
      {editLead   && <EditarLeadModal   lead={editLead}   onClose={() => setEditLead(null)}   />}
      {cancelLead && <CancelarLeadModal lead={cancelLead} onClose={() => setCancelLead(null)} />}
      {showResetModal && (
        <ResetarCRMModal
          activeCount={activeLeadsCount}
          totalResettableCount={totalResettableCount}
          onClose={() => setShowResetModal(false)}
        />
      )}
    </div>
  );
}
