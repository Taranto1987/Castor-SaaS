import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, Phone, ShoppingBag, Calendar, TrendingUp,
  RefreshCw, MessageCircle, CheckCircle2, Clock
} from "lucide-react";
import { useHistoricoOrcamentos } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

function diasDesde(iso?: string): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function formatarData(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function parseBRL(str?: string | null): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ClienteAgregado {
  chave: string;
  nome: string;
  whatsapp?: string;
  orcamentos: number;
  compras: number;
  totalGasto: number;
  ultimoContato?: string;
  taxaRetorno: number;
}

export default function Clientes() {
  const { data: historico, isLoading, refetch } = useHistoricoOrcamentos();

  const clientes = useMemo<ClienteAgregado[]>(() => {
    if (!historico) return [];

    const mapa = new Map<string, any>();

    for (const item of historico) {
      const chave = item.whatsapp
        ? item.whatsapp.replace(/\D/g, "")
        : (item.cliente ?? "").toLowerCase().trim();
      if (!chave) continue;

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          nome: item.cliente ?? "Cliente",
          whatsapp: item.whatsapp ?? undefined,
          orcamentos: 0,
          compras: 0,
          totalGasto: 0,
          ultimoContato: item.criadoEm,
        });
      }

      const cli = mapa.get(chave)!;
      cli.orcamentos += 1;
      if (item.status === "vendido") {
        cli.compras += 1;
        cli.totalGasto += parseBRL(item.totalPix ?? item.totalPrazo);
      }
      if (!cli.ultimoContato || (item.criadoEm && item.criadoEm > cli.ultimoContato)) {
        cli.ultimoContato = item.criadoEm;
      }
    }

    return Array.from(mapa.values())
      .map(c => ({
        ...c,
        taxaRetorno: c.orcamentos > 0 ? Math.round((c.compras / c.orcamentos) * 100) : 0,
      }))
      .sort((a, b) => b.totalGasto - a.totalGasto || b.orcamentos - a.orcamentos);
  }, [historico]);

  const totalClientes = clientes.length;
  const clientesComCompra = clientes.filter(c => c.compras > 0).length;
  const recorrentes = clientes.filter(c => c.compras >= 2).length;
  const totalReceita = clientes.reduce((s, c) => s + c.totalGasto, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Clientes
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Histórico agrupado por cliente — compras, valor e frequência.
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,        label: "Total clientes",   value: totalClientes,       color: "bg-blue-500" },
          { icon: CheckCircle2, label: "Compraram",        value: clientesComCompra,   color: "bg-emerald-500" },
          { icon: TrendingUp,   label: "Recorrentes",      value: recorrentes,         color: "bg-violet-500" },
          { icon: ShoppingBag,  label: "Receita total",    value: formatBRL(totalReceita), color: "bg-green-600" },
        ].map(k => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"
          >
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", k.color)}>
              <k.icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{k.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Lista de clientes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando clientes...</span>
        </div>
      ) : clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
            <Users className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Nenhum cliente ainda</p>
          <p className="text-sm text-slate-400">Os clientes aparecem aqui quando orçamentos são salvos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientes.map((c, i) => {
            const dias = diasDesde(c.ultimoContato);
            const msg = encodeURIComponent(
              `Olá, *${c.nome}*! 😊 Aqui é da *Castor Cabo Frio*. Passando para saber se posso ajudar com alguma necessidade de colchão ou acessórios! 🛏️`
            );
            const waUrl = c.whatsapp
              ? `https://wa.me/55${c.whatsapp.replace(/\D/g, "")}?text=${msg}`
              : undefined;

            return (
              <motion.div
                key={c.chave}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{c.nome}</span>
                      {c.compras >= 2 && (
                        <span className="text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                          ⭐ Recorrente
                        </span>
                      )}
                      {c.compras > 0 && c.compras < 2 && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ✓ Cliente
                        </span>
                      )}
                      {c.compras === 0 && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
                          Prospect
                        </span>
                      )}
                    </div>

                    {c.whatsapp && (
                      <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {c.whatsapp}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <ShoppingBag className="w-3 h-3" />
                        <span>{c.orcamentos} orç.</span>
                        {c.compras > 0 && (
                          <span className="text-emerald-600 font-bold">· {c.compras} compra{c.compras !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                      {c.totalGasto > 0 && (
                        <div className="text-xs font-bold text-emerald-700">
                          {formatBRL(c.totalGasto)}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {dias === 0 ? "hoje" : dias === 1 ? "ontem" : `${dias}d atrás`}
                          {c.ultimoContato && ` (${formatarData(c.ultimoContato)})`}
                        </span>
                      </div>
                    </div>

                    {/* Barra de conversão */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            c.taxaRetorno >= 80 ? "bg-emerald-500" : c.taxaRetorno >= 50 ? "bg-blue-500" : c.taxaRetorno > 0 ? "bg-amber-400" : "bg-slate-200"
                          )}
                          style={{ width: `${c.taxaRetorno}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{c.taxaRetorno}% conv.</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-600 text-white transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Contato
                      </a>
                    )}
                    {dias >= 30 && c.compras > 0 && (
                      <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {dias}d sem contato
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
