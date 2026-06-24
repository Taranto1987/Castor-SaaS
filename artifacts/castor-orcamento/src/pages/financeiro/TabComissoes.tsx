import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Users, X, Percent } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/utils/currency";
import { finGet, finPost } from "./constants";
import type { ComissaoVendedor } from "./constants";

export function TabComissoes({ mes, ano, token }: { mes: number; ano: number; token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editVendedor, setEditVendedor] = useState<string | null>(null);
  const [editPct, setEditPct] = useState("");

  const { data: calculo, isLoading } = useQuery<{
    resultado: ComissaoVendedor[];
    totalComissoes: number;
    mes: number;
    ano: number;
  }>({
    queryKey: ["comissoes-calculo", mes, ano],
    queryFn: async () => {
      const res = await finGet(`/api/financeiro/comissoes/calculo?mes=${mes}&ano=${ano}`, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
  });

  const salvarPct = useMutation({
    mutationFn: async ({ vendedor: vend, percentual }: { vendedor: string; percentual: number }) => {
      const res = await finPost("/api/financeiro/comissoes", { vendedor: vend, percentual }, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes-calculo"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast({ title: "Comissão atualizada!" });
      setEditVendedor(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="font-medium">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Comissões</p>
          <p className="text-2xl font-extrabold text-purple-700">{formatBRL(calculo?.totalComissoes || 0)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 font-semibold uppercase">Vendedores</p>
          <p className="text-2xl font-extrabold text-slate-900">{calculo?.resultado.length || 0}</p>
        </div>
      </div>

      {!calculo || calculo.resultado.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-bold text-slate-600">Nenhuma venda neste período</p>
          <p className="text-sm text-slate-400 mt-1">Comissões são calculadas automaticamente sobre vendas fechadas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calculo.resultado.map(v => (
            <motion.div
              key={v.vendedor}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">{v.vendedor}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {v.vendas} venda{v.vendas !== 1 ? "s" : ""} · Total {formatBRL(v.totalVendido)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-purple-700">{formatBRL(v.comissao)}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    {editVendedor === v.vendedor ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                          value={editPct}
                          onChange={e => setEditPct(e.target.value)}
                          autoFocus
                        />
                        <button
                          onClick={() => salvarPct.mutate({ vendedor: v.vendedor, percentual: parseFloat(editPct) })}
                          className="text-xs text-emerald-600 font-bold"
                        >
                          OK
                        </button>
                        <button onClick={() => setEditVendedor(null)} className="text-xs text-slate-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditVendedor(v.vendedor); setEditPct(String(v.percentual)); }}
                        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                      >
                        <Percent className="w-3 h-3" />
                        {v.percentual}%
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
