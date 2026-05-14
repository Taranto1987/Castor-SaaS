import { useState, useEffect, useMemo } from "react";
import { Search, Loader2, PackageX, MessageCircle, Moon } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";
import { useWAInfo } from "@/hooks/use-wa-info";
import { useLoja } from "@/contexts/LojaContext";
import { ProductCardGrouped } from "@/components/ProductCardGrouped";
import {
  useListProdutos,
  useBuscarProdutos,
  useListCategorias,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { groupProducts } from "@/utils/groupProducts";
import type { CatalogoProduto } from "@/utils/groupProducts";
import { trackPageView, trackCatalogoWhatsApp, trackCatalogoView } from "@/lib/tracking";

const CATEGORY_LABELS: Record<string, string> = {
  "colchoes": "Colchões",
  "cama-box-colchao": "Box + Colchão",
  "cama-box": "Cama Box",
  "travesseiros": "Travesseiros",
  "protetor": "Protetores",
  "roupa-de-cama": "Roupa de Cama",
};

export default function Catalogo() {
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todas");
  const waInfo = useWAInfo();
  const { lojaId } = useLoja();
  const avatarSrc = lojaId === 2 ? "/marcela-avatar.jpg" : "/thalles-avatar.jpg";

  useEffect(() => { trackPageView("catalogo"); trackCatalogoView(); }, []);

  // Pick up ?categoria= from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("categoria");
    if (cat) setActiveCategory(cat);
  }, [location]);

  const debouncedSearch = useDebounce(searchTerm, 400);
  const isSearching = debouncedSearch.length > 0;

  const { data: categoriasData } = useListCategorias();
  const { data: listData, isLoading: isLoadingList } = useListProdutos(
    { categoria: activeCategory !== "Todas" ? activeCategory : undefined },
    { query: { enabled: !isSearching } as any }
  );
  const { data: searchData, isLoading: isLoadingSearch } = useBuscarProdutos(
    { q: debouncedSearch },
    { query: { enabled: isSearching } as any }
  );

  const categorias = ["Todas", ...(categoriasData || [])];
  const rawProducts = (isSearching ? searchData : listData) as CatalogoProduto[] | undefined;
  const isLoading = isSearching ? isLoadingSearch : isLoadingList;

  const groups = useMemo(() => groupProducts(rawProducts ?? []), [rawProducts]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20 space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Catálogo de Produtos
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xl">
            Todos os colchões, boxes, travesseiros e acessórios Castor disponíveis em {waInfo.loja}. Escolha o tamanho e fale com o especialista.
          </p>
        </div>
        <div className="w-full md:w-96 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-red-500 transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all shadow-sm"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Mapa do Sono banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-red-600 to-red-800 rounded-2xl p-5 flex items-center gap-4 text-white shadow-lg"
      >
        <img src={avatarSrc} alt="Especialista" className="w-12 h-12 rounded-xl object-cover object-top border-2 border-white/20 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm leading-tight">Não sabe qual colchão escolher?</p>
          <p className="text-red-100 text-xs mt-0.5">Faça o Mapa do Sono com o Especialista {waInfo.contato} — 13 cliques e descubra o ideal para o seu corpo.</p>
        </div>
        <a href="/mapa-sono" className="shrink-0 flex items-center gap-2 bg-white text-red-700 font-extrabold px-4 py-2.5 rounded-xl text-xs hover:bg-red-50 transition-all active:scale-95 whitespace-nowrap">
          <Moon className="w-4 h-4" /> Fazer o Mapa
        </a>
      </motion.div>

      {/* Category filters */}
      {!isSearching && (
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

      {/* Products grid */}
      {isLoading ? (
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
          <h3 className="text-xl font-bold text-slate-800">Nenhum produto encontrado</h3>
          <p className="text-slate-500 mt-2 max-w-sm text-sm">
            {isSearching
              ? `Nada para "${searchTerm}". Tente outros termos.`
              : "Ainda não há produtos nesta categoria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {groups.map((group, index) => (
            <motion.div
              key={group.key}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
            >
              <ProductCardGrouped group={group} waInfo={waInfo} />
            </motion.div>
          ))}
        </div>
      )}

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
