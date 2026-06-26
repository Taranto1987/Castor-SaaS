import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Clock, RefreshCw, Package, MessageCircle,
  Truck, ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWAInfo } from "@/hooks/use-wa-info";
import { cn } from "@/lib/utils";
import { groupProducts, type CatalogoProduto, type ProductGroup, type Variant } from "@/utils/groupProducts";
import { trackOutletPedido, trackWhatsAppClick, trackPageView } from "@/lib/tracking";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProdutoOutlet = CatalogoProduto & {
  prazoEncomenda?: string | null;
  custoBRL?: string | null;
  outletPrice?: number | null;
  factoryCost?: number | null;
  outletMarkupPercent?: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const FALLBACK_IMG = "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=400&q=70";
const DEFAULT_PRAZO = "15 a 20 dias úteis";

function precoVendaOutlet(p: ProdutoOutlet): string | null {
  // Priority: engine-calculated outletPrice > precoPix fallback
  if (p.outletPrice && p.outletPrice > 0) {
    return `R$ ${p.outletPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }
  if (p.precoPix) return p.precoPix;
  return null;
}

function registrarInteresse(produtoId: number) {
  fetch(`/api/produtos/outlet/${produtoId}/interesse`, { method: "POST" }).catch(() => {});
}

// ── Outlet product card ───────────────────────────────────────────────────────

function OutletCard({
  group,
  waNumero,
  waLoja,
  waContato,
}: {
  group: ProductGroup;
  waNumero: string;
  waLoja: string;
  waContato: string;
}) {
  const defaultIdx = group.hasSizes
    ? Math.max(0, group.variants.findIndex(v => v.size === "Casal"))
    : 0;
  const [activeIdx, setActiveIdx] = useState(defaultIdx);
  const v = group.variants[activeIdx] as Variant & ProdutoOutlet;
  const preco = precoVendaOutlet(v as ProdutoOutlet);
  const prazo = (v as ProdutoOutlet).prazoEncomenda || DEFAULT_PRAZO;

  const waMsg =
    `Olá, ${waContato}! 👋 Vi o Outlet da Castor ${waLoja} e tenho interesse:\n\n` +
    `*${group.familia}${group.hasSizes ? ` — ${v.size}` : ""}*\n` +
    (v.medidas ? `📐 Medidas: ${v.medidas}\n` : "") +
    (preco ? `💰 Valor especial: ${preco}\n` : "") +
    `🚚 Prazo estimado: ${prazo}\n\n` +
    `Produto disponível sob encomenda direta da fábrica. Pode confirmar condições?`;

  const handlePedir = () => {
    registrarInteresse(v.id);
    trackOutletPedido(group.familia);
    trackWhatsAppClick("outlet_pedir", waLoja);
    window.open(`https://wa.me/${waNumero}?text=${encodeURIComponent(waMsg)}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <img
          src={v.imagem || FALLBACK_IMG}
          alt={group.familia}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Badges overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <span className="bg-orange-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-sm tracking-wide uppercase">
            Outlet
          </span>
          <span className="bg-black/70 backdrop-blur text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            Sob Encomenda
          </span>
        </div>
        {v.categoria && (
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur text-[10px] font-semibold px-2.5 py-1 rounded-full text-slate-700 shadow-sm border border-white/20 capitalize">
            {v.categoria.replace(/-/g, " ")}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        {/* Family name */}
        <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
          {group.familia}
        </h3>

        {/* Size selector */}
        {group.hasSizes && group.variants.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {group.variants.map((variant, i) => (
              <button
                key={variant.size}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                  i === activeIdx
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600"
                )}
              >
                {variant.size}
              </button>
            ))}
          </div>
        )}

        {/* Medidas */}
        {v.medidas && (
          <p className="text-xs text-slate-400">{v.medidas}</p>
        )}

        {/* Prazo */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Prazo estimado: <strong className="text-slate-700">{prazo}</strong></span>
        </div>

        {/* Price */}
        <div className="flex items-end justify-between border-t border-slate-100 pt-2.5">
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Condição especial · PIX</p>
            <p className="text-xl font-extrabold text-orange-600">
              {preco ?? "Sob consulta"}
            </p>
          </div>
          {v.preco && v.preco !== preco && (
            <p className="text-xs text-slate-400 line-through">{v.preco}</p>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <button
            onClick={handlePedir}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-sm shadow-green-500/20 transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            Quero este produto
          </button>
          {v.slug && (
            <a
              href={`/produto/${v.slug}`}
              className="w-10 flex items-center justify-center bg-white border-2 border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors shrink-0"
              title="Ver detalhes"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          Produto disponível via encomenda direta da fábrica Castor.
          Entrega no prazo acima após confirmação.
        </p>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Outlet() {
  const { user } = useAuth();
  const waInfo = useWAInfo();
  const isDono = user?.papel === "dono";

  useEffect(() => { trackPageView("outlet"); }, []);

  const { data: rawProdutos = [], isLoading, refetch } = useQuery<ProdutoOutlet[]>({
    queryKey: ["outlet-produtos"],
    queryFn: async () => {
      const res = await fetch("/api/produtos/outlet");
      if (!res.ok) throw new Error("Erro ao carregar outlet");
      return res.json();
    },
  });

  const grupos = groupProducts(rawProdutos as CatalogoProduto[]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-orange-500 text-white text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wide">
              Outlet
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Catálogo Expandido
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Produtos disponíveis via encomenda direta da fábrica Castor. Condições especiais, prazo maior.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
        <Truck className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-orange-800">Como funciona o Outlet?</p>
          <p className="text-xs text-orange-600 mt-0.5 leading-relaxed">
            Os produtos do Outlet não estão fisicamente no showroom — chegam diretamente da fábrica Castor
            após o pedido ser confirmado. Ideal para quem busca o melhor preço e aceita aguardar o prazo de entrega.
          </p>
        </div>
      </div>

      {/* Dono: link para gestão */}
      {isDono && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            <strong>{rawProdutos.length}</strong> produtos no Outlet.
            Para adicionar ou remover produtos, use a aba <strong>Estoque → Catálogo / Outlet</strong>.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando outlet...</span>
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
            <Package className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Nenhum produto no Outlet ainda</p>
          {isDono && (
            <p className="text-sm text-slate-400 text-center max-w-xs">
              Vá em <strong>Estoque → Catálogo / Outlet</strong> e mova produtos para o modo Outlet.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 font-medium">
            {grupos.length} modelo{grupos.length !== 1 ? "s" : ""} disponíveis
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grupos.map(group => (
              <OutletCard
                key={group.key}
                group={group}
                waNumero={waInfo.numero}
                waLoja={waInfo.loja}
                waContato={waInfo.contato}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
