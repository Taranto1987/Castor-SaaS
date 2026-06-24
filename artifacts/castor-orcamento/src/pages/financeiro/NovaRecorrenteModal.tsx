import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { finPost } from "./constants";

export function NovaRecorrenteModal({ onClose, categorias, token }: { onClose: () => void; categorias: string[]; token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(categorias[0] || "Outros");
  const [descricao, setDescricao] = useState("");
  const [dia, setDia] = useState("1");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await finPost("/api/financeiro/despesas-recorrentes", { valor: parseFloat(valor), categoria, descricao, diaVencimento: parseInt(dia) }, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-recorrentes"] });
      toast({ title: "Despesa recorrente criada!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao criar", variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Despesa Recorrente</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <p className="text-xs text-slate-400">Será gerada automaticamente todo mês para você confirmar.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Categoria</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
            >
              {categorias.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Descrição</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ex: Aluguel loja"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Dia do vencimento</label>
            <input
              type="number"
              min="1"
              max="31"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={dia}
              onChange={e => setDia(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!valor || parseFloat(valor) <= 0 || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {mutation.isPending ? "Salvando..." : "Criar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
