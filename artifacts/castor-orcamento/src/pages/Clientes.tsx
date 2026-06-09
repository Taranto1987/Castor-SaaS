import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Phone, ShoppingBag, Calendar, TrendingUp, RefreshCw,
  MessageCircle, CheckCircle2, Clock, Plus, BarChart2, List,
  Flame, Thermometer, Snowflake, ArrowRight, Search, Filter,
  LayoutGrid, Edit2, XCircle, Archive, AlertTriangle,
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

// ── Types ────────────────────────────────────────────────────────────────────

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
}

const ESTAGIOS = [
  { key: "novo",       label: "Novo",       color: "bg-slate-100 text-slate-700 border-slate-200"    },
  { key: "contato",    label: "Contato",    color: "bg-blue-100 text-blue-700 border-blue-200"       },
  { key: "proposta",   label: "Proposta",   color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "negociacao", label: "Negociação", color: "bg-amber-100 text-amber-700 border-amber-200"    },
  { key: "ganho",      label: "Ganho",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "perdido",    label: "Perdido",    color: "bg-red-100 text-red-600 border-red-200"           },
  { key: "arquivado",  label: "Arquivado",  color: "bg-slate-100 text-slate-500 border-slate-300"    },
  { key: "cancelado",  label: "Cancelado",  color: "bg-orange-100 text-orange-600 border-orange-200" },
] as const;

const PIPELINE_STAGES = ["novo", "contato", "proposta", "negociacao", "ganho"];

function scoreIcon(score: number) {
  if (score >= 70) return <Flame className="w-3.5 h-3.5 text-red-500" />;
  if (score >= 40) return <Thermometer className="w-3.5 h-3.5 text-amber-500" />;
  return <Snowflake className="w-3.5 h-3.5 text-blue-400" />;
}

function scoreLabel(score: number) {
  if (score >= 70) return { label: "Quente", color: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 40) return { label: "Morno", color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Frio", color: "bg-blue-100 text-blue-600 border-blue-200" };
}

function diasDesde(iso?: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function parseBRL(str?: string | null): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  const score = lead.pontuacao ?? 0;
  const sl = scoreLabel(score);
  const dias = diasDesde(lead.ultimoContato);

  const isTerminal = ["ganho", "perdido", "arquivado", "cancelado"].includes(lead.estagio);

  return (
    <Link href={`/equipe/clientes/${lead.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all group"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">{lead.nome}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1", sl.color)}>
              {scoreIcon(score)}
              {score > 0 && <span>{Math.round(score)}</span>}
            </Badge>
            {(onEdit || onCancel) && (
              <div className="hidden group-hover:flex items-center gap-0.5">
                {onEdit && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(lead); }}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Editar lead"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
                {onCancel && !isTerminal && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(lead); }}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                    title="Cancelar lead"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {lead.whatsapp && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {lead.whatsapp}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          {lead.vendedorAtribuido && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{lead.vendedorAtribuido}</span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
            {dias === 0 ? "hoje" : dias === 1 ? "ontem" : `${dias}d atrás`}
          </span>
        </div>
        {lead.tags && (lead.tags as string[]).length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {(lead.tags as string[]).slice(0, 2).map((t) => (
              <span key={t} className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5">{t}</span>
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
  const colunas = ESTAGIOS.filter((e) => PIPELINE_STAGES.includes(e.key as string));
  const perdidos = leads.filter((l) => l.estagio === "perdido");

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {colunas.map((col) => {
          const itens = leads.filter((l) => l.estagio === col.key);
          return (
            <div key={col.key} className="w-60 shrink-0">
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-xl border mb-2", col.color)}>
                <span className="text-xs font-bold">{col.label}</span>
                <span className="text-xs font-bold bg-white/60 rounded-full px-1.5">{itens.length}</span>
              </div>
              <div className="space-y-2">
                {itens.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onEdit={onEdit} onCancel={onCancel} />
                ))}
                {itens.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center text-xs text-slate-400 dark:text-slate-600">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Coluna perdidos colapsada */}
        {perdidos.length > 0 && (
          <div className="w-48 shrink-0">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border mb-2 bg-red-50 text-red-600 border-red-200">
              <span className="text-xs font-bold">Perdidos</span>
              <span className="text-xs font-bold bg-white/60 rounded-full px-1.5">{perdidos.length}</span>
            </div>
            <div className="space-y-2">
              {perdidos.slice(0, 3).map((lead) => (
                <LeadCard key={lead.id} lead={lead} onEdit={onEdit} onCancel={onCancel} />
              ))}
              {perdidos.length > 3 && (
                <p className="text-xs text-center text-slate-400 dark:text-slate-500">+{perdidos.length - 3} mais</p>
              )}
            </div>
          </div>
        )}
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
  const score = lead.pontuacao ?? 0;
  const sl = scoreLabel(score);
  const estagio = ESTAGIOS.find((e) => e.key === lead.estagio);
  const dias = diasDesde(lead.ultimoContato);
  const isTerminal = ["ganho", "perdido", "arquivado", "cancelado"].includes(lead.estagio);

  return (
    <Link href={`/equipe/clientes/${lead.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{lead.nome}</span>
            <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1", sl.color)}>
              {scoreIcon(score)}
              {sl.label}
            </Badge>
          </div>
          {lead.whatsapp && (
            <p className="text-xs text-green-600 dark:text-green-400">{lead.whatsapp}</p>
          )}
        </div>
        <Badge variant="outline" className={cn("text-[10px] shrink-0", estagio?.color)}>
          {estagio?.label}
        </Badge>
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 w-20 text-right">
          {dias === 0 ? "hoje" : `${dias}d`}
        </span>
        {/* Action buttons — appear on hover, stop propagation */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(lead); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
              title="Editar"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onCancel && !isTerminal && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(lead); }}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
              title="Cancelar"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors shrink-0" />
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
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" />
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
          <Button
            disabled={!nome.trim() || criar.isPending}
            onClick={() => criar.mutate()}
          >
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

  const salvar = useMutation({
    mutationFn: async () => {
      const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ nome: nome.trim(), whatsapp: whatsapp.trim() || null, origem, estagio, observacoes: observacoes.trim() || null, tags }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
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
          <DialogTitle>Editar Lead</DialogTitle>
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
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="interesse, urgente, retorno..." />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!nome.trim() || salvar.isPending}
            onClick={() => salvar.mutate()}
          >
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
        throw new Error(err.error ?? "Erro ao cancelar");
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
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cancelar <strong>{lead.nome}</strong>? O lead será mantido no histórico com status "Cancelado".
          </p>
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Cliente comprou de concorrente, desistiu, sem contato..."
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
            {cancelar.isPending ? "Cancelando..." : "Confirmar cancelamento"}
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

  const count = tudo ? totalResettableCount : activeCount;
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
        throw new Error(err.error ?? "Erro ao resetar");
      }
      return res.json() as Promise<{ arquivados: number }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
  });

  const confirmado = confirm.trim().toUpperCase() === PALAVRA;

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
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Arquiva <strong>{activeCount} lead{activeCount !== 1 ? "s" : ""}</strong> em estágio ativo
              (Novo, Contato, Proposta, Negociação). Os leads ficam no histórico — nenhum dado é apagado.
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Arquiva <strong>todos os {totalResettableCount} leads</strong> incluindo ganhos e perdidos. Use para limpar dados de teste antes de começar de verdade.
            </p>
          )}

          {/* Toggle: incluir ganhos/perdidos */}
          <button
            type="button"
            onClick={() => { setTudo((v) => !v); setConfirm(""); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left",
              tudo
                ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-red-700 dark:text-red-400"
                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            )}
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>
              {tudo
                ? "✓ Limpar tudo (incluindo ganhos e perdidos)"
                : "Incluir ganhos e perdidos — limpar tudo"}
            </span>
          </button>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">
              Digite{" "}
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{PALAVRA}</span>{" "}
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
            disabled={!confirmado || resetar.isPending || count === 0}
            onClick={() => resetar.mutate()}
          >
            {resetar.isPending
              ? "Arquivando..."
              : `Arquivar ${count} lead${count !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View legada (histórico) ───────────────────────────────────────────────────

function ClientesHistorico() {
  const { user } = useAuth();
  const params = new URLSearchParams();
  if (user?.nome) params.set("vendedor", user.nome);
  if (user?.papel) params.set("papel", user.papel);

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
      if (item.status === "vendido") { cli.compras += 1; cli.totalGasto += parseBRL(item.totalPix ?? item.totalPrazo); }
      if (!cli.ultimoContato || (item.criadoEm && item.criadoEm > cli.ultimoContato)) cli.ultimoContato = item.criadoEm;
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
          { icon: Users,        label: "Total",       value: clientes.length,                             color: "bg-blue-500" },
          { icon: CheckCircle2, label: "Compraram",   value: clientes.filter((c: any) => c.compras > 0).length, color: "bg-emerald-500" },
          { icon: TrendingUp,   label: "Recorrentes", value: clientes.filter((c: any) => c.compras >= 2).length, color: "bg-violet-500" },
          { icon: ShoppingBag,  label: "Receita",     value: formatBRL(totalReceita),                     color: "bg-green-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", k.color)}>
              <k.icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide">{k.label}</p>
            <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{k.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin" />
          Carregando...
        </div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">Nenhum cliente ainda.</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
          {clientes.map((c: any) => {
            const dias = diasDesde(c.ultimoContato);
            const waUrl = c.whatsapp
              ? `https://wa.me/55${c.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, *${c.nome}*! 😊 Aqui é da *Castor*. Posso ajudar?`)}`
              : undefined;
            return (
              <div key={c.chave} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{c.nome}</span>
                    {c.compras >= 2 && <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">⭐ Recorrente</Badge>}
                    {c.compras === 1 && <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">✓ Cliente</Badge>}
                    {c.compras === 0 && <Badge variant="outline" className="text-[10px] text-slate-500">Prospect</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {c.orcamentos} orç · {c.compras} compra{c.compras !== 1 ? "s" : ""} · {c.totalGasto > 0 ? formatBRL(c.totalGasto) : "—"} · {dias}d atrás
                  </p>
                </div>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-600 text-white transition-all">
                    <MessageCircle className="w-3 h-3" />
                  </a>
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
  const [novoModal, setNovoModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [cancelLead, setCancelLead] = useState<Lead | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEstagio, setFilterEstagio] = useState("todos");

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
  });

  const leads = data?.leads ?? [];

  const activeLeadsCount = leads.filter(
    (l) => PIPELINE_STAGES.includes(l.estagio)
  ).length;

  const archivedCount = leads.filter(
    (l) => l.estagio === "arquivado" || l.estagio === "cancelado"
  ).length;

  // Todos que podem ser arquivados (excluindo os que já estão)
  const totalResettableCount = leads.filter(
    (l) => l.estagio !== "arquivado" && l.estagio !== "cancelado"
  ).length;

  // Lista tab: excludes archived/cancelled unless showArchived is on or a specific stage filter is set
  const listaLeads = useMemo(() => {
    let l = leads;
    if (!showArchived && filterEstagio === "todos") {
      l = l.filter((r) => r.estagio !== "arquivado" && r.estagio !== "cancelado");
    }
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((r) => r.nome.toLowerCase().includes(q) || (r.whatsapp ?? "").includes(q));
    }
    if (filterEstagio !== "todos") l = l.filter((r) => r.estagio === filterEstagio);
    return l;
  }, [leads, search, filterEstagio, showArchived]);

  // Pipeline tab: only active stages, search/estagio filter applied on top
  const pipelineLeads = useMemo(() => {
    let l = leads;
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((r) => r.nome.toLowerCase().includes(q) || (r.whatsapp ?? "").includes(q));
    }
    if (filterEstagio !== "todos" && PIPELINE_STAGES.includes(filterEstagio)) {
      l = l.filter((r) => r.estagio === filterEstagio);
    }
    return l;
  }, [leads, search, filterEstagio]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            CRM
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {activeLeadsCount} lead{activeLeadsCount !== 1 ? "s" : ""} ativo{activeLeadsCount !== 1 ? "s" : ""}
            {archivedCount > 0 && ` · ${archivedCount} arquivado${archivedCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDono && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetModal(true)}
              className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-900/20"
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
            <TabsTrigger value="historico" className="gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm w-40"
              />
            </div>
            <Select value={filterEstagio} onValueChange={setFilterEstagio}>
              <SelectTrigger className="h-8 text-sm w-36">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
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

        <TabsContent value="pipeline">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              Carregando pipeline...
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <p className="text-sm font-medium text-red-500">Erro ao carregar leads. Tente novamente.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <PipelineBoard
              leads={pipelineLeads}
              onEdit={setEditLead}
              onCancel={setCancelLead}
            />
          )}
        </TabsContent>

        <TabsContent value="lista">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            {/* Archived toggle */}
            {archivedCount > 0 && filterEstagio === "todos" && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500">{archivedCount} lead{archivedCount !== 1 ? "s" : ""} arquivado{archivedCount !== 1 ? "s" : ""}</span>
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <Archive className="w-3 h-3" />
                  {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
                </button>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Carregando...
              </div>
            ) : isError ? (
              <div className="text-center py-16 text-red-500">
                <p className="text-sm font-medium">Erro ao carregar leads.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button>
              </div>
            ) : listaLeads.length === 0 ? (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                {leads.length === 0 ? (
                  <>
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-200 dark:text-slate-700" />
                    <p className="font-semibold text-slate-500">Nenhum lead cadastrado</p>
                    <p className="text-sm mt-1">Clique em "Novo Lead" para começar.</p>
                  </>
                ) : (
                  <p>Nenhum resultado para os filtros.</p>
                )}
              </div>
            ) : (
              listaLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onEdit={setEditLead}
                  onCancel={setCancelLead}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <ClientesHistorico />
        </TabsContent>
      </Tabs>

      <NovoLeadModal open={novoModal} onClose={() => setNovoModal(false)} />
      {editLead && <EditarLeadModal lead={editLead} onClose={() => setEditLead(null)} />}
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
