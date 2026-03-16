import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Copy, CheckCircle2, MessageCircle, RefreshCw, FileText, Plus, X, ShoppingCart } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useBuscarProdutos,
  useGerarOrcamento,
} from "@workspace/api-client-react";
import type { Produto } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Orcamento() {
  const { toast } = useToast();

  const [cliente, setCliente] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [carrinho, setCarrinho] = useState<Produto[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: searchResults, isLoading: isSearching } = useBuscarProdutos(
    { q: debouncedSearch },
    { query: { enabled: debouncedSearch.length > 1 } }
  );

  const { mutate: generateQuote, data: quoteResult, isPending: isGenerating } = useGerarOrcamento();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddProduct = (p: Produto) => {
    setCarrinho(prev => [...prev, p]);
    setSearchQuery("");
    setIsSearchOpen(false);
    toast({ title: "Produto adicionado", description: p.nome });
  };

  const handleRemoveProduct = (index: number) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (!cliente.trim() || carrinho.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome do cliente e adicione pelo menos um produto.",
        variant: "destructive"
      });
      return;
    }

    generateQuote({
      data: {
        cliente,
        produtoIds: carrinho.map(p => p.id),
        observacoes: observacoes.trim() || undefined
      }
    });
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!quoteResult?.texto) return;
    try {
      await navigator.clipboard.writeText(quoteResult.texto);
      setCopied(true);
      toast({ title: "Sucesso", description: "Orçamento copiado para a área de transferência!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
          Gerador de Orçamento VIP
        </h1>
        <p className="text-slate-500 mt-2 text-sm md:text-base max-w-2xl">
          Monte combos com vários produtos e gere a mensagem padrão VIP da loja pronta para o WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">

            {/* Cliente */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Nome do Cliente</label>
              <input
                type="text"
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              />
            </div>

            {/* Busca de produto */}
            <div className="space-y-2 relative" ref={searchRef}>
              <label className="text-sm font-bold text-slate-700">Adicionar Produto</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Buscar colchão, box, cama baú..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-sm"
                />
              </div>

              <AnimatePresence>
                {isSearchOpen && debouncedSearch.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto"
                  >
                    {isSearching ? (
                      <div className="p-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Buscando...
                      </div>
                    ) : searchResults && searchResults.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {searchResults.map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group"
                          >
                            <img
                              src={p.imagem || "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=100"}
                              alt={p.nome}
                              className="w-12 h-12 rounded object-cover border border-slate-100 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{p.nome}</p>
                              <div className="flex gap-2 text-xs text-slate-500">
                                <span>{p.medidas}</span>
                                <span className="text-primary font-semibold">{p.precoPix}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-4 h-4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">Nenhum produto encontrado.</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Carrinho de produtos */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-500" />
                <label className="text-sm font-bold text-slate-700">
                  Produtos no Orçamento
                  {carrinho.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs rounded-full font-bold">
                      {carrinho.length}
                    </span>
                  )}
                </label>
              </div>

              {carrinho.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm gap-1">
                  <ShoppingCart className="w-6 h-6 mb-1 opacity-40" />
                  Nenhum produto adicionado ainda
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {carrinho.map((p, i) => (
                      <motion.div
                        key={`${p.id}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <img
                          src={p.imagem || "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=100"}
                          alt={p.nome}
                          className="w-10 h-10 rounded object-cover border border-slate-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{p.nome}</p>
                          {p.precoPix && (
                            <p className="text-xs text-primary font-semibold">{p.precoPix} PIX</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveProduct(i)}
                          className="flex-shrink-0 w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">
                Observações <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Ex: Frete grátis, entrega amanhã, 2 travesseiros de brinde..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm resize-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !cliente || carrinho.length === 0}
              className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> Gerando...</>
              ) : (
                <><MessageCircle className="w-5 h-5" /> Gerar Orçamento VIP</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Result */}
        <div className="lg:col-span-7">
          {quoteResult ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-inner flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2000')] opacity-5 bg-cover bg-center mix-blend-multiply pointer-events-none" />

              <div className="w-full max-w-md relative z-10">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Prévia WhatsApp
                  </span>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                      copied
                        ? "bg-green-100 text-green-700"
                        : "bg-white text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copiado!" : "Copiar Texto"}
                  </button>
                </div>

                <div className="whatsapp-bubble p-5 shadow-sm text-[15px] whitespace-pre-wrap">
                  {quoteResult.texto}
                </div>

                <p className="text-center text-xs text-slate-400 mt-6 font-medium">
                  Copie o texto acima e cole direto na conversa do cliente.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-300 mb-4 rotate-12">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-700">Pronto para criar</h3>
              <p className="text-slate-500 mt-2 max-w-sm">
                Adicione produtos ao orçamento e clique em <strong>Gerar Orçamento VIP</strong> para ver a prévia formatada.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
