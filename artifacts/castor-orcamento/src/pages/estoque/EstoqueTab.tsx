import { useState, useMemo } from "react";
import { Package, RefreshCw, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ProdutoEstoqueCard } from "./ProdutoEstoqueCard";
import type { Produto } from "./constants";

export function EstoqueTab({ isDono }: { isDono: boolean }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "baixo" | "esgotado" | "ok">("todos");

  const { data: produtos = [], isLoading } = useQuery<Produto[]>({
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

  return (
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
  );
}
