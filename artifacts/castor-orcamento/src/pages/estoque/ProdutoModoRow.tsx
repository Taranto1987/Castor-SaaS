import { Store, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/utils/currency";
import { calcPreview } from "./constants";
import type { ProdutoGestao, PricingConfig } from "./constants";

export function ProdutoModoRow({
  produto,
  onToggle,
  isPending,
  pricingConfig,
}: {
  produto: ProdutoGestao;
  onToggle: (id: number, encomenda: boolean) => void;
  isPending: boolean;
  pricingConfig: PricingConfig;
}) {
  const isOutlet = produto.encomenda;
  const label = produto.familyName ?? produto.nome;

  const previewOutlet = produto.precoBase && !isOutlet
    ? calcPreview(produto.precoBase, pricingConfig.supplierDiscountPercent, pricingConfig.outletMarkupPercent)
    : null;

  const currentOutletPrice = produto.outletPrice ?? (
    produto.precoBase && isOutlet
      ? calcPreview(produto.precoBase, pricingConfig.supplierDiscountPercent, pricingConfig.outletMarkupPercent).outletPrice
      : null
  );

  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 border rounded-xl transition-colors",
      isOutlet ? "bg-orange-50/50 border-orange-100" : "bg-white border-slate-100"
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {label}
          {produto.size && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">{produto.size}</span>
          )}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {produto.medidas && <p className="text-[11px] text-slate-400">{produto.medidas}</p>}
          {isOutlet && currentOutletPrice && (
            <span className="text-[11px] font-bold text-orange-600">{formatBRL(currentOutletPrice)}</span>
          )}
          {!isOutlet && previewOutlet && (
            <span className="text-[11px] text-slate-300">→ outlet: {formatBRL(previewOutlet.outletPrice)}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          disabled={isPending || !isOutlet}
          onClick={() => onToggle(produto.id, false)}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
            !isOutlet
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-400 border-slate-200 hover:border-blue-300 hover:text-blue-600 cursor-pointer"
          )}
        >
          <Store className="w-3 h-3 inline mr-0.5" />
          Catálogo
        </button>
        <button
          disabled={isPending || isOutlet}
          onClick={() => onToggle(produto.id, true)}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
            isOutlet
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-slate-400 border-slate-200 hover:border-orange-300 hover:text-orange-500 cursor-pointer"
          )}
        >
          <ShoppingCart className="w-3 h-3 inline mr-0.5" />
          Outlet
        </button>
      </div>
    </div>
  );
}
