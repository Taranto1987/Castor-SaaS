import { useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StockBadge } from "./StockBadge";
import type { Produto } from "./constants";

export function ProdutoEstoqueCard({ produto, isDono }: {
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
