import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, RefreshCw, ChevronDown } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { useBuscarProdutos, useListProdutos } from "@workspace/api-client-react";
import type { Produto } from "@workspace/api-client-react";

const CATEGORIAS = [
  { id: "todas", label: "Todos" },
  { id: "colchoes", label: "Colchões", db: "colchoes" },
  { id: "cama-box-colchao", label: "Cama Box + Colchão", db: "cama-box-colchao", excluir: ["baú", "bau", "auxiliar"] },
  { id: "cama-box-bau", label: "Cama Box Baú", db: "cama-box-colchao", incluir: ["baú", "bau"] },
  { id: "cama-box-auxiliar", label: "Box c/ Auxiliar", db: "cama-box-colchao", incluir: ["auxiliar"] },
  { id: "travesseiros", label: "Travesseiros", db: "travesseiros" },
];

const TAMANHOS = [
  { id: "todos", label: "Todos" },
  { id: "solteiro", label: "Solteiro", termos: ["solteiro", "88x188", "96x203", "100x200"] },
  { id: "casal", label: "Casal", termos: ["casal", "138x188", "120x203"] },
  { id: "queen", label: "Queen", termos: ["queen", "158x198"] },
  { id: "king", label: "King", termos: ["king", "193x203"] },
];

function filtrarPorCategoria(produtos: Produto[], catId: string): Produto[] {
  const cat = CATEGORIAS.find(c => c.id === catId);
  if (!cat || catId === "todas") return produtos;

  return produtos.filter(p => {
    const nome = p.nome.toLowerCase();
    if (cat.incluir) {
      return cat.incluir.some(t => nome.includes(t));
    }
    if (cat.excluir) {
      return !cat.excluir.some(t => nome.includes(t));
    }
    return true;
  });
}

function filtrarPorTamanho(produtos: Produto[], tamId: string): Produto[] {
  if (tamId === "todos") return produtos;
  const tam = TAMANHOS.find(t => t.id === tamId);
  if (!tam || !tam.termos) return produtos;
  return produtos.filter(p => {
    const nome = p.nome.toLowerCase();
    return tam.termos!.some(t => nome.includes(t.toLowerCase()));
  });
}

interface Props {
  onAdd: (produto: Produto) => void;
  carrinhoIds: number[];
}

export default function ProductPicker({ onAdd, carrinhoIds }: Props) {
  const [open, setOpen] = useState(false);
  const [catAtiva, setCatAtiva] = useState("todas");
  const [tamAtivo, setTamAtivo] = useState("todos");
  const [busca, setBusca] = useState("");
  const debouncedBusca = useDebounce(busca, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const catAtual = CATEGORIAS.find(c => c.id === catAtiva);
  const dbCategoria = catAtual?.db;

  const { data: listaProdutos, isLoading: isLoadingLista } = useListProdutos(
    { categoria: dbCategoria, limite: 500 },
    { query: { enabled: open && !debouncedBusca } }
  );

  const { data: resultadosBusca, isLoading: isSearching } = useBuscarProdutos(
    { q: debouncedBusca, categoria: dbCategoria },
    { query: { enabled: open && debouncedBusca.length > 1 } }
  );

  const produtosBase = debouncedBusca.length > 1 ? (resultadosBusca || []) : (listaProdutos || []);

  let produtosFiltrados = filtrarPorCategoria(produtosBase, catAtiva);
  produtosFiltrados = filtrarPorTamanho(produtosFiltrados, tamAtivo);

  const isLoading = debouncedBusca.length > 1 ? isSearching : isLoadingLista;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAdd = (p: Produto) => {
    onAdd(p);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:bg-blue-600 transition-all"
      >
        <span className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Adicionar Produto
        </span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "70vh" }}
          >
            {/* Header */}
            <div className="p-3 border-b border-slate-100 space-y-2 sticky top-0 bg-white z-10">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
                {busca && (
                  <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {CATEGORIAS.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setCatAtiva(cat.id); setTamAtivo("todos"); }}
                    className={cn(
                      "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                      catAtiva === cat.id
                        ? "bg-primary text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Size filter — only for non-travesseiro/todas categories */}
              {catAtiva !== "travesseiros" && (
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                  {TAMANHOS.map(tam => (
                    <button
                      key={tam.id}
                      onClick={() => setTamAtivo(tam.id)}
                      className={cn(
                        "flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                        tamAtivo === tam.id
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {tam.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product list */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 160px)" }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  Nenhum produto encontrado.
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  <p className="text-xs text-slate-400 font-medium px-2 py-1">
                    {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? "s" : ""}
                  </p>
                  {produtosFiltrados.map(p => {
                    const jaAdicionado = carrinhoIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-xl transition-colors",
                          jaAdicionado
                            ? "bg-primary/5 border border-primary/20"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <img
                          src={p.imagem || "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=80"}
                          alt={p.nome}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{p.nome.trim()}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {p.medidas && <span className="text-xs text-slate-400">{p.medidas}</span>}
                            {p.precoPix && <span className="text-xs text-emerald-600 font-bold">{p.precoPix} PIX</span>}
                            {p.preco && <span className="text-xs text-slate-400">{p.preco} prazo</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAdd(p)}
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                            jaAdicionado
                              ? "bg-primary/10 text-primary hover:bg-primary/20"
                              : "bg-primary text-white hover:bg-blue-600 shadow-sm"
                          )}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
