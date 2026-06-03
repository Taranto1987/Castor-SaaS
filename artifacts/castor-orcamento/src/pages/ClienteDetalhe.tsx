import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Phone, Mail, User, Clock, MessageSquare, FileText,
  Plus, Flame, Thermometer, Snowflake, CheckCircle2, Circle,
  Brain, Stethoscope, ChevronDown, ChevronUp, Edit2, Check, X,
  Moon, Sparkles, Target, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const API_URL = import.meta.env.VITE_API_URL ?? "";

function getAuthHeaders(): Record<string, string> {
  const raw = sessionStorage.getItem("castor_auth_user");
  if (!raw) return {};
  const user = JSON.parse(raw);
  if (user?.sessionToken) return { "x-session-token": user.sessionToken };
  return {};
}

const ESTAGIOS = [
  { key: "novo",        label: "Novo",         color: "bg-slate-100 text-slate-700 border-slate-200"  },
  { key: "contato",     label: "Contato",       color: "bg-blue-100 text-blue-700 border-blue-200"    },
  { key: "proposta",    label: "Proposta",      color: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "negociacao",  label: "Negociação",    color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "ganho",       label: "Ganho",         color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "perdido",     label: "Perdido",       color: "bg-red-100 text-red-600 border-red-200"       },
];

const TIPOS_INTERACAO = [
  { key: "nota",         label: "Nota" },
  { key: "ligacao",      label: "Ligação" },
  { key: "mensagem_wa",  label: "WhatsApp" },
  { key: "orcamento",    label: "Orçamento" },
  { key: "visita",       label: "Visita" },
  { key: "email",        label: "E-mail" },
  { key: "handoff",      label: "Handoff IA" },
];

function scoreLabel(score: number) {
  if (score >= 70) return { label: "Quente", icon: Flame, color: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 40) return { label: "Morno",  icon: Thermometer, color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Frio", icon: Snowflake, color: "bg-blue-100 text-blue-600 border-blue-200" };
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function tipoIcon(tipo: string) {
  const icons: Record<string, string> = {
    nota: "📝", ligacao: "📞", mensagem_wa: "💬", orcamento: "📋",
    visita: "🏪", email: "📧", handoff: "🤖",
  };
  return icons[tipo] ?? "•";
}

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [novaInteracao, setNovaInteracao] = useState("");
  const [tipoInteracao, setTipoInteracao] = useState("nota");
  const [editandoEstagio, setEditandoEstagio] = useState(false);
  const [capsuleOpen, setCapsuleOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/leads/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Não encontrado");
      return res.json() as Promise<{
        lead: any;
        interacoes: any[];
        tarefas: any[];
        score: any;
        capsule: any;
        diagnostico: any;
      }>;
    },
  });

  const patchLead = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", id] }),
  });

  const addInteracao = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/leads/${id}/interacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ tipo: tipoInteracao, conteudo: novaInteracao }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      setNovaInteracao("");
      qc.invalidateQueries({ queryKey: ["lead", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 pb-20">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="font-semibold text-slate-600">Lead não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/equipe/clientes")}>
          Voltar
        </Button>
      </div>
    );
  }

  const { lead, interacoes, tarefas, score, capsule, diagnostico } = data;
  const estagio = ESTAGIOS.find((e) => e.key === lead.estagio) ?? ESTAGIOS[0];
  const scoreMeta = scoreLabel(score?.score ?? 0);
  const ScoreIcon = scoreMeta.icon;
  const perfil = (lead.perfilBiomecanico as Record<string, unknown>) ?? {};

  // ── Painel de Sono (Fase 5): dados reais do Mapa do Sono + scoring ──────────
  const bio = (diagnostico?.perfil_biomecanico as Record<string, unknown>) ?? {};
  const respostas = (diagnostico?.respostas as Record<string, unknown>) ?? {};
  const humanize = (v: unknown) =>
    v == null || v === "" ? "—" : String(v).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const confiancaPct = (() => {
    const c = Number(diagnostico?.confianca);
    if (isNaN(c)) return null;
    return Math.round(c <= 1 ? c * 100 : c);
  })();
  const chanceFechamento = score?.closingProbability != null
    ? Math.round((score.closingProbability <= 1 ? score.closingProbability * 100 : score.closingProbability))
    : null;

  return (
    <div className="space-y-5 pb-20 max-w-3xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link href="/equipe/clientes">
          <button className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100 truncate">{lead.nome}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead.whatsapp && (
              <a href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline">
                <Phone className="w-3 h-3" />{lead.whatsapp}
              </a>
            )}
            {lead.email && (
              <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <Mail className="w-3 h-3" />{lead.email}
              </span>
            )}
          </div>
        </div>
        {score && (
          <Badge variant="outline" className={cn("flex items-center gap-1 shrink-0", scoreMeta.color)}>
            <ScoreIcon className="w-3.5 h-3.5" />
            {scoreMeta.label} · {Math.round(score.score)}
          </Badge>
        )}
      </div>

      {/* Status card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Estágio</p>
            {editandoEstagio ? (
              <div className="flex items-center gap-2">
                <Select
                  defaultValue={lead.estagio}
                  onValueChange={(v) => {
                    patchLead.mutate({ estagio: v });
                    setEditandoEstagio(false);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTAGIOS.map((e) => (
                      <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button onClick={() => setEditandoEstagio(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-sm px-3 py-1", estagio.color)}>
                  {estagio.label}
                </Badge>
                <button onClick={() => setEditandoEstagio(true)} className="p-1 text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          {lead.vendedorAtribuido && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Vendedor</p>
              <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {lead.vendedorAtribuido}
              </div>
            </div>
          )}
          {lead.origem && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Origem</p>
              <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">{lead.origem.replace("_", " ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Diagnóstico do Sono (Mapa do Sono) — Fase 5 */}
      {diagnostico && (
        <div className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-950/30">
            <Moon className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex-1">Diagnóstico do Sono</h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(diagnostico.criadoEm)}</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Produto recomendado + confiança + chance de fechamento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Produto Recomendado
                </p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{diagnostico.produto_recomendado ?? "—"}</p>
                {confiancaPct != null && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Confiança: {confiancaPct}%</p>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Chance de Fechamento
                </p>
                <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                  {chanceFechamento != null ? `${chanceFechamento}%` : "—"}
                </p>
              </div>
            </div>

            {/* Perfil biomecânico + respostas-chave */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                { label: "Suporte",      value: bio["suporte"] },
                { label: "Firmeza",      value: bio["firmeza_final"] ?? bio["firmeza"] },
                { label: "Tecnologia",   value: bio["tecnologia"] },
                { label: "Principal Dor", value: respostas["dor"] },
                { label: "Perfil Térmico", value: respostas["calor"] },
                { label: "Posição",      value: respostas["posicao"] },
                { label: "Usuário",      value: respostas["usuario_tipo"] },
                { label: "Tamanho",      value: respostas["tamanho"] },
              ].map((f) => (
                <div key={f.label} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2.5">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{f.label}</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{humanize(f.value)}</p>
                </div>
              ))}
            </div>

            {diagnostico.flag_calibracao && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
                <Activity className="w-3.5 h-3.5 shrink-0" />
                Calibração sugerida: {humanize(diagnostico.flag_calibracao)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Perfil Biomecânico (dados manuais do lead) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Perfil Biomecânico</h3>
        </div>
        <div className="p-4">
          {Object.keys(perfil).length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Perfil não preenchido. Colete informações durante o atendimento.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(perfil).map(([k, v]) => (
                <div key={k} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2.5">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">{k.replace(/([A-Z])/g, " $1").trim()}</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Memória IA */}
      {capsule && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setCapsuleOpen((v) => !v)}
            className="w-full px-4 py-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700"
          >
            <Brain className="w-4 h-4 text-violet-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex-1 text-left">Memória ThallesZzz</h3>
            <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
              {capsule.sessionCount} sessões
            </Badge>
            {capsuleOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {capsuleOpen && (
            <div className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                {typeof capsule.capsule === "string" ? capsule.capsule : JSON.stringify(capsule.capsule, null, 2)}
              </p>
              {capsule.lastContactAt && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Último contato via chat: {formatDate(capsule.lastContactAt)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tarefas */}
      {tarefas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Tarefas</h3>
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
              {tarefas.filter((t: any) => !t.concluso).length} pendentes
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {tarefas.map((t: any) => (
              <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3", t.concluso && "opacity-50")}>
                {t.concluso ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", t.concluso ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300")}>{t.descricao}</p>
                  {t.prazo && <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(t.prazo)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline de interações */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Timeline</h3>
        </div>

        {/* Nova interação */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-2">
          <div className="flex gap-2">
            <Select value={tipoInteracao} onValueChange={setTipoInteracao}>
              <SelectTrigger className="h-8 text-xs w-32 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_INTERACAO.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={novaInteracao}
              onChange={(e) => setNovaInteracao(e.target.value)}
              placeholder="Registrar interação..."
              className="text-sm resize-none flex-1 min-h-[36px] h-[36px]"
              rows={1}
            />
            <Button
              size="sm"
              disabled={!novaInteracao.trim() || addInteracao.isPending}
              onClick={() => addInteracao.mutate()}
              className="shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {interacoes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500 text-center">Nenhuma interação registrada.</p>
          ) : (
            interacoes.map((i: any) => (
              <motion.div
                key={i.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3 px-4 py-3"
              >
                <span className="text-base mt-0.5">{tipoIcon(i.tipo)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{i.autorNome ?? "Sistema"}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(i.criadoEm)}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{i.conteudo}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Lead Score detail */}
      {score && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-3 flex items-center gap-2">
            <ScoreIcon className="w-4 h-4" />
            Lead Score IA
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", score.score >= 70 ? "bg-red-500" : score.score >= 40 ? "bg-amber-500" : "bg-blue-400")}
                  style={{ width: `${Math.min(score.score, 100)}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{Math.round(score.score)}</span>
            </div>
            <div className="flex gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span>{score.sessionCount} sessões</span>
              <span>{score.totalMessages} mensagens</span>
              <span>{Math.round((score.closingProbability ?? 0) * 100)}% prob. fechamento</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
