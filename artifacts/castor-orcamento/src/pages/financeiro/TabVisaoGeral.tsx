import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Send, RefreshCw, Users, BarChart2, MessageCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/utils/currency";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend
} from "recharts";
import { finGet } from "./constants";
import type { DREData, Alerta, ResumoDiario } from "./constants";

export function TabVisaoGeral({ mes, ano, token }: { mes: number; ano: number; token: string }) {
  const { data: dre, isLoading: dreLoading } = useQuery<DREData>({
    queryKey: ["dre", mes, ano],
    queryFn: async () => {
      const res = await finGet(`/api/financeiro/dre?mes=${mes}&ano=${ano}`, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
  });

  const { data: alertas } = useQuery<Alerta[]>({
    queryKey: ["alertas"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/alertas", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: resumo, refetch: refetchResumo, isLoading: resumoLoading } = useQuery<ResumoDiario>({
    queryKey: ["resumo-diario"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/resumo-diario", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const { data: evolucao } = useQuery<{
    label: string;
    faturamento: number;
    despesas: number;
    lucro: number;
  }[]>({
    queryKey: ["evolucao"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/evolucao?meses=6", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleWhatsApp = () => {
    if (!resumo) return;
    const texto = encodeURIComponent(resumo.texto);
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  };

  if (dreLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="font-medium">Carregando...</span>
      </div>
    );
  }

  if (!dre) return <p className="text-sm text-slate-400 py-10 text-center">Erro ao carregar dados.</p>;

  return (
    <div className="space-y-5">
      {alertas && alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border",
                a.tipo === "meta" ? "bg-red-50 border-red-200" :
                  a.tipo === "followup" ? "bg-amber-50 border-amber-200" :
                    a.tipo === "margem" ? "bg-yellow-50 border-yellow-200" :
                      "bg-orange-50 border-orange-200"
              )}
            >
              <AlertTriangle className={cn(
                "w-5 h-5 shrink-0 mt-0.5",
                a.tipo === "meta" ? "text-red-500" :
                  a.tipo === "followup" ? "text-amber-500" :
                    a.tipo === "margem" ? "text-yellow-500" : "text-orange-500"
              )} />
              <div>
                <p className="text-sm font-bold text-slate-800">{a.titulo}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.descricao}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Receita</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatBRL(dre.receitaBruta)}</p>
          <p className="text-xs text-slate-400">{dre.totalVendas} vendas</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center mb-2">
            <TrendingDown className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Despesas</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatBRL(dre.totalDespesas)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-500 flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Comissões</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatBRL(dre.totalComissoes)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", dre.lucroLiquido >= 0 ? "bg-emerald-500" : "bg-red-500")}>
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Lucro Líquido</p>
          <p className={cn("text-xl font-extrabold mt-1", dre.lucroLiquido >= 0 ? "text-emerald-700" : "text-red-600")}>{formatBRL(dre.lucroLiquido)}</p>
        </div>
      </div>

      {Object.keys(dre.despesasPorCategoria).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" /> Despesas por Categoria
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(dre.despesasPorCategoria).map(([cat, val]) => ({ categoria: cat, valor: val }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="categoria" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {Object.entries(dre.despesasPorCategoria).map((_, i) => (
                    <Cell key={i} fill={["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316", "#ec4899", "#6366f1", "#14b8a6", "#84cc16", "#a855f7"][i % 12]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {evolucao && evolucao.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Evolução Mensal
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-500" /> Resumo Diário
          </h3>
          <button
            onClick={() => refetchResumo()}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <RefreshCw className={cn("w-3 h-3", resumoLoading && "animate-spin")} />
            Atualizar
          </button>
        </div>

        {resumo ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-slate-900">{resumo.vendas}</p>
                <p className="text-xs text-slate-500">Vendas</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-emerald-700">{formatBRL(resumo.totalFaturado)}</p>
                <p className="text-xs text-slate-500">Faturado</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-slate-900">{resumo.orcamentosDia}</p>
                <p className="text-xs text-slate-500">Orçamentos</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={cn("text-lg font-extrabold", resumo.lucroDia >= 0 ? "text-emerald-700" : "text-red-600")}>{formatBRL(resumo.lucroDia)}</p>
                <p className="text-xs text-slate-500">Lucro dia</p>
              </div>
            </div>
            <button
              onClick={handleWhatsApp}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Send className="w-4 h-4" />
              Enviar Resumo via WhatsApp
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">Carregando resumo...</p>
        )}
      </div>
    </div>
  );
}
