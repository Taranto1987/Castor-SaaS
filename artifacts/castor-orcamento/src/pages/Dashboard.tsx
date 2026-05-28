import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2, TrendingUp, Package, Truck, Users, RefreshCw,
  ShoppingBag, CheckCircle2, Percent, Target, Edit3, X, TrendingDown,
  Wifi, WifiOff, Smartphone, QrCode, Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardData {
  totalOrcamentos: number;
  totalVendas: number;
  taxaConversao: number;
  somaPixTotal: string;
  somaPrazoTotal: string;
  somaPixVendido: string;
  totalProdutosCatalogo: number;
  topProdutos: { nome: string; count: number }[];
  porVendedor: { vendedor: string; orcamentos: number; valorPix: number; vendas: number }[];
  orcamentosPorDia: { dia: string; count: number }[];
  totalEntregas: number;
  entregasPorStatus: { pendente: number; em_rota: number; entregue: number; cancelado: number };
  descontoMedioPorVendedor: { vendedor: string; descontoMedio: number; vendasAuditadas: number }[];
}

function parseBRL(str?: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMesAtual() {
  const now = new Date();
  return now.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

function MetaModal({ onClose, onSave, currentMeta }: {
  onClose: () => void;
  onSave: (val: number) => void;
  currentMeta: number;
}) {
  const [inputVal, setInputVal] = useState(currentMeta > 0 ? String(currentMeta) : "");

  const handleSave = () => {
    const val = parseFloat(inputVal.replace(/\./g, "").replace(",", "."));
    if (val > 0) { onSave(val); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Meta do mês</h2>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{getMesAtual()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1.5">Valor alvo (R$)</label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-400">R$</span>
            <input
              type="number"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ex: 80000"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {inputVal && parseFloat(inputVal) > 0
              ? `= ${formatBRL(parseFloat(inputVal.replace(/\./g, "").replace(",", ".")))}`
              : "Digite o valor em reais"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all"
          >
            Salvar meta
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface WhatsAppStatus {
  id?: number;
  status: string;
  phone?: string | null;
  instanceId?: string;
  lastSeenAt?: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const operacao = user?.operacao ?? "cabo_frio";
  const isDono = user?.papel === "dono";

  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  const { data: metaData, refetch: refetchMeta } = useQuery<{ valor: string } | null>({
    queryKey: ["meta", mesAtual, anoAtual, operacao],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/metas?mes=${mesAtual}&ano=${anoAtual}&operacao=${operacao}`);
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const meta = metaData ? parseFloat(metaData.valor) : 0;

  const handleSaveMeta = async (val: number) => {
    try {
      await fetch("/api/financeiro/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": user?.sessionToken || "" },
        body: JSON.stringify({ mes: mesAtual, ano: anoAtual, valor: val, operacao }),
      });
      refetchMeta();
    } catch {}
  };

  const dashParams = new URLSearchParams();
  if (user?.nome) dashParams.set("vendedor", user.nome);
  if (user?.papel) dashParams.set("papel", user.papel);

  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", user?.nome, user?.papel],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?${dashParams.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar dashboard");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: waStatus, refetch: refetchWa } = useQuery<WhatsAppStatus>({
    queryKey: ["whatsapp-status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status", {
        headers: { "x-session-token": user?.sessionToken ?? "" },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: isDono,
    refetchInterval: (q) => (q.state.data?.status === "awaiting_qr" ? 3000 : false),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (waStatus?.status === "connected" && showQRModal) {
      setShowQRModal(false);
      setQrCode(null);
    }
  }, [waStatus?.status, showQRModal]);

  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "x-session-token": user?.sessionToken ?? "" },
      });
      if (!res.ok) throw new Error("Erro");
      const data = await res.json() as { qrcode: string };
      const src = data.qrcode.startsWith("data:") ? data.qrcode : `data:image/png;base64,${data.qrcode}`;
      setQrCode(src);
      setShowQRModal(true);
      refetchWa();
    } catch { /* noop */ } finally {
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectLoading(true);
    try {
      await fetch("/api/whatsapp/disconnect", {
        method: "DELETE",
        headers: { "x-session-token": user?.sessionToken ?? "" },
      });
      refetchWa();
    } catch { /* noop */ } finally {
      setDisconnectLoading(false);
    }
  };

  const maxBar = Math.max(...(data?.orcamentosPorDia.map(d => d.count) ?? [1]), 1);
  const valorVendido = parseBRL(data?.somaPixVendido);
  const pctMeta = meta > 0 ? Math.min(Math.round((valorVendido / meta) * 100), 100) : 0;
  const faltaMeta = meta > 0 ? Math.max(meta - valorVendido, 0) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            {isDono ? "Visão geral da operação comercial." : `Seus números, ${user?.nome?.split(" ")[0] ?? ""}.`}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Meta do mês */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" />
            Meta do mês —{" "}
            <span className="capitalize font-normal text-slate-500 text-sm">{getMesAtual()}</span>
          </h2>
          {isDono && (
            <button
              onClick={() => setShowMetaModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {meta > 0 ? "Editar" : "Definir meta"}
            </button>
          )}
        </div>

        {meta === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400">
              {isDono
                ? "Nenhuma meta definida. Clique em \"Definir meta\" para começar."
                : "Meta do mês ainda não foi definida pelo dono."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold">Vendido (PIX)</p>
                <p className="text-2xl font-extrabold text-emerald-700">{formatBRL(valorVendido)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-semibold">Meta</p>
                <p className="text-2xl font-extrabold text-slate-900">{formatBRL(meta)}</p>
              </div>
            </div>
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full transition-all",
                  pctMeta >= 100 ? "bg-emerald-500" : pctMeta >= 75 ? "bg-blue-500" : pctMeta >= 50 ? "bg-amber-500" : "bg-red-400"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${pctMeta}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-600">
                {pctMeta >= 100
                  ? "🎉 Meta atingida!"
                  : `Faltam ${formatBRL(faltaMeta)}`}
              </p>
              <p className={cn(
                "text-2xl font-black",
                pctMeta >= 100 ? "text-emerald-600" : pctMeta >= 75 ? "text-blue-600" : pctMeta >= 50 ? "text-amber-600" : "text-red-500"
              )}>
                {pctMeta}%
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando dados...</span>
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-400">Erro ao carregar dados.</div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileText2} label="Orçamentos" value={data.totalOrcamentos} color="bg-blue-500" />
            <StatCard
              icon={CheckCircle2}
              label="Vendas fechadas"
              value={data.totalVendas}
              color="bg-emerald-500"
              sub={`${data.taxaConversao}% de conversão`}
            />
            <StatCard icon={TrendingUp} label="Receita PIX" value={data.somaPixVendido} color="bg-green-600" sub="vendas confirmadas" />
            <StatCard icon={Truck} label="Entregas" value={data.totalEntregas} color="bg-orange-500" />
          </div>

          {/* Funil de conversão */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-500" /> Funil de Conversão
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Orçamentos</span>
                    <span>{data.totalOrcamentos}</span>
                  </div>
                  <div className="h-3 bg-blue-100 rounded-full">
                    <div className="h-3 bg-blue-500 rounded-full w-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Vendas fechadas</span>
                    <span>{data.totalVendas}</span>
                  </div>
                  <div className="h-3 bg-emerald-100 rounded-full">
                    <div
                      className="h-3 bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${data.taxaConversao}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Entregas concluídas</span>
                    <span>{data.entregasPorStatus.entregue}</span>
                  </div>
                  <div className="h-3 bg-orange-100 rounded-full">
                    <div
                      className="h-3 bg-orange-500 rounded-full transition-all"
                      style={{ width: data.totalOrcamentos > 0 ? `${Math.round((data.entregasPorStatus.entregue / data.totalOrcamentos) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-center shrink-0">
                <p className="text-4xl font-black text-emerald-600">{data.taxaConversao}%</p>
                <p className="text-xs text-slate-400 font-semibold">taxa de conversão</p>
              </div>
            </div>
          </div>

          {/* Totais orçados */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={TrendingUp} label="Total orçado PIX" value={data.somaPixTotal} color="bg-slate-500" sub="todos os orçamentos" />
            <StatCard icon={Package} label="Produtos no catálogo" value={data.totalProdutosCatalogo.toLocaleString("pt-BR")} color="bg-violet-500" />
          </div>

          {/* Entregas por status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-500" /> Status das Entregas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Pendente", value: data.entregasPorStatus.pendente, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                { label: "Em rota", value: data.entregasPorStatus.em_rota, color: "bg-blue-100 text-blue-700 border-blue-200" },
                { label: "Entregue", value: data.entregasPorStatus.entregue, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                { label: "Cancelado", value: data.entregasPorStatus.cancelado, color: "bg-red-100 text-red-700 border-red-200" },
              ].map(s => (
                <div key={s.label} className={cn("rounded-xl border p-3 text-center", s.color)}>
                  <p className="text-2xl font-extrabold">{s.value}</p>
                  <p className="text-xs font-semibold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Orçamentos por dia */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" /> Orçamentos — Últimos 7 dias
            </h2>
            <div className="flex items-end gap-2 h-32">
              {data.orcamentosPorDia.map((d) => (
                <div key={d.dia} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-slate-600">{d.count > 0 ? d.count : ""}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t-lg transition-all"
                    style={{ height: `${Math.max((d.count / maxBar) * 96, d.count > 0 ? 8 : 2)}px` }}
                  />
                  <span className="text-[10px] text-slate-400">{d.dia}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auditoria de desconto — apenas dono */}
          {isDono && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-500" /> Auditoria de Desconto por Vendedor
              </h2>
              <p className="text-xs text-slate-400 mb-4">Desconto médio concedido em vendas fechadas (calculado sobre preço cheio)</p>
              {!data.descontoMedioPorVendedor || data.descontoMedioPorVendedor.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma venda auditada ainda. Os dados aparecem conforme as vendas forem fechadas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wide pb-2">Vendedor</th>
                        <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wide pb-2">Desconto médio</th>
                        <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wide pb-2">Vendas auditadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.descontoMedioPorVendedor.map((v) => {
                        const isHigh = v.descontoMedio > 20;
                        const isMid = v.descontoMedio > 15;
                        return (
                          <tr key={v.vendedor} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 font-semibold text-slate-700">{v.vendedor}</td>
                            <td className="py-2.5 text-right">
                              <span className={cn(
                                "font-extrabold text-base",
                                isHigh ? "text-red-600" : isMid ? "text-amber-600" : "text-emerald-600"
                              )}>
                                {v.descontoMedio.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right text-slate-400 text-xs font-semibold">
                              {v.vendasAuditadas} venda{v.vendasAuditadas !== 1 ? "s" : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-slate-400 mt-3">
                    🟢 ≤15% (padrão PIX) · 🟡 15–20% (desconto extra moderado) · 🔴 &gt;20% (desconto elevado)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp — apenas dono */}
          {isDono && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-green-500" /> WhatsApp
                </h2>
                {waStatus && (
                  <span className={cn(
                    "text-xs font-bold px-2.5 py-1 rounded-full",
                    waStatus.status === "connected" ? "bg-emerald-100 text-emerald-700" :
                    waStatus.status === "awaiting_qr" ? "bg-amber-100 text-amber-700" :
                    waStatus.status === "reconnect_required" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-100 text-slate-500"
                  )}>
                    {waStatus.status === "connected" ? "Conectado" :
                     waStatus.status === "awaiting_qr" ? "Aguardando QR" :
                     waStatus.status === "reconnect_required" ? "Reconectar" :
                     "Desconectado"}
                  </span>
                )}
              </div>

              {waStatus?.status === "connected" ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Wifi className="w-4 h-4" />
                    <span className="text-sm font-semibold">
                      {waStatus.phone ? `+${waStatus.phone}` : "Conectado"}
                    </span>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnectLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 transition-all disabled:opacity-50"
                  >
                    {disconnectLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WifiOff className="w-3.5 h-3.5" />}
                    Desconectar
                  </button>
                </div>
              ) : waStatus?.status === "awaiting_qr" ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-amber-600 font-medium">Aguardando leitura do QR Code...</p>
                  <button
                    onClick={() => { setShowQRModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 transition-all"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Ver QR
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    {waStatus?.status === "reconnect_required"
                      ? "Sessão expirada. Reconecte para retomar envios."
                      : "Conecte o WhatsApp para enviar mensagens automáticas."}
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={connectLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50"
                  >
                    {connectLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                    {waStatus?.status === "reconnect_required" ? "Reconectar" : "Conectar WhatsApp"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            {/* Top produtos */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-violet-500" /> Produtos Mais Orçados
              </h2>
              {data.topProdutos.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum dado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {data.topProdutos.map((p, i) => (
                    <div key={p.nome} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{p.nome}</p>
                      </div>
                      <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                        {p.count}x
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por vendedor */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" /> Por Vendedor
              </h2>
              {data.porVendedor.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum dado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {data.porVendedor.map((v) => (
                    <div key={v.vendedor} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{v.vendedor}</p>
                        <p className="text-xs text-slate-400">
                          {v.orcamentos} orç. · {v.vendas ?? 0} venda{(v.vendas ?? 0) !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-700">
                          {v.valorPix.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                        {v.orcamentos > 0 && (
                          <p className="text-[10px] text-slate-400">
                            {Math.round(((v.vendas ?? 0) / v.orcamentos) * 100)}% conv.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showMetaModal && (
          <MetaModal
            onClose={() => setShowMetaModal(false)}
            onSave={handleSaveMeta}
            currentMeta={meta}
          />
        )}
        {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Conectar WhatsApp</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Escaneie com o celular</p>
                </div>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {qrCode ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={qrCode} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl border border-slate-200" />
                  <p className="text-xs text-slate-400 text-center">
                    Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
                  </p>
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs font-semibold">Aguardando leitura...</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  <p className="text-sm text-slate-400">Gerando QR Code...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileText2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
