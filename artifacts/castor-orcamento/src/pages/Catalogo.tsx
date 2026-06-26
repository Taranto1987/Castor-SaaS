import { useState, useEffect, useMemo, Fragment } from "react";
import { Search, PackageX, MessageCircle, Moon, Tag, X, ArrowRight } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { useWAInfo } from "@/hooks/use-wa-info";
import { useLoja } from "@/contexts/LojaContext";
import { ProductCardGrouped } from "@/components/ProductCardGrouped";
import { cn } from "@/lib/utils";
import { SIZE_ORDER } from "@/utils/normalizeSize";
import type { ProductSize } from "@/utils/normalizeSize";
import { groupProducts } from "@/utils/groupProducts";
import type { ProductGroup, Variant, CatalogoProduto } from "@/utils/groupProducts";
import { trackPageView, trackCatalogoWhatsApp, trackCatalogoView } from "@/lib/tracking";
import { CatalogFilters } from "@/components/CatalogFilters";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogVariant {
  size: ProductSize;
  produtoId: number | null;
  slug: string | null;
  preco: string | null;
  precoPix: string | null;
  parcelamento: string | null;
  medidas: string | null;
  altura: string | null;
  imagem: string | null;
  disponivel: boolean;
  encomenda: boolean;
  estoque: number | null;
}

interface CatalogFamily {
  id: string;
  name: string;
  category: string;
  ranking: number;
  imageUrl: string | null;
  availableSizes: ProductSize[];
  variants: CatalogVariant[];
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "colchoes":         "Colchões",
  "cama-box-colchao": "Box + Colchão",
  "cama-box":         "Cama Box",
  "travesseiros":     "Travesseiros",
  "protetor":         "Protetores",
  "roupa-de-cama":    "Roupa de Cama",
  "outlet":           "Outlet 🔥",
};

const CATEGORY_ORDER = [
  "colchoes",
  "cama-box-colchao",
  "cama-box",
  "travesseiros",
  "roupa-de-cama",
  "protetor",
];

const CATEGORY_CARDS: { slug: string; label: string; subtitle: string; featured: boolean }[] = [
  { slug: "colchoes", label: "Colchões", subtitle: "Molas, espuma e híbridos", featured: true },
  { slug: "cama-box-colchao", label: "Cama Box", subtitle: "Box + colchão conjunto", featured: false },
  { slug: "travesseiros", label: "Travesseiros", subtitle: "Memória, látex e pluma", featured: false },
  { slug: "roupa-de-cama", label: "Roupa de Cama", subtitle: "Jogo de lençóis e edredons", featured: false },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  colchoes: (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="14" width="24" height="10" rx="3" />
      <path d="M6 14v-2a4 4 0 014-4h12a4 4 0 014 4v2" />
    </svg>
  ),
  "cama-box-colchao": (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="16" width="26" height="6" rx="2" />
      <rect x="5" y="10" width="22" height="6" rx="3" />
      <line x1="7" y1="22" x2="7" y2="26" />
      <line x1="25" y1="22" x2="25" y2="26" />
    </svg>
  ),
  travesseiros: (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="16" cy="16" rx="12" ry="7" />
      <path d="M8 13c2-1 6-1.5 8-1.5s6 .5 8 1.5" />
    </svg>
  ),
  "roupa-de-cama": (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="8" width="20" height="16" rx="2" />
      <path d="M6 14h20" />
      <path d="M6 20h20" />
    </svg>
  ),
};

// ── Converter: CatalogFamily → ProductGroup (for ProductCardGrouped) ──────────

function toProductGroup(family: CatalogFamily): ProductGroup {
  const variants: Variant[] = family.variants
    .filter(v => family.availableSizes.includes(v.size))
    .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
    .map(v => ({
      id: v.produtoId ?? 0,
      nome: family.name,
      sku: null,
      slug: v.slug,
      preco: v.preco,
      precoPix: v.precoPix,
      parcelamento: v.parcelamento,
      medidas: v.medidas,
      altura: v.altura,
      categoria: family.category,
      imagem: v.imagem,
      disponivel: v.disponivel,
      encomenda: v.encomenda,
      estoque: v.estoque,
      size: v.size,
    }));

  return {
    key: family.id,
    familia: family.name,
    categoria: family.category,
    variants,
    hasSizes: variants.length > 1,
    ranking: family.ranking,
  };
}

function parseMinPrice(variants: CatalogVariant[], forSize?: ProductSize | null): number {
  let min = Infinity;
  for (const v of variants) {
    if (forSize && v.size !== forSize) continue;
    if (v.precoPix) {
      const num = parseFloat(v.precoPix.replace(/[^0-9,]/g, "").replace(",", "."));
      if (!isNaN(num) && num < min) min = num;
    }
  }
  return min;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Catalogo() {
  const [location] = useLocation();
  const search = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todas");
  const waInfo = useWAInfo();
  const { lojaId } = useLoja();
  const avatarSrc = lojaId === 2 ? "/marcela-avatar.webp" : "/thalles-avatar.webp";

  const [filterSize, setFilterSize] = useState<ProductSize | null>(null);
  const [filterAvailability, setFilterAvailability] = useState<"all" | "disponivel" | "encomenda">("all");
  const [sortBy, setSortBy] = useState<"ranking" | "price-asc" | "price-desc">("ranking");

  const [nudge, setNudge] = useState<"outlet" | "mapa" | null>(null);

  useEffect(() => { trackPageView("catalogo"); trackCatalogoView(); }, []);

  // Fires on both initial mount and every time the query string changes
  // (e.g. clicking "Outlet 🔥" nav link from within /catalogo).
  useEffect(() => {
    const params = new URLSearchParams(search);
    const cat = params.get("categoria");
    if (cat) setActiveCategory(cat);
    else if (!search) setActiveCategory("Todas");
  }, [search, location]);

  // ── Scroll nudges ─────────────────────────────────────────────────────────
  useEffect(() => {
    let outletShown = !!sessionStorage.getItem("nudge_outlet_shown");
    let mapaShown = !!sessionStorage.getItem("nudge_mapa_shown");

    const handleScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0) return;
      const pct = window.scrollY / h;

      if (pct >= 0.5 && !outletShown) {
        outletShown = true;
        sessionStorage.setItem("nudge_outlet_shown", "1");
        setNudge(prev => prev ?? "outlet");
      }
      if (pct >= 0.72 && !mapaShown) {
        mapaShown = true;
        sessionStorage.setItem("nudge_mapa_shown", "1");
        setNudge("mapa");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(null), 6000);
    return () => clearTimeout(t);
  }, [nudge]);

  const debouncedSearch = useDebounce(searchTerm, 400);

  // ── Castor Core: single canonical endpoint ────────────────────────────────
  const { data: allFamilies = [], isLoading } = useQuery<CatalogFamily[]>({
    queryKey: ["catalog-families", lojaId],
    queryFn: async () => {
      const res = await fetch(`/api/catalog/families?lojaId=${lojaId}`);
      if (!res.ok) throw new Error("Erro ao carregar catálogo");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Outlet products — fetched only when Outlet tab is active ─────────────
  const { data: outletProducts = [], isLoading: isLoadingOutlet } = useQuery<CatalogoProduto[]>({
    queryKey: ["outlet-products", lojaId],
    queryFn: async () => {
      const res = await fetch(`/api/produtos/outlet?lojaId=${lojaId}`);
      if (!res.ok) throw new Error("Erro ao carregar outlet");
      return res.json();
    },
    enabled: activeCategory === "outlet",
    staleTime: 5 * 60 * 1000,
  });

  // ── Category list from loaded families + hardcoded Outlet ─────────────────
  const categorias = useMemo(() => {
    const available = new Set(allFamilies.map(f => f.category));
    const ordered = CATEGORY_ORDER.filter(c => available.has(c));
    const others = [...available].filter(c => !CATEGORY_ORDER.includes(c)).sort();
    return [...ordered, ...others, "outlet", "Todas"];
  }, [allFamilies]);

  // ── Client-side filter: category + search + advanced filters ─────────────
  const groups = useMemo<ProductGroup[]>(() => {
    if (activeCategory === "outlet") {
      return groupProducts(outletProducts);
    }

    let filtered = allFamilies;

    if (activeCategory !== "Todas") {
      filtered = filtered.filter(f => f.category === activeCategory);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(q));
    }

    if (filterSize) {
      filtered = filtered.filter(f =>
        f.variants.some(v => v.size === filterSize && v.produtoId !== null)
      );
    }

    if (filterAvailability === "disponivel") {
      filtered = filtered.filter(f => f.variants.some(v => v.disponivel && !v.encomenda));
    } else if (filterAvailability === "encomenda") {
      filtered = filtered.filter(f => f.variants.some(v => v.encomenda));
    }

    let sorted = [...filtered];
    if (sortBy === "ranking") {
      sorted.sort((a, b) => a.ranking - b.ranking);
    } else {
      sorted.sort((a, b) => {
        const priceA = parseMinPrice(a.variants, filterSize);
        const priceB = parseMinPrice(b.variants, filterSize);
        return sortBy === "price-asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return sorted.map(toProductGroup);
  }, [allFamilies, activeCategory, debouncedSearch, outletProducts, filterSize, filterAvailability, sortBy]);

  const categoryImages = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const card of CATEGORY_CARDS) {
      const family = allFamilies.find(f => f.category === card.slug);
      map[card.slug] = family?.imageUrl ?? family?.variants[0]?.imagem ?? null;
    }
    return map;
  }, [allFamilies]);

  const secondaryCategories = useMemo(() => {
    const cardSlugs = new Set(CATEGORY_CARDS.map(c => c.slug));
    return categorias.filter(c => !cardSlugs.has(c) && c !== "Todas");
  }, [categorias]);

  const effectiveIsLoading = activeCategory === "outlet" ? isLoadingOutlet : isLoading;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20 space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Catálogo de Produtos
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xl">
            Todos os colchões, boxes, travesseiros e acessórios Castor disponíveis em {waInfo.loja}.
            Escolha o tamanho e fale com o especialista.
          </p>
        </div>
        <div className="w-full md:w-96 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-red-500 transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all shadow-sm"
            placeholder="Buscar modelo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Category grid — visual cards when on "Todas", pills when inside a category */}
      {!debouncedSearch && activeCategory === "Todas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {CATEGORY_CARDS.map(card => {
              const imgSrc = categoryImages[card.slug];
              return (
                <button
                  key={card.slug}
                  onClick={() => setActiveCategory(card.slug)}
                  className="group relative flex flex-col bg-gradient-to-br from-[#f5f0ea] to-[#ede7df] rounded-2xl border border-stone-200/60 overflow-hidden text-left transition-all hover:shadow-lg hover:shadow-stone-300/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {card.featured && (
                    <span className="absolute top-3 left-3 bg-blue-900 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md z-10">
                      Destaque
                    </span>
                  )}

                  <div className="absolute top-3 right-3 w-7 h-7 sm:w-8 sm:h-8 text-stone-400/50">
                    {CATEGORY_ICONS[card.slug]}
                  </div>

                  <div className="relative w-full aspect-[4/3] flex items-end justify-center pt-8 px-3">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={card.label}
                        width={400}
                        height={300}
                        className="max-h-full max-w-[90%] object-contain drop-shadow-md"
                        loading="eager"
                      />
                    ) : (
                      <div className="w-20 h-16 bg-stone-200/40 rounded-lg animate-pulse" />
                    )}
                  </div>

                  <div className="p-3 sm:p-4 pt-2 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                        {card.label}
                      </h3>
                      <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 leading-tight">
                        {card.subtitle}
                      </p>
                    </div>
                    <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-blue-900 rounded-full flex items-center justify-center text-white group-hover:bg-blue-800 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {secondaryCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {secondaryCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all border bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!debouncedSearch && activeCategory !== "Todas" && (
        <div className="flex flex-wrap gap-2">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-semibold transition-all border",
                activeCategory === cat
                  ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
                  : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50"
              )}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      )}

      {/* Advanced filters */}
      {activeCategory !== "outlet" && (
        <CatalogFilters
          filterSize={filterSize}
          setFilterSize={setFilterSize}
          filterAvailability={filterAvailability}
          setFilterAvailability={setFilterAvailability}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
      )}

      {/* Products grid */}
      {effectiveIsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col animate-pulse">
              <div className="w-full aspect-[4/3] bg-slate-100" />
              <div className="p-4 flex flex-col gap-3">
                <div className="h-5 bg-slate-100 rounded w-3/4" />
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(j => <div key={j} className="h-6 w-14 bg-slate-100 rounded-lg" />)}
                </div>
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-100 rounded mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <PackageX className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-800">Nenhum modelo encontrado</h3>
          <p className="text-slate-500 mt-2 max-w-sm text-sm">
            {debouncedSearch
              ? `Nada para "${debouncedSearch}". Tente outros termos.`
              : activeCategory === "outlet"
              ? "Nenhum produto outlet disponível no momento."
              : "Ainda não há modelos nesta categoria."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 font-medium">
            {groups.length} modelo{groups.length !== 1 ? "s" : ""} disponíveis
            {activeCategory !== "Todas" ? ` em ${CATEGORY_LABELS[activeCategory] ?? activeCategory}` : ""}
            {(filterSize || filterAvailability !== "all" || sortBy !== "ranking") ? " (filtrado)" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {groups.map((group, index) => (
              <Fragment key={`${group.key}-${filterSize ?? "all"}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
                >
                  <ProductCardGrouped group={group} waInfo={waInfo} isOutlet={activeCategory === "outlet"} ranking={group.ranking} defaultSize={filterSize} />
                </motion.div>
              </Fragment>
            ))}
          </div>
        </>
      )}

      {/* Scroll nudges — appear at 50% and 72% scroll, auto-dismiss after 6s */}
      <AnimatePresence>
        {nudge && (
          <motion.div
            key={nudge}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl shadow-black/40 max-w-xs w-[calc(100vw-3rem)]"
          >
            {nudge === "outlet" ? (
              <>
                <Tag className="w-5 h-5 text-orange-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight">Preços especiais disponíveis</p>
                  <p className="text-slate-400 text-[11px]">Veja os produtos outlet com desconto de fábrica</p>
                </div>
                <a
                  href="/catalogo?categoria=outlet"
                  onClick={() => setNudge(null)}
                  className="shrink-0 bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                >
                  Ver Outlet
                </a>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight">Não encontrou o ideal?</p>
                  <p className="text-slate-400 text-[11px]">Faça o Mapa do Sono — resultado em 13 cliques</p>
                </div>
                <a
                  href="/mapa-sono"
                  onClick={() => setNudge(null)}
                  className="shrink-0 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                >
                  Fazer Mapa
                </a>
              </>
            )}
            <button
              onClick={() => setNudge(null)}
              className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating WhatsApp */}
      <a
        href={`https://wa.me/${waInfo.numero}?text=${encodeURIComponent(`Olá! Estou vendo o catálogo da Castor ${waInfo.loja} e quero mais informações!`)}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackCatalogoWhatsApp("catalogo_geral", waInfo.loja)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl shadow-green-900/40 transition-all active:scale-95 hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm hidden sm:inline">Falar no WhatsApp</span>
      </a>
    </div>
  );
}
