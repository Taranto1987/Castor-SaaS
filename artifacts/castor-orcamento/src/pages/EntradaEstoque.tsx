import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Upload, Package, Check, X, Search, Loader2,
  ChevronDown, ChevronUp, AlertTriangle, History, ArrowLeft,
  Link2, Link2Off, FileText
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Step = "upload" | "review" | "done";

interface MarkupSuggestion {
  categoria: string | null;
  markupPercent: number;
  outletMarkupPercent: number;
  precoSugerido: number;
  outletPrice: number;
}

interface ItemExtraido {
  nome: string;
  quantidade: number;
  sku: string | null;
  precoCusto: string | null;
  custoUnitario?: number | null;
}

interface ProdutoMatch {
  id: number;
  nome: string;
  sku: string | null;
  medidas: string | null;
  estoqueAtual: number | null;
  custoBRL: string | null;
  categoria?: string | null;
}

interface ItemComMatch extends ItemExtraido {
  produtoMatch: ProdutoMatch | null;
  score: number;
  markup?: MarkupSuggestion | null;
}

interface ProdutoBusca {
  id: number;
  nome: string;
  sku: string | null;
  medidas: string | null;
  estoque: number | null;
  custoBRL: string | null;
}

interface EntradaHistorico {
  id: number;
  fornecedor: string | null;
  totalItens: number;
  criadoEm: string;
  itens: Array<{
    id: number;
    nomeExtraido: string;
    quantidade: number;
    precoCusto: string | null;
    produtoId: number | null;
  }>;
}

export default function EntradaEstoque() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = user?.sessionToken || "";

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [numeroNF, setNumeroNF] = useState<string | null>(null);
  const [cnpjFornecedor, setCnpjFornecedor] = useState<string | null>(null);
  const [itensRevisao, setItensRevisao] = useState<ItemComMatch[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState<number | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<ProdutoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);

  const { data: historico = [] } = useQuery<EntradaHistorico[]>({
    queryKey: ["entrada-estoque-historico"],
    queryFn: async () => {
      const res = await fetch("/api/entrada-estoque/historico", {
        headers: { "x-session-token": token },
      });
      return res.json();
    },
  });

  const handleFileSelect = useCallback(async (file: File) => {
    setLoading(true);

    try {
      const isXml = file.type === "application/xml" || file.type === "text/xml" || file.name.endsWith(".xml");

      let extractData: { fornecedor?: string; cnpjFornecedor?: string; numeroNF?: string; itens: ItemExtraido[] };

      if (isXml) {
        setLoadingMsg("Processando XML NF-e...");
        const formData = new FormData();
        formData.append("arquivo", file);
        const res = await fetch("/api/entrada-estoque/extrair-xml", {
          method: "POST",
          headers: { "x-session-token": token },
          body: formData,
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao processar XML"); }
        extractData = await res.json();
        setNumeroNF(extractData.numeroNF ?? null);
        setCnpjFornecedor(extractData.cnpjFornecedor ?? null);
      } else {
        setLoadingMsg("Enviando imagem para análise...");
        const formData = new FormData();
        formData.append("imagem", file);
        const res = await fetch("/api/entrada-estoque/extrair", {
          method: "POST",
          headers: { "x-session-token": token },
          body: formData,
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao processar imagem"); }
        extractData = await res.json();
        setNumeroNF(null);
        setCnpjFornecedor(null);
      }

      setFornecedor(extractData.fornecedor || "");
      setLoadingMsg("Calculando correspondências e markup...");

      const matchRes = await fetch("/api/entrada-estoque/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ itens: extractData.itens }),
      });

      if (!matchRes.ok) throw new Error("Erro ao buscar correspondências");

      const matchData: ItemComMatch[] = await matchRes.json();
      setItensRevisao(matchData);
      setStep("review");

      toast({
        title: "Nota processada!",
        description: `${matchData.length} itens extraídos. Revise e confirme.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar nota fiscal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }, [toast, token]);

  const handleCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.setAttribute("accept", "image/*");
      fileInputRef.current.click();
    }
  };

  const handleUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.setAttribute("accept", "image/*,application/pdf");
      fileInputRef.current.click();
    }
  };

  const handleUploadXml = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.setAttribute("accept", ".xml,application/xml,text/xml");
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  const updateItem = (index: number, updates: Partial<ItemComMatch>) => {
    setItensRevisao((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const removeItem = (index: number) => {
    setItensRevisao((prev) => prev.filter((_, i) => i !== index));
  };

  const buscarProduto = async (termo: string) => {
    if (termo.length < 2) {
      setResultadosBusca([]);
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch(`/api/entrada-estoque/produtos/buscar?q=${encodeURIComponent(termo)}`, {
        headers: { "x-session-token": token },
      });
      const data = await res.json();
      setResultadosBusca(data);
    } catch {
      setResultadosBusca([]);
    } finally {
      setBuscando(false);
    }
  };

  const vincularProduto = (itemIndex: number, produto: ProdutoBusca) => {
    updateItem(itemIndex, {
      produtoMatch: {
        id: produto.id,
        nome: produto.nome,
        sku: produto.sku,
        medidas: produto.medidas,
        estoqueAtual: produto.estoque,
        custoBRL: produto.custoBRL,
      },
      score: 100,
    });
    setBuscaAberta(null);
    setTermoBusca("");
    setResultadosBusca([]);
  };

  const desvincular = (index: number) => {
    updateItem(index, { produtoMatch: null, score: 0 });
  };

  const confirmarEntrada = async () => {
    setLoading(true);
    setLoadingMsg("Registrando entrada...");

    try {
      const payload = {
        fornecedor:     fornecedor || null,
        numeroNF:       numeroNF,
        cnpjFornecedor: cnpjFornecedor,
        itens: itensRevisao.map((item) => ({
          nomeExtraido:        item.nome,
          skuExtraido:         item.sku,
          quantidade:          item.quantidade,
          precoCusto:          item.precoCusto,
          custoUnitario:       item.custoUnitario ?? null,
          markupPercent:       item.markup?.markupPercent ?? null,
          outletMarkupPercent: item.markup?.outletMarkupPercent ?? null,
          outletPrice:         item.markup?.outletPrice ?? null,
          precoSugerido:       item.markup?.precoSugerido ?? null,
          produtoId:           item.produtoMatch?.id || null,
        })),
      };

      const res = await fetch("/api/entrada-estoque/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erro ao confirmar entrada");

      queryClient.invalidateQueries({ queryKey: ["entrada-estoque-historico"] });

      toast({
        title: "Entrada confirmada!",
        description: `${itensRevisao.length} itens registrados no estoque.`,
      });

      setStep("done");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao confirmar entrada",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const novaEntrada = () => {
    setStep("upload");
    setItensRevisao([]);
    setFornecedor("");
    setNumeroNF(null);
    setCnpjFornecedor(null);
    setShowHistorico(false);
  };

  const itensVinculados = itensRevisao.filter((i) => i.produtoMatch);
  const itensSemVinculo = itensRevisao.filter((i) => !i.produtoMatch);

  return (
    <div className="space-y-6 pb-24">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Entrada de Estoque
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tire uma foto da nota fiscal para registrar entrada
          </p>
        </div>
        <button
          onClick={() => setShowHistorico(!showHistorico)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
        >
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">Histórico</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showHistorico && (
          <motion.div
            key="historico"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4" />
                Últimas Entradas
              </h2>
              {historico.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Nenhuma entrada registrada ainda</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {historico.map((entrada) => (
                    <div key={entrada.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {entrada.fornecedor || "Fornecedor não identificado"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(entrada.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}{entrada.totalItens} {entrada.totalItens === 1 ? "item" : "itens"}
                        </p>
                      </div>
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 space-y-4"
          >
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
            <p className="text-sm font-medium text-slate-600 text-center">{loadingMsg}</p>
          </motion.div>
        )}

        {!loading && step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={handleCapture}
                className="flex flex-col items-center justify-center gap-3 p-8 bg-primary/5 hover:bg-primary/10 border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-xl transition-all group"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Tirar Foto</p>
                  <p className="text-xs text-slate-500 mt-1">Use a câmera do celular</p>
                </div>
              </button>

              <button
                onClick={handleUpload}
                className="flex flex-col items-center justify-center gap-3 p-8 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl transition-all group"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Upload</p>
                  <p className="text-xs text-slate-500 mt-1">Imagem ou PDF da nota</p>
                </div>
              </button>

              <button
                onClick={handleUploadXml}
                className="flex flex-col items-center justify-center gap-3 p-8 bg-emerald-50 hover:bg-emerald-100 border-2 border-dashed border-emerald-200 hover:border-emerald-400 rounded-xl transition-all group"
              >
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">XML NF-e</p>
                  <p className="text-xs text-slate-500 mt-1">Dados precisos + markup</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {!loading && step === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={novaEntrada}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Fornecedor (ex: Castor Colchões)"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1 text-green-600">
                <Link2 className="w-3 h-3" />
                {itensVinculados.length} vinculados
              </span>
              {itensSemVinculo.length > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Link2Off className="w-3 h-3" />
                  {itensSemVinculo.length} sem vínculo
                </span>
              )}
              <span className="text-slate-500">
                {itensRevisao.length} {itensRevisao.length === 1 ? "item" : "itens"} total
              </span>
            </div>

            <div className="space-y-3">
              {itensRevisao.map((item, index) => (
                <motion.div
                  key={index}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "bg-white rounded-xl border p-4 space-y-3",
                    item.produtoMatch
                      ? "border-green-200 bg-green-50/30"
                      : "border-amber-200 bg-amber-50/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.nome}</p>
                      {item.sku && (
                        <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Qtd:</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) =>
                          updateItem(index, {
                            quantidade: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-16 text-sm border border-slate-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-slate-500">Custo:</label>
                      <input
                        type="text"
                        value={item.precoCusto || ""}
                        onChange={(e) =>
                          updateItem(index, { precoCusto: e.target.value || null })
                        }
                        placeholder="R$ 0,00"
                        className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {item.markup && item.markup.precoSugerido > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        Markup {item.markup.markupPercent}% → R$ {item.markup.precoSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        Outlet {item.markup.outletMarkupPercent}% → R$ {item.markup.outletPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {item.produtoMatch ? (
                    <div className="flex items-center justify-between bg-green-50 rounded-lg p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className="w-4 h-4 text-green-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-green-800 truncate">
                            {item.produtoMatch.nome}
                          </p>
                          <p className="text-[10px] text-green-600">
                            Estoque atual: {item.produtoMatch.estoqueAtual ?? "N/A"}
                            {item.produtoMatch.medidas && ` · ${item.produtoMatch.medidas}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => desvincular(index)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 shrink-0"
                      >
                        Desvincular
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Sem correspondência automática</span>
                      </div>
                      {buscaAberta === index ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={termoBusca}
                              onChange={(e) => {
                                setTermoBusca(e.target.value);
                                buscarProduto(e.target.value);
                              }}
                              placeholder="Buscar produto por nome, SKU..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/20"
                              autoFocus
                            />
                          </div>
                          {buscando && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Buscando...
                            </div>
                          )}
                          {resultadosBusca.length > 0 && (
                            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                              {resultadosBusca.map((prod) => (
                                <button
                                  key={prod.id}
                                  onClick={() => vincularProduto(index, prod)}
                                  className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors"
                                >
                                  <p className="text-xs font-medium text-slate-800 truncate">{prod.nome}</p>
                                  <p className="text-[10px] text-slate-500">
                                    {prod.sku && `SKU: ${prod.sku} · `}
                                    Estoque: {prod.estoque ?? "N/A"}
                                    {prod.medidas && ` · ${prod.medidas}`}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setBuscaAberta(null);
                              setTermoBusca("");
                              setResultadosBusca([]);
                            }}
                            className="text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cancelar busca
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setBuscaAberta(index);
                            setTermoBusca("");
                            setResultadosBusca([]);
                          }}
                          className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                        >
                          <Search className="w-3 h-3" />
                          Buscar produto manualmente
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {itensRevisao.length > 0 && (
              <div className="sticky bottom-20 md:bottom-4 z-40">
                <button
                  onClick={confirmarEntrada}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Confirmar Entrada ({itensRevisao.length} {itensRevisao.length === 1 ? "item" : "itens"})
                </button>
                {itensSemVinculo.length > 0 && (
                  <p className="text-xs text-center text-amber-600 mt-2">
                    {itensSemVinculo.length} {itensSemVinculo.length === 1 ? "item não vinculado será registrado" : "itens não vinculados serão registrados"} apenas no histórico
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {!loading && step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 space-y-6"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Entrada Registrada!</h2>
              <p className="text-sm text-slate-500">
                O estoque foi atualizado com sucesso.
              </p>
            </div>
            <button
              onClick={novaEntrada}
              className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-xl transition-all"
            >
              Nova Entrada
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
