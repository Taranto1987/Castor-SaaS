import { useState, useMemo } from "react";
import { Package, RefreshCw, Search, ShoppingCart, Store, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ProdutoModoRow } from "./ProdutoModoRow";
import { CAT_LABELS } from "./constants";
import type { ProdutoGestao, PricingConfig } from "./constants";

export function GestaoModosTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [catGestao, setCatGestao] = useState("todos");
  const [buscaGestao, setBuscaGestao] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [editingPricing, setEditingPricing] = useState(false);
  const [markupInput, setMarkupInput] = useState<string>("");
  const [discountInput, setDiscountInput] = useState<string>("");

  const lojaId = 1;

  const { data: pricingConfig = { supplierDiscountPercent: 32.5, outletMarkupPercent: 60 }, refetch: refetchPricing } = useQuery<PricingConfig>({
    queryKey: ["loja-pricing", lojaId],
    queryFn: async () => {
      const res = await fetch(`/api/loja/${lojaId}/pricing`, {
        headers: { "x-session-token": user?.sessionToken ?? "" },
      });
      if (!res.ok) return { supplierDiscountPercent: 32.5, outletMarkupPercent: 60 };
      return res.json();
    },
  });

  const savePricing = useMutation({
    mutationFn: async (cfg: Partial<PricingConfig>) => {
      const res = await fetch(`/api/loja/${lojaId}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": user?.sessionToken ?? "" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      refetchPricing();
      setEditingPricing(false);
      toast({ title: "Configuração de pricing salva!" });
    },
    onError: () => toast({ title: "Erro ao salvar pricing", variant: "destructive" }),
  });

  const { data: todosProdutos = [], isLoading: isLoadingGestao } = useQuery<ProdutoGestao[]>({
    queryKey: ["gestao-produtos", catGestao, buscaGestao],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (catGestao !== "todos") params.set("categoria", catGestao);
      if (buscaGestao.trim()) params.set("busca", buscaGestao.trim());
      const res = await fetch(`/api/produtos/gestao?${params}`, {
        headers: { "x-session-token": user?.sessionToken ?? "" },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
  });

  const categorias = useMemo(() => {
    return [...new Set(todosProdutos.map(p => p.categoria))].sort();
  }, [todosProdutos]);

  const produtosFiltrados = useMemo(() => {
    if (catGestao === "todos") return todosProdutos;
    return todosProdutos.filter(p => p.categoria === catGestao);
  }, [todosProdutos, catGestao]);

  const toggleModo = async (id: number, encomenda: boolean) => {
    setPendingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/produtos/${id}/encomenda`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encomenda,
          ...(encomenda ? { outletMarkupPercent: pricingConfig.outletMarkupPercent } : {}),
        }),
      });
      if (!res.ok) throw new Error("Erro");
      const updated = await res.json();
      queryClient.setQueryData<ProdutoGestao[]>(
        ["gestao-produtos", catGestao, buscaGestao],
        prev => prev?.map(p => p.id === id ? {
          ...p,
          encomenda,
          factoryCost: updated.factoryCost,
          outletPrice: updated.outletPrice,
          outletMarkupPercent: updated.outletMarkupPercent,
        } : p) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ["estoque-produtos"] });
    } catch {
      toast({ title: "Erro ao atualizar modo", variant: "destructive" });
    } finally {
      setPendingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const bulkMoverCategoria = async (encomenda: boolean) => {
    const ids = produtosFiltrados
      .filter(p => p.encomenda !== encomenda)
      .map(p => p.id);
    if (ids.length === 0) return;
    ids.forEach(id => setPendingIds(prev => new Set(prev).add(id)));
    try {
      const res = await fetch("/api/produtos/gestao/bulk-encomenda", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": user?.sessionToken ?? "",
        },
        body: JSON.stringify({
          ids,
          encomenda,
          ...(encomenda ? { outletMarkupPercent: pricingConfig.outletMarkupPercent } : {}),
        }),
      });
      if (!res.ok) throw new Error("Erro");
      queryClient.setQueryData<ProdutoGestao[]>(
        ["gestao-produtos", catGestao, buscaGestao],
        prev => prev?.map(p => ids.includes(p.id) ? { ...p, encomenda } : p) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ["estoque-produtos"] });
      toast({ title: `${ids.length} produtos movidos para ${encomenda ? "Outlet" : "Catálogo"}` });
    } catch {
      toast({ title: "Erro na operação em massa", variant: "destructive" });
    } finally {
      setPendingIds(new Set());
    }
  };

  const modoStats = useMemo(() => ({
    catalogo: produtosFiltrados.filter(p => !p.encomenda).length,
    outlet: produtosFiltrados.filter(p => p.encomenda).length,
  }), [produtosFiltrados]);

  return (
    <>
      {/* Pricing engine config panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">Pricing Engine — Outlet</p>
          {!editingPricing ? (
            <button
              onClick={() => {
                setMarkupInput(String(pricingConfig.outletMarkupPercent));
                setDiscountInput(String(pricingConfig.supplierDiscountPercent));
                setEditingPricing(true);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingPricing(false)}
                className="text-xs text-slate-400 px-2 py-1 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => savePricing.mutate({
                  supplierDiscountPercent: parseFloat(discountInput),
                  outletMarkupPercent: parseFloat(markupInput),
                })}
                disabled={savePricing.isPending}
                className="text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savePricing.isPending ? "..." : "Salvar"}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Desconto Castor</p>
            {editingPricing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  className="w-16 text-sm font-bold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
            ) : (
              <p className="text-xl font-extrabold text-slate-900">{pricingConfig.supplierDiscountPercent}%</p>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">off tabela indústria</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-[10px] text-orange-500 font-medium uppercase tracking-wide mb-1">Markup Outlet</p>
            {editingPricing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={markupInput}
                  onChange={e => setMarkupInput(e.target.value)}
                  className="w-16 text-sm font-bold border border-orange-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
                <span className="text-sm text-orange-500">%</span>
              </div>
            ) : (
              <p className="text-xl font-extrabold text-orange-700">{pricingConfig.outletMarkupPercent}%</p>
            )}
            <p className="text-[10px] text-orange-400 mt-0.5">sobre custo real</p>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-500 flex items-center gap-2">
          <span className="font-mono text-slate-400">Tabela</span>
          <span>→ −{pricingConfig.supplierDiscountPercent}% →</span>
          <span className="font-mono text-slate-400">Custo real</span>
          <span>→ +{pricingConfig.outletMarkupPercent}% →</span>
          <span className="font-bold text-orange-600">Preço outlet</span>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <Store className="w-6 h-6 text-blue-600 shrink-0" />
          <div>
            <p className="text-2xl font-extrabold text-blue-700">{modoStats.catalogo}</p>
            <p className="text-xs text-blue-500 font-medium">No Catálogo</p>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-orange-500 shrink-0" />
          <div>
            <p className="text-2xl font-extrabold text-orange-600">{modoStats.outlet}</p>
            <p className="text-xs text-orange-400 font-medium">No Outlet</p>
          </div>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={buscaGestao}
            onChange={e => setBuscaGestao(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCatGestao("todos")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
              catGestao === "todos"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
          >
            Todos ({todosProdutos.length})
          </button>
          {categorias.map(cat => {
            const count = todosProdutos.filter(p => p.categoria === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setCatGestao(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                  catGestao === cat
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
              >
                {CAT_LABELS[cat] ?? cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Bulk actions */}
        {catGestao !== "todos" && produtosFiltrados.length > 0 && (
          <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-600 font-semibold flex-1">
              {produtosFiltrados.length} produtos em {CAT_LABELS[catGestao] ?? catGestao}
            </span>
            <button
              onClick={() => bulkMoverCategoria(false)}
              disabled={modoStats.catalogo === produtosFiltrados.length}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-40"
            >
              Todos → Catálogo
            </button>
            <button
              onClick={() => bulkMoverCategoria(true)}
              disabled={modoStats.outlet === produtosFiltrados.length}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-all disabled:opacity-40"
            >
              Todos → Outlet
            </button>
          </div>
        )}
      </div>

      {isLoadingGestao ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando catálogo...</span>
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Package className="w-10 h-10 text-slate-300" />
          <p className="font-bold text-slate-600">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {produtosFiltrados.map(p => (
            <ProdutoModoRow
              key={p.id}
              produto={p}
              onToggle={toggleModo}
              isPending={pendingIds.has(p.id)}
              pricingConfig={pricingConfig}
            />
          ))}
        </div>
      )}
    </>
  );
}
