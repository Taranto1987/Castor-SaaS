import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Plus, Trash2, X,
  Send, RefreshCw, Check, Users, FileText, BarChart2,
  Receipt, Calendar, Percent, MessageCircle, Upload, Image
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend
} from "recharts";

import { formatBRL } from "@/utils/currency";

function finGet(url: string, token: string) {
  return fetch(url, {
    headers: { "x-session-token": token },
  });
}

function finPost(url: string, body: Record<string, unknown>, token: string) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify(body),
  });
}

function finPut(url: string, body: Record<string, unknown>, token: string) {
  return fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify(body),
  });
}

function finDelete(url: string, token: string) {
  return fetch(url, {
    method: "DELETE",
    headers: { "x-session-token": token },
  });
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

type Tab = "visao" | "despesas" | "comissoes" | "dre";

interface Alerta {
  tipo: string;
  titulo: string;
  descricao: string;
}

interface Despesa {
  id: number;
  valor: string;
  categoria: string;
  descricao: string | null;
  comprovante: string | null;
  recorrente: boolean;
  confirmada: boolean;
  data: string;
}

interface DespesaRecorrente {
  id: number;
  valor: string;
  categoria: string;
  descricao: string | null;
  diaVencimento: number;
}

interface ComissaoVendedor {
  vendedor: string;
  vendas: number;
  totalVendido: number;
  percentual: number;
  comissao: number;
}

interface DREData {
  mes: number;
  ano: number;
  receitaBruta: number;
  custoProdutos: number;
  lucroBruto: number;
  despesasPorCategoria: Record<string, number>;
  totalDespesas: number;
  totalComissoes: number;
  lucroLiquido: number;
  totalVendas: number;
}

interface ResumoDiario {
  vendas: number;
  totalFaturado: number;
  orcamentosDia: number;
  totalDespesas: number;
  lucroDia: number;
  pendentes: number;
  pendentesAntigos: number;
  texto: string;
}

function NovaDespesaModal({ onClose, categorias, token }: { onClose: () => void; categorias: string[]; token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(categorias[0] || "Outros");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await finPost("/api/financeiro/despesas", { valor: parseFloat(valor), categoria, descricao, data }, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      toast({ title: "Despesa registrada!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao registrar", variant: "destructive" });
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
          <h2 className="text-lg font-extrabold text-slate-900">Nova Despesa</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

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
            <label className="text-xs font-bold text-slate-600 block mb-1">Descrição (opcional)</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ex: Conta de luz março"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Data</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={data}
              onChange={e => setData(e.target.value)}
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
            {mutation.isPending ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NovaRecorrenteModal({ onClose, categorias, token }: { onClose: () => void; categorias: string[]; token: string }) {
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

function TabVisaoGeral({ mes, ano, token }: { mes: number; ano: number; token: string }) {
  const { data: dre, isLoading: dreLoading } = useQuery<DREData>({
    queryKey: ["dre", mes, ano],
    queryFn: async () => {
      const res = await finGet(`/api/financeiro/dre?mes=${mes}&ano=${ano}`, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
  });

  const { data: alertas } = useQuery<Alerta[]>({
    queryKey: ["alertas"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/alertas", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: resumo, refetch: refetchResumo, isLoading: resumoLoading } = useQuery<ResumoDiario>({
    queryKey: ["resumo-diario"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/resumo-diario", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const { data: evolucao } = useQuery<{
    label: string;
    faturamento: number;
    despesas: number;
    lucro: number;
  }[]>({
    queryKey: ["evolucao"],
    queryFn: async () => {
      const res = await finGet("/api/financeiro/evolucao?meses=6", token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleWhatsApp = () => {
    if (!resumo) return;
    const texto = encodeURIComponent(resumo.texto);
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  };

  if (dreLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="font-medium">Carregando...</span>
      </div>
    );
  }

  if (!dre) return <p className="text-sm text-slate-400 py-10 text-center">Erro ao carregar dados.</p>;

  return (
    <div className="space-y-5">
      {alertas && alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border",
                a.tipo === "meta" ? "bg-red-50 border-red-200" :
                  a.tipo === "followup" ? "bg-amber-50 border-amber-200" :
                    a.tipo === "margem" ? "bg-yellow-50 border-yellow-200" :
                      "bg-orange-50 border-orange-200"
              )}
            >
              <AlertTriangle className={cn(
                "w-5 h-5 shrink-0 mt-0.5",
                a.tipo === "meta" ? "text-red-500" :
                  a.tipo === "followup" ? "text-amber-500" :
                    a.tipo === "margem" ? "text-yellow-500" : "text-orange-500"
              )} />
              <div>
                <p className="text-sm font-bold text-slate-800">{a.titulo}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.descricao}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Receita</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatBRL(dre.receitaBruta)}</p>
          <p className="text-xs text-slate-400">{dre.totalVendas} vendas</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center mb-2">
            <TrendingDown className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Despesas</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatBRL(dre.totalDespesas)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-500 flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Comissões</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{formatBRL(dre.totalComissoes)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", dre.lucroLiquido >= 0 ? "bg-emerald-500" : "bg-red-500")}>
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs text-slate-500 font-semibold uppercase">Lucro Líquido</p>
          <p className={cn("text-xl font-extrabold mt-1", dre.lucroLiquido >= 0 ? "text-emerald-700" : "text-red-600")}>{formatBRL(dre.lucroLiquido)}</p>
        </div>
      </div>

      {Object.keys(dre.despesasPorCategoria).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" /> Despesas por Categoria
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(dre.despesasPorCategoria).map(([cat, val]) => ({ categoria: cat, valor: val }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="categoria" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {Object.entries(dre.despesasPorCategoria).map((_, i) => (
                    <Cell key={i} fill={["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316", "#ec4899", "#6366f1", "#14b8a6", "#84cc16", "#a855f7"][i % 12]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {evolucao && evolucao.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Evolução Mensal
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-500" /> Resumo Diário
          </h3>
          <button
            onClick={() => refetchResumo()}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <RefreshCw className={cn("w-3 h-3", resumoLoading && "animate-spin")} />
            Atualizar
          </button>
        </div>

        {resumo ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-slate-900">{resumo.vendas}</p>
                <p className="text-xs text-slate-500">Vendas</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-emerald-700">{formatBRL(resumo.totalFaturado)}</p>
                <p className="text-xs text-slate-500">Faturado</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-slate-900">{resumo.orcamentosDia}</p>
                <p className="text-xs text-slate-500">Orçamentos</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={cn("text-lg font-extrabold", resumo.lucroDia >= 0 ? "text-emerald-700" : "text-red-600")}>{formatBRL(resumo.lucroDia)}</p>
                <p className="text-xs text-slate-500">Lucro dia</p>
              </div>
            </div>
            <button
              onClick={handleWhatsApp}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Send className="w-4 h-4" />
              Enviar Resumo via WhatsApp
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">Carregando resumo...</p>
        )}
      </div>
    </div>
  );
}

function TabDespesas({ mes, ano, token }: { mes: number; ano: number; token: string }) {
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

function TabComissoes({ mes, ano, token }: { mes: number; ano: number; token: string }) {
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

function TabDRE({ mes, ano, token }: { mes: number; ano: number; token: string }) {
  const { data: dre, isLoading } = useQuery<DREData>({
    queryKey: ["dre", mes, ano],
    queryFn: async () => {
      const res = await finGet(`/api/financeiro/dre?mes=${mes}&ano=${ano}`, token);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="font-medium">Carregando DRE...</span>
      </div>
    );
  }

  if (!dre) return <p className="text-sm text-slate-400 py-10 text-center">Erro ao carregar.</p>;

  const categoriasDespesa = Object.entries(dre.despesasPorCategoria).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            DRE Simplificado — {MESES[dre.mes - 1]} {dre.ano}
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          <DRELine label="Receita Bruta" value={dre.receitaBruta} bold tipo="receita" sub={`${dre.totalVendas} vendas fechadas`} />
          <DRELine label="(−) Custo dos Produtos" value={-dre.custoProdutos} tipo="custo" />
          <DRELine label="= Lucro Bruto" value={dre.lucroBruto} bold tipo="subtotal" />

          <div className="px-5 py-2 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Despesas Operacionais</p>
          </div>
          {categoriasDespesa.length === 0 ? (
            <div className="px-5 py-2">
              <p className="text-xs text-slate-400 italic">Nenhuma despesa registrada neste mês</p>
            </div>
          ) : (
            categoriasDespesa.map(([cat, val]) => (
              <DRELine key={cat} label={`  ${cat}`} value={-val} tipo="despesa" />
            ))
          )}
          <DRELine label="(−) Total Despesas" value={-dre.totalDespesas} bold tipo="custo" />
          <DRELine label="(−) Comissões" value={-dre.totalComissoes} tipo="custo" />

          <div className={cn("px-5 py-4", dre.lucroLiquido >= 0 ? "bg-emerald-50" : "bg-red-50")}>
            <div className="flex items-center justify-between">
              <p className={cn("font-extrabold text-base", dre.lucroLiquido >= 0 ? "text-emerald-800" : "text-red-800")}>
                = Lucro Líquido
              </p>
              <p className={cn("font-extrabold text-xl", dre.lucroLiquido >= 0 ? "text-emerald-700" : "text-red-600")}>
                {formatBRL(dre.lucroLiquido)}
              </p>
            </div>
            {dre.receitaBruta > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Margem líquida: {((dre.lucroLiquido / dre.receitaBruta) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DRELine({ label, value, bold, tipo, sub }: {
  label: string;
  value: number;
  bold?: boolean;
  tipo: "receita" | "custo" | "despesa" | "subtotal";
  sub?: string;
}) {
  return (
    <div className={cn("px-5 py-2.5 flex items-center justify-between", bold && "bg-slate-50/50")}>
      <div>
        <p className={cn(
          "text-sm",
          bold ? "font-bold text-slate-800" : "text-slate-600",
          tipo === "despesa" && "text-slate-500"
        )}>
          {label}
        </p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <p className={cn(
        "text-sm font-bold",
        tipo === "receita" ? "text-blue-700" :
          tipo === "subtotal" ? (value >= 0 ? "text-emerald-700" : "text-red-600") :
            "text-red-600"
      )}>
        {tipo === "subtotal" ? formatBRL(value) : formatBRL(Math.abs(value))}
      </p>
    </div>
  );
}

export default function Financeiro() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("visao");
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  if (user?.papel !== "dono") {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <DollarSign className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500">Esta seção é exclusiva para o dono da loja.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "visao", label: "Visão Geral", icon: BarChart2 },
    { key: "despesas", label: "Despesas", icon: Receipt },
    { key: "comissoes", label: "Comissões", icon: Users },
    { key: "dre", label: "DRE", icon: FileText },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
          Financeiro
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          Controle completo de receitas, despesas e lucro.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={mes}
          onChange={e => setMes(parseInt(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {MESES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={ano}
          onChange={e => setAno(parseInt(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {tab === "visao" && <TabVisaoGeral mes={mes} ano={ano} token={user?.sessionToken || ""} />}
      {tab === "despesas" && <TabDespesas mes={mes} ano={ano} token={user?.sessionToken || ""} />}
      {tab === "comissoes" && <TabComissoes mes={mes} ano={ano} token={user?.sessionToken || ""} />}
      {tab === "dre" && <TabDRE mes={mes} ano={ano} token={user?.sessionToken || ""} />}
    </div>
  );
}
