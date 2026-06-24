import { AlertTriangle, Check } from "lucide-react";

export function StockBadge({ estoque }: { estoque: number | null }) {
  if (estoque === null) return (
    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
      Sem controle
    </span>
  );
  if (estoque === 0) return (
    <span className="text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
      <AlertTriangle className="w-2.5 h-2.5" /> Esgotado
    </span>
  );
  if (estoque <= 3) return (
    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
      Baixo: {estoque}
    </span>
  );
  return (
    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
      <Check className="w-2.5 h-2.5" /> {estoque} un.
    </span>
  );
}
