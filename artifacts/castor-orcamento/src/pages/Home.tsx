import { useState } from "react";
import { Search, Loader2, PackageX, ExternalLink, FileText } from "lucide-react";
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
import type { Produto as ProdutoBase } from "@workspace/api-client-react";
type Produto = ProdutoBase & { slug?: string | null };

export default function Home() {
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todas");
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 400);
  const isSearching = debouncedSearch.length > 0;

  // Queries
  const { data: categoriasData } = useListCategorias();
  
  const { 
    data: listData, 
    isLoading: isLoadingList 
  } = useListProdutos(
    { categoria: activeCategory !== "Todas" ? activeCategory : undefined },
    { query: { enabled: !isSearching } as any }
  );

  const { 
    data: searchData, 
    isLoading: isLoadingSearch 
  } = useBuscarProdutos(
    { q: debouncedSearch },
    { query: { enabled: isSearching } as any }
  );

  const categorias = ["Todas", ...(categoriasData || [])];
  const displayProducts = isSearching ? searchData : listData;
  const isLoading = isSearching ? isLoadingSearch : isLoadingList;

  const handleGenerateQuote = (id: number) => {
    setLocation(`/orcamento?produtoId=${id}`);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Catálogo de Produtos
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base max-w-2xl">
            Navegue por todo o portfólio da loja. Selecione um produto para ver detalhes ou gerar um orçamento.
          </p>
        </div>
        
        <div className="w-full md:w-96 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      {!isSearching && (
        <div className="flex flex-wrap gap-2">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 border",
                activeCategory === cat
                  ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
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
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <PackageX className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Nenhum produto encontrado</h3>
          <p className="text-slate-500 mt-2 max-w-sm">
            {isSearching 
              ? `Não achamos nada para "${searchTerm}". Tente outros termos.`
              : `Ainda não há produtos nesta categoria.`}
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
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <ProductCard 
                  product={product} 
                  onClick={() => setSelectedProduct(product)} 
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Product Details Modal overlay */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedProduct(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              {/* Image side */}
              <div className="w-full md:w-1/2 bg-slate-100 relative min-h-[250px]">
                <img 
                  src={selectedProduct.imagem || "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=800&q=80"} 
                  alt={selectedProduct.nome}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              
              {/* Content side */}
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col">
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  ✕
                </button>
                
                <span className="text-xs font-bold uppercase tracking-wider text-primary mb-2 block">
                  {selectedProduct.categoria}
                </span>
                
                <h2 className="text-2xl font-display font-bold text-slate-900 leading-tight mb-4">
                  {selectedProduct.nome}
                </h2>
                
                <div className="space-y-3 mb-8">
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
                  {selectedProduct.sku && (
                    <div className="flex justify-between py-2 border-b border-slate-100 text-sm">
                      <span className="text-slate-500">SKU/Ref</span>
                      <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{selectedProduct.sku}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-sm text-slate-500">Valor Pix</span>
                      <span className="text-2xl font-bold text-primary">{selectedProduct.precoPix || 'Consulte'}</span>
                    </div>
                    {selectedProduct.preco && (
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/60">
                        <span className="text-xs text-slate-500">Cartão até {selectedProduct.parcelamento}</span>
                        <span className="text-sm font-semibold text-slate-700">{selectedProduct.preco}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleGenerateQuote(selectedProduct.id)}
                      className="flex-1 bg-primary text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      Gerar Orçamento
                    </button>
                    {selectedProduct.slug && (
                      <a
                        href={`/produto/${selectedProduct.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-14 flex items-center justify-center bg-white border-2 border-slate-200 rounded-xl text-slate-500 hover:text-primary hover:border-primary transition-colors"
                        title="Página do produto"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
