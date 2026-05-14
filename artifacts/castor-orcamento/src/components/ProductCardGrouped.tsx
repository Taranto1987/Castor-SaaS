import { useState } from "react";
import { MessageCircle, ExternalLink, Ruler, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WAInfo } from "@/hooks/use-wa-info";
import type { ProductGroup, Variant } from "@/utils/groupProducts";
import { trackCatalogoWhatsApp } from "@/lib/tracking";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=800&q=80";

interface Props {
  group: ProductGroup;
  waInfo: WAInfo;
  className?: string;
}

function isOutOfStock(v: Variant): boolean {
  return v.disponivel === false || (v.estoque != null && v.estoque === 0);
}

export function ProductCardGrouped({ group, waInfo, className }: Props) {
  const defaultIdx = group.hasSizes
    ? Math.max(0, group.variants.findIndex(v => v.size === "King"))
    : 0;
  const [activeIdx, setActiveIdx] = useState(defaultIdx);
  const v = group.variants[activeIdx];

  const waMsg =
    `Olá, ${waInfo.contato}! 👋 Vi o site da Castor ${waInfo.loja} e tenho interesse:\n\n` +
    `*${group.familia}${group.hasSizes ? ` — ${v.size}` : ""}*\n` +
    (v.medidas ? `📐 Medidas: ${v.medidas}\n` : "") +
    (v.precoPix ? `💰 Pix: ${v.precoPix}\n` : "") +
    `\nGostaria de mais informações e disponibilidade!`;

  return (
    <div
      className={cn(
        "group/card relative bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col",
        "shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/20",
        "transition-all duration-300 ease-out",
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
        <img
          src={v.imagem || FALLBACK_IMG}
          alt={group.familia}
          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="bg-white/90 backdrop-blur text-xs font-semibold px-2.5 py-1 rounded-full text-slate-800 shadow-sm border border-white/20">
            {v.categoria}
          </span>
          {v.encomenda && (
            <span className="bg-amber-500/90 backdrop-blur text-xs font-semibold px-2.5 py-1 rounded-full text-white shadow-sm">
              Encomenda
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2.5">
        {/* Family name */}
        <h3 className="font-bold text-base text-foreground line-clamp-2 leading-snug group-hover/card:text-primary transition-colors">
          {group.familia}
        </h3>

        {/* Size selector — only shown when multiple sizes exist */}
        {group.hasSizes && group.variants.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {group.variants.map((variant, i) => {
              const oos = isOutOfStock(variant);
              return (
                <button
                  key={variant.size}
                  type="button"
                  onClick={() => !oos && setActiveIdx(i)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                    i === activeIdx
                      ? "bg-red-600 text-white border-red-600 shadow-sm"
                      : oos
                      ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-400 hover:text-red-600 cursor-pointer"
                  )}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>
        )}

        {/* Specs */}
        <div className="flex flex-wrap gap-1.5">
          {v.medidas && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <Ruler className="w-3.5 h-3.5 shrink-0" />
              {v.medidas}
            </span>
          )}
          {v.altura && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              {v.altura}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-auto pt-2.5 border-t border-border/50 space-y-1">
          <div className="flex items-end justify-between">
            <span className="text-xs text-muted-foreground">Pix</span>
            <span className="font-bold text-primary text-xl tracking-tight">
              {v.precoPix || "Sob consulta"}
            </span>
          </div>
          {v.preco && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">A prazo</span>
              <span className="font-semibold text-slate-700">{v.preco}</span>
            </div>
          )}
          {v.parcelamento && (
            <p className="text-[11px] text-right text-slate-400">em até {v.parcelamento}</p>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2 pt-0.5">
          <a
            href={`https://wa.me/${waInfo.numero}?text=${encodeURIComponent(waMsg)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackCatalogoWhatsApp(
                `${group.familia}${group.hasSizes ? ` ${v.size}` : ""}`,
                waInfo.loja
              )
            }
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-sm shadow-green-500/20 transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            Tenho interesse
          </a>
          {v.slug && (
            <a
              href={`/produto/${v.slug}`}
              className="w-11 flex items-center justify-center bg-white border-2 border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors"
              title="Ver página do produto"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
