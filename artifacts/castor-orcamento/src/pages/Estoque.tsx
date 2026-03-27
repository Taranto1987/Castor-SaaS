import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Package, RefreshCw, Search, Minus, Plus, AlertTriangle, Check
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
  if (estoque <= 2) return (
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
        produto.estoque !== null && produto.estoque <= 2 ? "border-amber-200" :
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

export default function Estoque() {
  const { user } = useAuth();
  const isDono = user?.papel === "dono";
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "baixo" | "esgotado" | "ok">("todos");

  const { data: produtos = [], isLoading, refetch } = useQuery<Produto[]>({
    queryKey: ["estoque-produtos"],
    queryFn: async () => {
      const res = await fetch(`/api/produtos?interno=1`);
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
      case "baixo": list = list.filter(p => p.estoque !== null && p.estoque > 0 && p.estoque <= 2); break;
      case "ok": list = list.filter(p => p.estoque === null || p.estoque > 2); break;
    }

    return list.sort((a, b) => {
      if (a.estoque === 0 && b.estoque !== 0) return -1;
      if (b.estoque === 0 && a.estoque !== 0) return 1;
      if (a.estoque !== null && b.estoque !== null && a.estoque <= 2 && b.estoque > 2) return -1;
      if (a.estoque !== null && b.estoque !== null && b.estoque <= 2 && a.estoque > 2) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtos, busca, filtro]);

  const stats = useMemo(() => {
    const nonEnc = produtos.filter(p => !p.encomenda);
    const tracked = nonEnc.filter(p => p.estoque !== null);
    return {
      total: nonEnc.length,
      esgotado: tracked.filter(p => p.estoque === 0).length,
      baixo: tracked.filter(p => p.estoque! > 0 && p.estoque! <= 2).length,
      ok: tracked.filter(p => p.estoque! > 2).length,
      sem: nonEnc.filter(p => p.estoque === null).length,
    };
  }, [produtos]);

  const filtroOpts = [
    { key: "todos" as const, label: "Todos", count: stats.total },
    { key: "esgotado" as const, label: "Esgotado", count: stats.esgotado },
    { key: "baixo" as const, label: "Baixo", count: stats.baixo },
    { key: "ok" as const, label: "OK", count: stats.ok + stats.sem },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Controle de Estoque
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Gerencie a quantidade de cada produto em loja. Baixa automática ao fechar venda.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

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
    </div>
  );
}
