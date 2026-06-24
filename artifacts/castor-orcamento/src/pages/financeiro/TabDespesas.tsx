import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, RefreshCw, Check, Calendar, Receipt, Upload, Image } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/utils/currency";
import { finGet, finPost, finPut, finDelete } from "./constants";
import { NovaDespesaModal } from "./NovaDespesaModal";
import { NovaRecorrenteModal } from "./NovaRecorrenteModal";
import type { Despesa, DespesaRecorrente } from "./constants";

export function TabDespesas({ mes, ano, token }: { mes: number; ano: number; token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showNova, setShowNova] = useState(false);
  const [showRecorrente, setShowRecorrente] = useState(false);

  const { data: categorias } = useQuery<string[]>({
    queryKey: ["categorias-despesa"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/categorias-despesa", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: Infinity,
  });

  const { data: despesas, isLoading } = useQuery<Despesa[]>({
    queryKey: ["despesas", mes, ano],
    queryFn: async () => {
      const res = await finGet(`/api/financeiro/despesas?mes=${mes}&ano=${ano}`, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
  });

  const { data: recorrentes } = useQuery<DespesaRecorrente[]>({
    queryKey: ["despesas-recorrentes"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/despesas-recorrentes", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
  });

  const gerarRecorrentes = useMutation({
    mutationFn: async () => {
      const res = await finPost("/api/financeiro/gerar-recorrentes", { mes, ano }, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: (data: { geradas: number }) => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      toast({ title: data.geradas > 0 ? `${data.geradas} despesa(s) gerada(s)!` : "Nenhuma nova despesa para gerar." });
    },
  });

  const confirmarDespesa = useMutation({
    mutationFn: async (id: number) => {
      const res = await finPut(`/api/financeiro/despesas/${id}`, { confirmada: true }, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast({ title: "Despesa confirmada!" });
    },
  });

  const deletarDespesa = useMutation({
    mutationFn: async (id: number) => {
      const res = await finDelete(`/api/financeiro/despesas/${id}`, token);
      if (!res.ok) throw new Error("Erro");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast({ title: "Despesa removida!" });
    },
  });

  const removerRecorrente = useMutation({
    mutationFn: async (id: number) => {
      const res = await finDelete(`/api/financeiro/despesas-recorrentes/${id}`, token);
      if (!res.ok) throw new Error("Erro");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-recorrentes"] });
      toast({ title: "Recorrente removida!" });
    },
  });

  const totalMes = despesas?.reduce((s, d) => s + parseFloat(d.valor), 0) || 0;
  const pendentes = despesas?.filter(d => !d.confirmada) || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowNova(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Despesa
        </button>
        <button
          onClick={() => setShowRecorrente(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all"
        >
          <Calendar className="w-4 h-4" /> Recorrente
        </button>
        <button
          onClick={() => gerarRecorrentes.mutate()}
          disabled={gerarRecorrentes.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", gerarRecorrentes.isPending && "animate-spin")} /> Gerar do mês
        </button>
      </div>

      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Total do mês</p>
          <p className="text-2xl font-extrabold text-slate-900">{formatBRL(totalMes)}</p>
        </div>
        {pendentes.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-bold">
            {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {recorrentes && recorrentes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> Despesas Recorrentes
          </h3>
          <div className="space-y-1.5">
            {recorrentes.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{r.descricao || r.categoria}</p>
                  <p className="text-xs text-slate-400">Dia {r.diaVencimento} · {r.categoria}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{formatBRL(parseFloat(r.valor))}</span>
                  <button
                    onClick={() => removerRecorrente.mutate(r.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando despesas...</span>
        </div>
      ) : !despesas || despesas.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-bold text-slate-600">Nenhuma despesa neste mês</p>
          <p className="text-sm text-slate-400 mt-1">Registre suas despesas para ter controle total.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {despesas.map(d => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "bg-white border rounded-xl p-3 shadow-sm flex items-center justify-between gap-3",
                d.confirmada ? "border-slate-200" : "border-amber-200 bg-amber-50/30"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-700 truncate">{d.descricao || d.categoria}</p>
                  {!d.confirmada && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold shrink-0">Pendente</span>
                  )}
                  {d.recorrente && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold shrink-0">Recorrente</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {d.categoria} · {new Date(d.data).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-bold text-red-600">{formatBRL(parseFloat(d.valor))}</span>
                {d.comprovante ? (
                  <button
                    onClick={() => window.open(d.comprovante!, "_blank")}
                    className="p-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all"
                    title="Ver comprovante"
                  >
                    <Image className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <label
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                    title="Anexar comprovante"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const res = await fetch(`/api/financeiro/despesas/${d.id}/comprovante`, {
                          method: "POST",
                          headers: { "x-session-token": token },
                          body: file,
                        });
                        if (res.ok) {
                          queryClient.invalidateQueries({ queryKey: ["despesas"] });
                          toast({ title: "Comprovante anexado!" });
                        }
                      }}
                    />
                  </label>
                )}
                {!d.confirmada && (
                  <button
                    onClick={() => confirmarDespesa.mutate(d.id)}
                    className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all"
                    title="Confirmar"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => deletarDespesa.mutate(d.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNova && categorias && (
          <NovaDespesaModal onClose={() => setShowNova(false)} categorias={categorias} token={token} />
        )}
        {showRecorrente && categorias && (
          <NovaRecorrenteModal onClose={() => setShowRecorrente(false)} categorias={categorias} token={token} />
        )}
      </AnimatePresence>
    </div>
  );
}
