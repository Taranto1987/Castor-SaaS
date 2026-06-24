import { RefreshCw, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/utils/currency";
import { finGet, MESES } from "./constants";
import type { DREData } from "./constants";

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

export function TabDRE({ mes, ano, token }: { mes: number; ano: number; token: string }) {
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
