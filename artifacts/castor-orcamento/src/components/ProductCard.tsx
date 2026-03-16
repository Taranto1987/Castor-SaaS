import { forwardRef } from "react";
import { BedDouble, Box, Layers, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Produto } from "@workspace/api-client-react/src/generated/api.schemas";

interface ProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
  product: Produto;
  onClick?: () => void;
}

export const ProductCard = forwardRef<HTMLDivElement, ProductCardProps>(
  ({ product, className, onClick, ...props }, ref) => {
    // Default placeholder if image is missing
    const fallbackImg = "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=800&q=80";

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          "group relative bg-card rounded-2xl border border-border/50 overflow-hidden cursor-pointer",
          "shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/20",
          "transition-all duration-300 ease-out flex flex-col",
          className
        )}
        {...props}
      >
        {/* Image Aspect Ratio Container */}
        <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
          <img
            src={product.imagem || fallbackImg}
            alt={product.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="bg-white/90 backdrop-blur text-xs font-semibold px-2.5 py-1 rounded-full text-slate-800 shadow-sm border border-white/20">
              {product.categoria}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-display font-bold text-lg text-foreground line-clamp-2 leading-tight mb-2 group-hover:text-primary transition-colors">
            {product.nome}
          </h3>

          {/* Specs */}
          <div className="flex flex-wrap gap-3 mb-4 mt-auto">
            {product.medidas && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                <Ruler className="w-3.5 h-3.5" />
                <span>{product.medidas}</span>
              </div>
            )}
            {product.altura && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                <Layers className="w-3.5 h-3.5" />
                <span>{product.altura}</span>
              </div>
            )}
          </div>

          <hr className="border-border/50 mb-4" />

          {/* Price Area */}
          <div className="space-y-1.5">
            <div className="flex items-end justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pix</span>
              <span className="font-display font-bold text-primary text-xl tracking-tight">
                {product.precoPix || 'Sob consulta'}
              </span>
            </div>
            
            {product.preco && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">A prazo</span>
                <span className="font-semibold text-slate-700">
                  {product.preco}
                </span>
              </div>
            )}
            {product.parcelamento && (
              <p className="text-[11px] text-right text-slate-500 mt-0.5">
                em até {product.parcelamento}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);
ProductCard.displayName = "ProductCard";
