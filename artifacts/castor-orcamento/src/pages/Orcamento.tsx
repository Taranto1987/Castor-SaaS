import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Copy, CheckCircle2, MessageCircle, RefreshCw, AlertCircle, FileText } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useBuscarProdutos,
  useGerarOrcamento,
  useGetProduto
} from "@workspace/api-client-react";
import type { Produto } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Orcamento() {
  const { toast } = useToast();
  
  // Parse query params for initial product
  const [initialProductId, setInitialProductId] = useState<number | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('produtoId');
    if (pid && !isNaN(Number(pid))) {
      setInitialProductId(Number(pid));
    }
  }, []);

  // Form State
  const [cliente, setCliente] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Queries
  const { data: initialProduto } = useGetProduto(initialProductId || 0, { 
    query: { enabled: !!initialProductId } 
  });
  
  const { data: searchResults, isLoading: isSearching } = useBuscarProdutos(
    { q: debouncedSearch },
    { query: { enabled: debouncedSearch.length > 1 } }
  );

  const { mutate: generateQuote, data: quoteResult, isPending: isGenerating } = useGerarOrcamento();

  // Set initial product when fetched
  useEffect(() => {
    if (initialProduto && !selectedProduto) {
      setSelectedProduto(initialProduto);
      setSearchQuery(initialProduto.nome);
    }
  }, [initialProduto]);

  // Click outside search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProduct = (p: Produto) => {
    setSelectedProduto(p);
    setSearchQuery(p.nome);
    setIsSearchOpen(false);
  };

  const handleGenerate = () => {
    if (!cliente.trim() || !selectedProduto) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome do cliente e selecione um produto.",
        variant: "destructive"
      });
      return;
    }

    generateQuote({
      data: {
        cliente,
        produtoId: selectedProduto.id,
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
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
          Gerador de Orçamento
        </h1>
        <p className="text-slate-500 mt-2 text-sm md:text-base max-w-2xl">
          Crie orçamentos formatados instantaneamente para enviar aos seus clientes no WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-6">
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

            {/* Produto (Autocomplete) */}
            <div className="space-y-2 relative" ref={searchRef}>
              <label className="text-sm font-bold text-slate-700">Produto</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    if (selectedProduto && e.target.value !== selectedProduto.nome) {
                      setSelectedProduto(null);
                    }
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Buscar colchão, box..."
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-sm",
                    selectedProduto && "border-green-400 bg-green-50 text-green-900"
                  )}
                />
                {selectedProduto && (
                  <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>

              {/* Dropdown */}
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
                            onClick={() => handleSelectProduct(p)}
                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <img 
                              src={p.imagem || "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=100"} 
                              alt={p.nome}
                              className="w-12 h-12 rounded object-cover border border-slate-100"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{p.nome}</p>
                              <div className="flex gap-2 text-xs text-slate-500">
                                <span>{p.medidas}</span>
                                <span className="text-primary font-semibold">{p.precoPix}</span>
                              </div>
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

            {/* Observações */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Observações adicionais <span className="font-normal text-slate-400">(opcional)</span></label>
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
              disabled={isGenerating || !cliente || !selectedProduto}
              className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> Gerando...</>
              ) : (
                <><MessageCircle className="w-5 h-5" /> Criar Mensagem</>
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
              {/* Decorative background */}
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

                <div className="whatsapp-bubble p-5 shadow-sm text-[15px]">
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
                Preencha os dados ao lado e clique em gerar para ver a prévia da mensagem formatada.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
