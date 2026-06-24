import { useMemo } from "react";
import { Users, DollarSign, CheckCircle2, TrendingUp, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL, parseBRL } from "@/utils/currency";
import { diasDesde, diasBadge } from "./helpers";
import { WaBtn } from "./WaBtn";
import { KpiCard } from "./KpiCard";
import { API_URL, getAuthHeaders } from "./constants";

export function ClientesHistorico() {
  const { user } = useAuth();
  const params = new URLSearchParams();
  if (user?.nome)  params.set("vendedor", user.nome);
  if (user?.papel) params.set("papel",    user.papel);

  const { data: historico, isLoading } = useQuery<any[]>({
    queryKey: ["historico-orcamentos", user?.sessionToken],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/orcamento/historico?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!user?.sessionToken,
    staleTime: 0,
  });

  const clientes = useMemo(() => {
    if (!historico) return [];
    const mapa = new Map<string, any>();
    for (const item of historico) {
      const chave = item.whatsapp
        ? item.whatsapp.replace(/\D/g, "")
        : (item.cliente ?? "").toLowerCase().trim();
      if (!chave) continue;
      if (!mapa.has(chave)) {
        mapa.set(chave, { chave, nome: item.cliente ?? "Cliente", whatsapp: item.whatsapp, orcamentos: 0, compras: 0, totalGasto: 0, ultimoContato: item.criadoEm });
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
      .map((c) => ({ ...c, taxaRetorno: c.orcamentos > 0 ? Math.round((c.compras / c.orcamentos) * 100) : 0 }))
      .sort((a, b) => b.totalGasto - a.totalGasto || b.orcamentos - a.orcamentos);
  }, [historico]);

  const totalReceita = clientes.reduce((s: number, c: any) => s + c.totalGasto, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users,        label: "Total",       value: clientes.length,                                  accent: "bg-blue-500"    },
          { icon: CheckCircle2, label: "Compraram",   value: clientes.filter((c: any) => c.compras > 0).length, accent: "bg-emerald-500" },
          { icon: TrendingUp,   label: "Recorrentes", value: clientes.filter((c: any) => c.compras >= 2).length, accent: "bg-violet-500" },
          { icon: DollarSign,   label: "Receita",     value: formatBRL(totalReceita),                          accent: "bg-green-600"   },
        ].map((k) => (
          <KpiCard key={k.label} icon={k.icon} label={k.label} value={k.value} accent={k.accent} />
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">Nenhum cliente ainda.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
          {clientes.map((c: any) => {
            const dias = diasDesde(c.ultimoContato);
            const db   = diasBadge(dias);
            return (
              <div key={c.chave} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{c.nome}</span>
                    {c.compras >= 2 && <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">⭐ Recorrente</Badge>}
                    {c.compras === 1 && <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">✓ Cliente</Badge>}
                    {c.compras === 0 && <Badge variant="outline" className="text-[10px] text-slate-500">Prospect</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c.orcamentos} orç · {c.compras} compra{c.compras !== 1 ? "s" : ""} · {c.totalGasto > 0 ? formatBRL(c.totalGasto) : "—"}
                  </p>
                </div>
                <span className={cn("text-[10px] font-semibold border rounded-full px-1.5 py-0.5 shrink-0", db.cls)}>{db.text}</span>
                {c.whatsapp && (
                  <WaBtn whatsapp={c.whatsapp} nome={c.nome} size="sm" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
