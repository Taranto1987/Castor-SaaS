import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, DollarSign, MessageSquare, Users, Zap, RefreshCw, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface ResumoGeral {
  total_requests: number;
  total_input: number;
  total_output: number;
  custo_total_usd: number;
  primeiro_registro: string | null;
  ultimo_registro: string | null;
}

interface PorContexto {
  contexto: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  custo_usd: number;
}

interface PorModelo {
  modelo: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  custo_usd: number;
}

interface PorDia {
  dia: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  custo_usd: number;
}

interface AICustosData {
  periodo_dias: number;
  resumo: ResumoGeral | null;
  por_dia: PorDia[];
  por_contexto: PorContexto[];
  por_modelo: PorModelo[];
}

const CONTEXTO_LABELS: Record<string, { label: string; icon: React.ElementType; color: string; descricao: string }> = {
  chat:           { label: "Chat (ThallesZzz)",    icon: MessageSquare, color: "bg-pink-600",   descricao: "Assistente de vendas no site" },
  lead:           { label: "Extrator de Leads",    icon: Users,         color: "bg-amber-600",  descricao: "Extrai nome/telefone/produtos da conversa" },
  "lead-context": { label: "Contexto CRM",         icon: TrendingUp,    color: "bg-blue-600",   descricao: "Gera resumo comercial do lead" },
  capsule:        { label: "Capsula de Memoria",   icon: Brain,         color: "bg-purple-600", descricao: "Perfil psicologico/relacional do cliente" },
  waha:           { label: "WhatsApp (WAHA)",      icon: Zap,           color: "bg-green-600",  descricao: "Atendimento automatizado via WhatsApp" },
};

function formatUSD(value: number | null | undefined): string {
  if (value == null) return "USD 0,00";
  return `USD ${value.toFixed(4)}`;
}

function formatTokens(value: number | null | undefined): string {
  if (value == null) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

function CustoBar({ label, custo, maxCusto, requests, color }: {
  label: string; custo: number; maxCusto: number; requests: number; color: string;
}) {
  const pct = maxCusto > 0 ? (custo / maxCusto) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{formatUSD(custo)} · {requests} req</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AICustos() {
  const { user } = useAuth();
  const [dias, setDias] = useState(30);

  const { data, isLoading, refetch } = useQuery<AICustosData>({
    queryKey: ["ai-custos", dias],
    queryFn: async () => {
      const res = await fetch(`/api/ai-custos?dias=${dias}`, {
        headers: { "x-session-token": user?.sessionToken || "" },
      });
      if (!res.ok) throw new Error("Falha ao carregar custos");
      return res.json();
    },
  });

  const resumo = data?.resumo;
  const maxCustoContexto = Math.max(...(data?.por_contexto?.map(c => c.custo_usd) ?? [0]));
  const maxCustoModelo = Math.max(...(data?.por_modelo?.map(m => m.custo_usd) ?? [0]));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            Custos de IA
          </h1>
          <p className="text-sm text-slate-500 mt-1">Rastreamento de uso e custo da API Anthropic</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dias}
            onChange={e => setDias(Number(e.target.value))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          >
            <RefreshCw className={cn("w-4 h-4 text-slate-500", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="Custo Total"
              value={formatUSD(resumo?.custo_total_usd)}
              color="bg-red-600"
              sub={`${dias} dias`}
            />
            <StatCard
              icon={MessageSquare}
              label="Requisicoes"
              value={resumo?.total_requests ?? 0}
              color="bg-blue-600"
              sub={resumo?.total_requests ? `~${formatUSD((resumo.custo_total_usd ?? 0) / resumo.total_requests)}/req` : undefined}
            />
            <StatCard
              icon={Zap}
              label="Tokens Input"
              value={formatTokens(resumo?.total_input)}
              color="bg-amber-600"
            />
            <StatCard
              icon={Zap}
              label="Tokens Output"
              value={formatTokens(resumo?.total_output)}
              color="bg-green-600"
            />
          </div>

          {/* Custo por Feature */}
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
                Custo por Feature
              </h2>
              <div className="space-y-4">
                {(data.por_contexto ?? []).map(c => {
                  const meta = CONTEXTO_LABELS[c.contexto] ?? {
                    label: c.contexto ?? "desconhecido",
                    color: "bg-slate-600",
                  };
                  return (
                    <div key={c.contexto}>
                      <CustoBar
                        label={meta.label}
                        custo={c.custo_usd}
                        maxCusto={maxCustoContexto}
                        requests={c.requests}
                        color={meta.color}
                      />
                      {"descricao" in meta && (
                        <p className="text-xs text-slate-400 mt-0.5 ml-1">{(meta as any).descricao}</p>
                      )}
                    </div>
                  );
                })}
                {(data.por_contexto ?? []).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Sem dados no periodo</p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
                Custo por Modelo
              </h2>
              <div className="space-y-4">
                {(data.por_modelo ?? []).map(m => (
                  <CustoBar
                    key={m.modelo}
                    label={m.modelo}
                    custo={m.custo_usd}
                    maxCusto={maxCustoModelo}
                    requests={m.requests}
                    color={m.modelo.includes("sonnet") ? "bg-pink-600" : "bg-emerald-600"}
                  />
                ))}
                {(data.por_modelo ?? []).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Sem dados no periodo</p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Tabela diaria */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
              Custo Diario
            </h2>
            {(data.por_dia ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-4">Dia</th>
                      <th className="py-2 pr-4 text-right">Requests</th>
                      <th className="py-2 pr-4 text-right">Input</th>
                      <th className="py-2 pr-4 text-right">Output</th>
                      <th className="py-2 text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.por_dia.map(d => (
                      <tr key={d.dia} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 pr-4 font-medium text-slate-700">
                          {new Date(d.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="py-2 pr-4 text-right text-slate-600">{d.requests}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{formatTokens(d.input_tokens)}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{formatTokens(d.output_tokens)}</td>
                        <td className="py-2 text-right font-semibold text-slate-900">{formatUSD(d.custo_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Sem dados no periodo</p>
            )}
          </motion.div>

          {/* Legenda de features */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-50 border border-slate-200 rounded-2xl p-5"
          >
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
              O que cada feature faz
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(CONTEXTO_LABELS).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <div key={key} className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", meta.color)}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{meta.label}</p>
                      <p className="text-xs text-slate-500">{meta.descricao}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
