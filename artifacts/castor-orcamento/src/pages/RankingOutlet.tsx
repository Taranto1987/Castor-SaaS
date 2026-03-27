import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, RefreshCw, Award, Calendar, ArrowUpCircle, X, Package
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface RankedProduct {
  id: number;
  nome: string;
  categoria: string;
  medidas?: string | null;
  custoBRL?: string | null;
  precoPix?: string | null;
  encomenda: boolean;
  totalInteresses: number;
  ultimoInteresse: string | null;
}

function parseBRL(str?: string | null): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function PromoverModal({ produto, onClose, onSave }: {
  produto: RankedProduct;
  onClose: () => void;
  onSave: (data: { estoque: number; precoPix?: string }) => void;
}) {
  const custo = parseBRL(produto.custoBRL);
  const sugestao100 = custo > 0 ? Math.ceil(custo * 2.0) : 0;
  const [estoque, setEstoque] = useState(1);
  const [preco, setPreco] = useState(sugestao100 > 0 ? String(sugestao100) : "");

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Promover para Estoque</h2>
            <p className="text-xs text-slate-400 mt-0.5">{produto.nome}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {custo > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
            <p>Custo fábrica: <span className="font-bold">{formatBRL(custo)}</span></p>
            <p>Preço Outlet (60%): <span className="font-bold">{formatBRL(Math.ceil(custo * 1.6))}</span></p>
            <p>Sugestão pronta-entrega (100%): <span className="font-bold text-emerald-700">{formatBRL(sugestao100)}</span></p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Quantidade inicial *</label>
            <input
              type="number"
              min={1}
              value={estoque}
              onChange={e => setEstoque(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Preço PIX (R$)</label>
            <input
              type="number"
              value={preco}
              onChange={e => setPreco(e.target.value)}
              placeholder={sugestao100 > 0 ? String(sugestao100) : ""}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {preco && parseFloat(preco) > 0 && custo > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600 font-semibold">Margem pronta-entrega</p>
              <p className="text-xl font-extrabold text-emerald-700">{Math.round(((parseFloat(preco) - custo) / custo) * 100)}%</p>
            </div>
            <div className="text-right text-xs text-emerald-600">
              <p>Lucro: {formatBRL(parseFloat(preco) - custo)}/un.</p>
              <p>Total ({estoque}un.): {formatBRL((parseFloat(preco) - custo) * estoque)}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
            Cancelar
          </button>
          <button
            onClick={() => {
              const precoNum = parseFloat(preco);
              const precoFormatado = precoNum > 0
                ? precoNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : undefined;
              onSave({ estoque, precoPix: precoFormatado });
            }}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all"
          >
            <ArrowUpCircle className="w-4 h-4 inline mr-1" />
            Promover
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function RankingOutlet() {
  const { toast } = useToast();
  const { user } = useAuth();
  const token = user?.sessionToken || "";
  const queryClient = useQueryClient();
  const [promovendo, setPromovendo] = useState<RankedProduct | null>(null);

  const { data: ranking = [], isLoading, refetch } = useQuery<RankedProduct[]>({
    queryKey: ["outlet-ranking"],
    queryFn: async () => {
      const res = await fetch("/api/produtos/outlet/ranking", {
        headers: { "x-session-token": token },
      });
      if (!res.ok) throw new Error("Erro ao carregar ranking");
      return res.json();
    },
  });

  const promoverMutation = useMutation({
    mutationFn: async ({ id, estoque, precoPix }: { id: number; estoque: number; precoPix?: string }) => {
      const res = await fetch(`/api/produtos/outlet/${id}/promover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ estoque, precoPix }),
      });
      if (!res.ok) throw new Error("Erro ao promover");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outlet-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["outlet-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-produtos"] });
      setPromovendo(null);
      toast({ title: "Produto promovido para estoque!" });
    },
    onError: () => toast({ title: "Erro ao promover produto", variant: "destructive" }),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Ranking Outlet
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Produtos mais pedidos por encomenda. Use para decidir o que comprar para pronta-entrega com margem maior.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-800">Inteligência de Vendas</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Cada vez que um cliente clica "Pedir" no Outlet, o interesse é registrado. Produtos com alta demanda podem ser comprados em pequena quantidade para venda com margem de 100% (pronta-entrega) em vez de 60% (encomenda).
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando ranking...</span>
        </div>
      ) : ranking.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
            <Award className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Nenhum interesse registrado ainda</p>
          <p className="text-sm text-slate-400">
            Os dados aparecem aqui conforme clientes pedem produtos no Outlet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 font-medium">{ranking.length} produto{ranking.length !== 1 ? "s" : ""} com interesse</p>
          {ranking.map((p, i) => {
            const custo = parseBRL(p.custoBRL);
            const sugestao = custo > 0 ? Math.ceil(custo * 2.0) : null;
            const precoOutlet = custo > 0 ? Math.ceil(custo * 1.6) : null;

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "bg-white border rounded-2xl overflow-hidden shadow-sm p-4",
                  i === 0 ? "border-amber-300 bg-amber-50/30" :
                  i <= 2 ? "border-amber-200" :
                  "border-slate-200"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-extrabold",
                      i === 0 ? "bg-amber-400 text-white" :
                      i <= 2 ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm leading-tight">{p.nome}</p>
                      {p.medidas && <p className="text-xs text-slate-400 mt-0.5">{p.medidas}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                        <span className="flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          <TrendingUp className="w-3 h-3" />
                          {p.totalInteresses} pedido{p.totalInteresses !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3 h-3" />
                          Último: {formatDate(p.ultimoInteresse)}
                        </span>
                      </div>
                      {custo > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>Custo: {formatBRL(custo)}</span>
                          {precoOutlet && <span>Outlet (60%): {formatBRL(precoOutlet)}</span>}
                          {sugestao && <span className="font-bold text-emerald-600">P.Entrega (100%): {formatBRL(sugestao)}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {p.encomenda && (
                    <button
                      onClick={() => setPromovendo(p)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all"
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      Promover
                    </button>
                  )}
                  {!p.encomenda && (
                    <span className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                      <Package className="w-3.5 h-3.5" />
                      Em estoque
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {promovendo && (
          <PromoverModal
            produto={promovendo}
            onClose={() => setPromovendo(null)}
            onSave={data => promoverMutation.mutate({ id: promovendo.id, ...data })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
