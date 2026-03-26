import { motion } from "framer-motion";
import { BarChart2, TrendingUp, Package, Truck, Users, RefreshCw, ShoppingBag, CheckCircle2, Percent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface DashboardData {
  totalOrcamentos: number;
  totalVendas: number;
  taxaConversao: number;
  somaPixTotal: string;
  somaPrazoTotal: string;
  somaPixVendido: string;
  totalProdutosCatalogo: number;
  topProdutos: { nome: string; count: number }[];
  porVendedor: { vendedor: string; orcamentos: number; valorPix: number; vendas: number }[];
  orcamentosPorDia: { dia: string; count: number }[];
  totalEntregas: number;
  entregasPorStatus: { pendente: number; em_rota: number; entregue: number; cancelado: number };
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

export default function Dashboard() {
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Erro ao carregar dashboard");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const maxBar = Math.max(...(data?.orcamentosPorDia.map(d => d.count) ?? [1]), 1);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-2 text-sm">Visão geral da operação comercial.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando dados...</span>
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-400">Erro ao carregar dados.</div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileText2} label="Orçamentos" value={data.totalOrcamentos} color="bg-blue-500" />
            <StatCard
              icon={CheckCircle2}
              label="Vendas fechadas"
              value={data.totalVendas}
              color="bg-emerald-500"
              sub={`${data.taxaConversao}% de conversão`}
            />
            <StatCard icon={TrendingUp} label="Receita PIX" value={data.somaPixVendido} color="bg-green-600" sub="vendas confirmadas" />
            <StatCard icon={Truck} label="Entregas" value={data.totalEntregas} color="bg-orange-500" />
          </div>

          {/* Funil de conversão */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-500" /> Funil de Conversão
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Orçamentos</span>
                    <span>{data.totalOrcamentos}</span>
                  </div>
                  <div className="h-3 bg-blue-100 rounded-full">
                    <div className="h-3 bg-blue-500 rounded-full w-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Vendas fechadas</span>
                    <span>{data.totalVendas}</span>
                  </div>
                  <div className="h-3 bg-emerald-100 rounded-full">
                    <div
                      className="h-3 bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${data.taxaConversao}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Entregas concluídas</span>
                    <span>{data.entregasPorStatus.entregue}</span>
                  </div>
                  <div className="h-3 bg-orange-100 rounded-full">
                    <div
                      className="h-3 bg-orange-500 rounded-full transition-all"
                      style={{ width: data.totalOrcamentos > 0 ? `${Math.round((data.entregasPorStatus.entregue / data.totalOrcamentos) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-center shrink-0">
                <p className="text-4xl font-black text-emerald-600">{data.taxaConversao}%</p>
                <p className="text-xs text-slate-400 font-semibold">taxa de conversão</p>
              </div>
            </div>
          </div>

          {/* Totais orçados */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={TrendingUp} label="Total orçado PIX" value={data.somaPixTotal} color="bg-slate-500" sub="todos os orçamentos" />
            <StatCard icon={Package} label="Produtos no catálogo" value={data.totalProdutosCatalogo.toLocaleString("pt-BR")} color="bg-violet-500" />
          </div>

          {/* Entregas por status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-500" /> Status das Entregas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Pendente", value: data.entregasPorStatus.pendente, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                { label: "Em rota", value: data.entregasPorStatus.em_rota, color: "bg-blue-100 text-blue-700 border-blue-200" },
                { label: "Entregue", value: data.entregasPorStatus.entregue, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                { label: "Cancelado", value: data.entregasPorStatus.cancelado, color: "bg-red-100 text-red-700 border-red-200" },
              ].map(s => (
                <div key={s.label} className={cn("rounded-xl border p-3 text-center", s.color)}>
                  <p className="text-2xl font-extrabold">{s.value}</p>
                  <p className="text-xs font-semibold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Orçamentos por dia */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" /> Orçamentos — Últimos 7 dias
            </h2>
            <div className="flex items-end gap-2 h-32">
              {data.orcamentosPorDia.map((d) => (
                <div key={d.dia} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-slate-600">{d.count > 0 ? d.count : ""}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t-lg transition-all"
                    style={{ height: `${Math.max((d.count / maxBar) * 96, d.count > 0 ? 8 : 2)}px` }}
                  />
                  <span className="text-[10px] text-slate-400">{d.dia}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Top produtos */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-violet-500" /> Produtos Mais Orçados
              </h2>
              {data.topProdutos.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum dado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {data.topProdutos.map((p, i) => (
                    <div key={p.nome} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{p.nome}</p>
                      </div>
                      <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                        {p.count}x
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por vendedor */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" /> Por Vendedor
              </h2>
              {data.porVendedor.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum dado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {data.porVendedor.map((v) => (
                    <div key={v.vendedor} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{v.vendedor}</p>
                        <p className="text-xs text-slate-400">
                          {v.orcamentos} orç. · {v.vendas ?? 0} venda{(v.vendas ?? 0) !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-700">
                          {v.valorPix.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                        {v.orcamentos > 0 && (
                          <p className="text-[10px] text-slate-400">
                            {Math.round(((v.vendas ?? 0) / v.orcamentos) * 100)}% conv.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FileText2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
