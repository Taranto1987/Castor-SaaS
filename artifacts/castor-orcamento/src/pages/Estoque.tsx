import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Package, RefreshCw, Search, Minus, Plus, AlertTriangle, Check,
  ShoppingCart, Store, ChevronRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Produto {
  id: number;
  nome: string;
  categoria: string;
  medidas?: string | null;
  estoque: number | null;
  disponivel: boolean;
  encomenda: boolean;
}

interface ProdutoGestao {
  id: number;
  nome: string;
  sku?: string | null;
  categoria: string;
  medidas?: string | null;
  size?: string | null;
  familyName?: string | null;
  encomenda: boolean;
  prazoEncomenda?: string | null;
  precoBase?: number | null;
  factoryCost?: number | null;
  outletMarkupPercent?: number | null;
  outletPrice?: number | null;
}

interface PricingConfig {
  supplierDiscountPercent: number;
  outletMarkupPercent: number;
}

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcPreview(precoBase: number, supplierDiscount: number, markup: number) {
  const factoryCost = precoBase * (1 - supplierDiscount / 100);
  const outletPrice = factoryCost * (1 + markup / 100);
  return { factoryCost, outletPrice };
}

const CAT_LABELS: Record<string, string> = {
  "colchoes": "Colchões",
  "cama-box": "Cama Box",
  "cama-box-colchao": "Box + Colchão",
  "travesseiros": "Travesseiros",
  "roupa-de-cama": "Roupa de Cama",
  "protetor": "Protetores",
};

function StockBadge({ estoque }: { estoque: number | null }) {
  if (estoque === null) return (
    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
      Sem controle
    </span>
  );
  if (estoque === 0) return (
    <span className="text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
      <AlertTriangle className="w-2.5 h-2.5" /> Esgotado
    </span>
  );
  if (estoque <= 3) return (
    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
      Baixo: {estoque}
    </span>
  );
  return (
    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
      <Check className="w-2.5 h-2.5" /> {estoque} un.
    </span>
  );
}

function ProdutoEstoqueCard({ produto, isDono }: {
  produto: Produto;
  isDono: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editValue, setEditValue] = useState<number | null>(null);
  const editing = editValue !== null;
  const currentStock = produto.estoque ?? 0;

  const mutation = useMutation({
    mutationFn: async (novoEstoque: number) => {
      const res = await fetch(`/api/produtos/${produto.id}/estoque`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estoque: novoEstoque }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-produtos"] });
      setEditValue(null);
      toast({ title: "Estoque atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar estoque", variant: "destructive" }),
  });

  const startEdit = () => setEditValue(currentStock);
  const save = () => { if (editValue !== null) mutation.mutate(editValue); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white border rounded-2xl overflow-hidden shadow-sm transition-all",
        produto.estoque === 0 ? "border-red-200 bg-red-50/30" :
        produto.estoque !== null && produto.estoque <= 3 ? "border-amber-200" :
        "border-slate-200"
      )}
    >
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-slate-900 text-sm leading-tight truncate">{produto.nome}</span>
            <StockBadge estoque={produto.estoque} />
          </div>
          {produto.medidas && (
            <p className="text-xs text-slate-400">{produto.medidas}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{produto.categoria}</p>
        </div>

        {isDono && !editing && (
          <button
            onClick={startEdit}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all"
          >
            Ajustar
          </button>
        )}

        {isDono && editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditValue(Math.max(0, (editValue ?? 0) - 1))}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
            >
              <Minus className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <input
              type="number"
              min={0}
              value={editValue ?? 0}
              onChange={e => setEditValue(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-14 text-center border border-slate-200 rounded-lg py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              onClick={() => setEditValue((editValue ?? 0) + 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <button
              onClick={save}
              disabled={mutation.isPending}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {mutation.isPending ? "..." : "Salvar"}
            </button>
            <button
              onClick={() => setEditValue(null)}
              className="px-2 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ProdutoModoRow({
  produto,
  onToggle,
  isPending,
  pricingConfig,
}: {
  produto: ProdutoGestao;
  onToggle: (id: number, encomenda: boolean) => void;
  isPending: boolean;
  pricingConfig: PricingConfig;
}) {
  const isOutlet = produto.encomenda;
  const label = produto.familyName ?? produto.nome;

  const previewOutlet = produto.precoBase && !isOutlet
    ? calcPreview(produto.precoBase, pricingConfig.supplierDiscountPercent, pricingConfig.outletMarkupPercent)
    : null;

  const currentOutletPrice = produto.outletPrice ?? (
    produto.precoBase && isOutlet
      ? calcPreview(produto.precoBase, pricingConfig.supplierDiscountPercent, pricingConfig.outletMarkupPercent).outletPrice
      : null
  );

  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 border rounded-xl transition-colors",
      isOutlet ? "bg-orange-50/50 border-orange-100" : "bg-white border-slate-100"
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {label}
          {produto.size && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">{produto.size}</span>
          )}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {produto.medidas && <p className="text-[11px] text-slate-400">{produto.medidas}</p>}
          {isOutlet && currentOutletPrice && (
            <span className="text-[11px] font-bold text-orange-600">{formatBRL(currentOutletPrice)}</span>
          )}
          {!isOutlet && previewOutlet && (
            <span className="text-[11px] text-slate-300">→ outlet: {formatBRL(previewOutlet.outletPrice)}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          disabled={isPending || !isOutlet}
          onClick={() => onToggle(produto.id, false)}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
            !isOutlet
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-400 border-slate-200 hover:border-blue-300 hover:text-blue-600 cursor-pointer"
          )}
        >
          <Store className="w-3 h-3 inline mr-0.5" />
          Catálogo
        </button>
        <button
          disabled={isPending || isOutlet}
          onClick={() => onToggle(produto.id, true)}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
            isOutlet
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-slate-400 border-slate-200 hover:border-orange-300 hover:text-orange-500 cursor-pointer"
          )}
        >
          <ShoppingCart className="w-3 h-3 inline mr-0.5" />
          Outlet
        </button>
      </div>
    </div>
  );
}

export default function Estoque() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDono = user?.papel === "dono";
  const [aba, setAba] = useState<"estoque" | "modos">("estoque");

  // ── Estoque tab state ──────────────────────────────────────────────────────
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "baixo" | "esgotado" | "ok">("todos");

  const { data: produtos = [], isLoading, refetch } = useQuery<Produto[]>({
    queryKey: ["estoque-produtos"],
    queryFn: async () => {
      const res = await fetch(`/api/produtos/estoque`);
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    let list = produtos.filter(p => !p.encomenda);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(q) || (p.categoria?.toLowerCase().includes(q)));
    }
    switch (filtro) {
      case "esgotado": list = list.filter(p => p.estoque === 0); break;
      case "baixo": list = list.filter(p => p.estoque !== null && p.estoque > 0 && p.estoque <= 3); break;
      case "ok": list = list.filter(p => p.estoque === null || p.estoque > 3); break;
    }
    return list.sort((a, b) => {
      if (a.estoque === 0 && b.estoque !== 0) return -1;
      if (b.estoque === 0 && a.estoque !== 0) return 1;
      if (a.estoque !== null && b.estoque !== null && a.estoque <= 3 && b.estoque > 3) return -1;
      if (a.estoque !== null && b.estoque !== null && b.estoque <= 3 && a.estoque > 3) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtos, busca, filtro]);

  const stats = useMemo(() => {
    const nonEnc = produtos.filter(p => !p.encomenda);
    const tracked = nonEnc.filter(p => p.estoque !== null);
    return {
      total: nonEnc.length,
      esgotado: tracked.filter(p => p.estoque === 0).length,
      baixo: tracked.filter(p => p.estoque! > 0 && p.estoque! <= 3).length,
      ok: tracked.filter(p => p.estoque! > 3).length,
      sem: nonEnc.filter(p => p.estoque === null).length,
    };
  }, [produtos]);

  const filtroOpts = [
    { key: "todos" as const, label: "Todos", count: stats.total },
    { key: "esgotado" as const, label: "Esgotado", count: stats.esgotado },
    { key: "baixo" as const, label: "Baixo", count: stats.baixo },
    { key: "ok" as const, label: "OK", count: stats.ok + stats.sem },
  ];

  // ── Gestão de Modos tab state ──────────────────────────────────────────────
  const [catGestao, setCatGestao] = useState("todos");
  const [buscaGestao, setBuscaGestao] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [editingPricing, setEditingPricing] = useState(false);
  const [markupInput, setMarkupInput] = useState<string>("");
  const [discountInput, setDiscountInput] = useState<string>("");

  const lojaId = user?.papel === "dono" ? 1 : null; // loja 1 = Cabo Frio default

  const { data: pricingConfig = { supplierDiscountPercent: 32.5, outletMarkupPercent: 60 }, refetch: refetchPricing } = useQuery<PricingConfig>({
    queryKey: ["loja-pricing", lojaId],
    queryFn: async () => {
      const res = await fetch(`/api/loja/${lojaId}/pricing`, {
        headers: { "x-session-token": user?.sessionToken ?? "" },
      });
      if (!res.ok) return { supplierDiscountPercent: 32.5, outletMarkupPercent: 60 };
      return res.json();
    },
    enabled: aba === "modos" && isDono && lojaId !== null,
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

  const { data: todosProdutos = [], isLoading: isLoadingGestao, refetch: refetchGestao } = useQuery<ProdutoGestao[]>({
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
    enabled: aba === "modos" && isDono,
  });

  const categorias = useMemo(() => {
    const cats = [...new Set(todosProdutos.map(p => p.categoria))].sort();
    return cats;
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
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Estoque
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Controle de quantidades e gestão do catálogo.
          </p>
        </div>
        <button
          onClick={() => aba === "estoque" ? refetch() : refetchGestao()}
          className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", (isLoading || isLoadingGestao) && "animate-spin")} />
        </button>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setAba("estoque")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
            aba === "estoque" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Estoque
        </button>
        {isDono && (
          <button
            onClick={() => setAba("modos")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              aba === "modos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Catálogo / Outlet
          </button>
        )}
      </div>

      {/* ── Aba Estoque ──────────────────────────────────────────────────────── */}
      {aba === "estoque" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-400 font-medium">Total produtos</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-red-600">{stats.esgotado}</p>
              <p className="text-xs text-red-400 font-medium">Esgotados</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-amber-600">{stats.baixo}</p>
              <p className="text-xs text-amber-400 font-medium">Estoque baixo</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-emerald-600">{stats.ok}</p>
              <p className="text-xs text-emerald-400 font-medium">OK</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="flex gap-1.5">
              {filtroOpts.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold transition-all",
                    filtro === f.key
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin" />
              <span className="font-medium">Carregando estoque...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-bold text-slate-600">Nenhum produto encontrado</p>
              <p className="text-sm text-slate-400">Tente alterar os filtros de busca.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500 font-medium">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>
              {filtered.map(p => (
                <ProdutoEstoqueCard key={p.id} produto={p} isDono={isDono} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Aba Catálogo / Outlet ─────────────────────────────────────────────── */}
      {aba === "modos" && isDono && (
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

            {/* Bulk actions for selected category */}
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
      )}
    </div>
  );
}
