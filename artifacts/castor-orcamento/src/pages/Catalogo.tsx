import { useState, useEffect } from "react";
import { Search, Loader2, PackageX, MessageCircle, Moon, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";
import { ProductCard } from "@/components/ProductCard";
import {
  useListProdutos,
  useBuscarProdutos,
  useListCategorias
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import type { Produto } from "@workspace/api-client-react/src/generated/api.schemas";
import { trackPageView, trackCatalogoWhatsApp, trackCatalogoView } from "@/lib/tracking";

const WA_CF  = { numero: "5522992410112", loja: "Cabo Frio", contato: "ThallesZzz" };
const WA_ARU = { numero: "5522333437720", loja: "Araruama",  contato: "Marcela" };
const CIDADES_ARU = ["araruama", "saquarema", "iguaba grande", "maricá", "silva jardim"];

function gerarMsgWA(produto: Produto, contato: string, loja: string): string {
  return `Olá, ${contato}! 👋 Vi o site da Castor ${loja} e tenho interesse no produto:\n\n*${produto.nome}*\n${produto.medidas ? `📐 Medidas: ${produto.medidas}\n` : ""}${produto.precoPix ? `💰 Pix: ${produto.precoPix}\n` : ""}\nGostaria de mais informações e disponibilidade!`;
}

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
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);
  const [waInfo, setWaInfo] = useState(WA_CF);

  useEffect(() => { trackPageView("catalogo"); trackCatalogoView(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then(r => r.json())
      .then((data: { city?: string }) => {
        const cidade = (data.city ?? "").toLowerCase();
        if (CIDADES_ARU.some(c => cidade.includes(c))) setWaInfo(WA_ARU);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

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
    { query: { enabled: !isSearching } }
  );
  const { data: searchData, isLoading: isLoadingSearch } = useBuscarProdutos(
    { q: debouncedSearch },
    { query: { enabled: isSearching } }
  );

  const categorias = ["Todas", ...(categoriasData || [])];
  const displayProducts = isSearching ? searchData : listData;
  const isLoading = isSearching ? isLoadingSearch : isLoadingList;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20 space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Catálogo de Produtos
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xl">
            Todos os colchões, boxes, travesseiros e acessórios Castor disponíveis em Cabo Frio. Clique para ver detalhes e falar diretamente com o especialista.
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
        <img src="/thalles-avatar.jpg" alt="Especialista" className="w-12 h-12 rounded-xl object-cover object-top border-2 border-white/20 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm leading-tight">Não sabe qual colchão escolher?</p>
          <p className="text-red-100 text-xs mt-0.5">Faça o Mapa do Sono com o Especialista {waInfo.contato} — 13 cliques e descubra o ideal para o seu corpo.</p>
        </div>
        <a href="/mapa-sono" className="shrink-0 flex items-center gap-2 bg-white text-red-700 font-extrabold px-4 py-2.5 rounded-xl text-xs hover:bg-red-50 transition-all active:scale-95 whitespace-nowrap">
          <Moon className="w-4 h-4" /> Fazer o Mapa
        </a>
      </motion.div>

      {/* Categories */}
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

      {/* Products */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-[400px] p-4 flex flex-col animate-pulse">
              <div className="w-full h-48 bg-slate-100 rounded-xl mb-4" />
              <div className="h-5 bg-slate-100 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-auto" />
              <div className="h-8 bg-slate-100 rounded w-full mt-4" />
            </div>
          ))}
        </div>
      ) : displayProducts?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <PackageX className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-800">Nenhum produto encontrado</h3>
          <p className="text-slate-500 mt-2 max-w-sm text-sm">
            {isSearching ? `Nada para "${searchTerm}". Tente outros termos.` : "Ainda não há produtos nesta categoria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {displayProducts?.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
              >
                <ProductCard product={product} onClick={() => setSelectedProduct(product)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setSelectedProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              {/* Image */}
              <div className="w-full md:w-1/2 bg-slate-100 relative min-h-[250px]">
                <img
                  src={selectedProduct.imagem || "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=800&q=80"}
                  alt={selectedProduct.nome}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                >✕</button>

                <span className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2 block">
                  {CATEGORY_LABELS[selectedProduct.categoria ?? ""] ?? selectedProduct.categoria}
                </span>
                <h2 className="text-2xl font-black text-slate-900 leading-tight mb-4">{selectedProduct.nome}</h2>

                <div className="space-y-2 mb-6">
                  {selectedProduct.medidas && (
                    <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                      <span className="text-slate-500">Medidas</span>
                      <span className="font-semibold text-slate-800">{selectedProduct.medidas}</span>
                    </div>
                  )}
                  {selectedProduct.altura && (
                    <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                      <span className="text-slate-500">Altura</span>
                      <span className="font-semibold text-slate-800">{selectedProduct.altura}</span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-5">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm text-slate-500">Valor Pix</span>
                    <span className="text-2xl font-black text-red-600">{selectedProduct.precoPix || "Consulte"}</span>
                  </div>
                  {selectedProduct.preco && (
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/60">
                      <span className="text-xs text-slate-500">Cartão até {selectedProduct.parcelamento}</span>
                      <span className="text-sm font-semibold text-slate-700">{selectedProduct.preco}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-auto">
                  <a
                    href={`https://wa.me/${waInfo.numero}?text=${encodeURIComponent(gerarMsgWA(selectedProduct, waInfo.contato, waInfo.loja))}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackCatalogoWhatsApp(selectedProduct.nome, waInfo.loja)}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-green-500/25 transition-all active:scale-95"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Tenho interesse
                  </a>
                  {selectedProduct.link && (
                    <a
                      href={selectedProduct.link}
                      target="_blank"
                      rel="noreferrer"
                      className="w-14 flex items-center justify-center bg-white border-2 border-slate-200 rounded-xl text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
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
