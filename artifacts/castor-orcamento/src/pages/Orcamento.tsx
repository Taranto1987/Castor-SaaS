import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, CheckCircle2, MessageCircle, RefreshCw, FileText,
  X, ShoppingCart, Phone, Percent, ExternalLink, Save, Printer,
  User, MapPin, Tag, TrendingDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useGerarOrcamento,
  useSalvarOrcamento,
} from "@workspace/api-client-react";
import type { Produto } from "@workspace/api-client-react/src/generated/api.schemas";
import ProductPicker from "@/components/ProductPicker";
import { useAuth } from "@/contexts/AuthContext";
import { personalizarTexto } from "@/lib/personalizarTexto";
import { trackOrcamentoGerado, trackOrcamentoSalvo, trackWhatsAppClick, trackPageView } from "@/lib/tracking";

const OPERACAO_LABEL: Record<string, string> = {
  cabo_frio: "Cabo Frio + Região",
  araruama:  "Araruama",
};

export default function Orcamento() {
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => { trackPageView("orcamento"); }, []);

  const [cliente, setCliente] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [carrinho, setCarrinho] = useState<Produto[]>([]);
  const [descontoPix, setDescontoPix] = useState<number>(0);

  const { mutate: generateQuote, data: quoteResult, isPending: isGenerating } = useGerarOrcamento();
  const { mutate: saveQuote, isPending: isSaving } = useSalvarOrcamento();

  // ── Precificação hierárquica em tempo real ────────────────────────────────────
  // REGRA: todo desconto calculado sobre preço cheio, nunca sobre preço já reduzido
  const precificacao = useMemo(() => {
    const parseBRL = (s?: string | null) =>
      s ? parseFloat(s.replace(/[R$\s.]/g, "").replace(",", ".")) || 0 : 0;
    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const precoBaseTotal = carrinho.reduce((sum, p) => {
      // usa precoBase numérico se disponível, senão parseia o campo preco
      const base = (p as any).precoBase ?? parseBRL(p.preco);
      return sum + base;
    }, 0);

    const totalDescontoPct = 15 + descontoPix; // desconto total sempre sobre preço cheio
    const pixFinal = precoBaseTotal * (1 - totalDescontoPct / 100);
    const economiaTotal = precoBaseTotal - pixFinal;

    return {
      precoBaseTotal,
      pixFinal,
      economiaTotal,
      totalDescontoPct,
      fmt,
    };
  }, [carrinho, descontoPix]);

  // ── Texto personalizado ──────────────────────────────────────────────────────
  const textoPersonalizado = useMemo(() => {
    if (!quoteResult?.texto) return "";
    if (!user) return quoteResult.texto;
    return personalizarTexto(quoteResult.texto, user, cliente);
  }, [quoteResult?.texto, user, cliente]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAddProduct = (p: Produto) => {
    setCarrinho(prev => [...prev, p]);
    toast({ title: "Adicionado", description: p.nome.trim().slice(0, 60) });
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
        whatsapp: whatsapp.trim() || undefined,
        produtoIds: carrinho.map(p => p.id),
        observacoes: observacoes.trim() || undefined,
        descontoPix: descontoPix > 0 ? descontoPix : undefined,
      }
    }, {
      onSuccess: (data) => {
        trackOrcamentoGerado(data?.totalPix ?? "", carrinho.length);
      },
    });
  };

  const handleSave = () => {
    if (!quoteResult) return;
    saveQuote({
      data: {
        cliente,
        whatsapp: whatsapp.trim() || undefined,
        produtosJson: carrinho,
        observacoes: observacoes.trim() || undefined,
        descontoPix: descontoPix > 0 ? descontoPix : undefined,
        totalPix: quoteResult.totalPix,
        totalPrazo: quoteResult.totalPrazo,
        texto: textoPersonalizado,
        vendedor: user?.nome ?? undefined,
        precoBaseTotal: (quoteResult as any).totalPrecoBase ?? undefined,
        descontoAplicado: (quoteResult as any).descontoAplicado ?? undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Salvo!", description: "Orçamento salvo no histórico." });
        trackOrcamentoSalvo(quoteResult?.totalPix ?? "");
      },
      onError:   () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
    });
  };

  const handleOpenWhatsApp = () => {
    if (!textoPersonalizado) return;
    trackWhatsAppClick("orcamento", user?.operacao === "araruama" ? "Araruama" : "Cabo Frio");
    const numero = whatsapp.replace(/\D/g, "");
    const texto  = encodeURIComponent(textoPersonalizado);
    const url    = numero
      ? `https://wa.me/55${numero}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    if (!textoPersonalizado) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Orçamento - ${cliente}</title>
    <style>body{font-family:monospace;white-space:pre-wrap;padding:32px;font-size:14px;line-height:1.6}</style>
    </head><body>${textoPersonalizado.replace(/</g, "&lt;")}</body></html>`);
    win.document.close();
    win.print();
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!textoPersonalizado) return;
    try {
      await navigator.clipboard.writeText(textoPersonalizado);
      setCopied(true);
      toast({ title: "Copiado!", description: "Orçamento copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Gerador de Orçamento VIP
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base max-w-2xl">
            Monte combos com vários produtos e gere a mensagem personalizada pronta para o WhatsApp.
          </p>
        </div>

        {/* Collaborator badge */}
        {user && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-2xl border text-sm font-bold shrink-0",
            user.operacao === "araruama"
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-primary/10 border-primary/20 text-primary"
          )}>
            <User className="w-4 h-4" />
            <span>{user.nome.split(" ")[0]}</span>
            <span className="font-normal text-slate-400">·</span>
            <MapPin className="w-3.5 h-3.5" />
            <span className="font-normal">{OPERACAO_LABEL[user.operacao]}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">

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

            {/* WhatsApp do cliente */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-green-500" />
                WhatsApp do Cliente
                <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="Ex: 22 99999-9999"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-green-400 focus:ring-4 focus:ring-green-400/10 transition-all font-medium"
              />
            </div>

            {/* Product Picker */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Produtos</label>
              <ProductPicker
                onAdd={handleAddProduct}
                carrinhoIds={carrinho.map(p => p.id)}
              />
            </div>

            {/* Carrinho */}
            {carrinho.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-700">
                    No orçamento
                    <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs rounded-full font-bold">
                      {carrinho.length}
                    </span>
                  </span>
                </div>
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
                          src={p.imagem || "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=80"}
                          alt={p.nome}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug">{p.nome.trim()}</p>
                          {p.precoPix && (
                            <p className="text-xs text-emerald-600 font-semibold mt-0.5">{p.precoPix} PIX</p>
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
              </div>
            )}

            {/* Desconto PIX */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-emerald-500" />
                Desconto PIX
                <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={descontoPix || ""}
                  onChange={e => setDescontoPix(Math.max(0, Math.min(100, Number(e.target.value))))}
                  placeholder="0"
                  className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all font-medium"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
              </div>
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

            {/* Breakdown de precificação hierárquica em tempo real */}
            {carrinho.length > 0 && precificacao.precoBaseTotal > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Precificação
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Preço cheio</span>
                  <span className="font-semibold text-slate-700 line-through">
                    {precificacao.fmt(precificacao.precoBaseTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                    Desconto PIX ({precificacao.totalDescontoPct}% sobre preço cheio)
                  </span>
                  <span className="font-bold text-emerald-600">
                    -{precificacao.fmt(precificacao.economiaTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-sm font-bold text-slate-800">Preço final PIX</span>
                  <span className="text-lg font-extrabold text-emerald-700">
                    {precificacao.fmt(precificacao.pixFinal)}
                  </span>
                </div>
                {descontoPix > 0 && (
                  <p className="text-[11px] text-amber-600 font-semibold">
                    ⚡ Desconto extra de {descontoPix}% aplicado sobre o preço cheio — não sobre preço PIX.
                  </p>
                )}
              </div>
            )}

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
          {textoPersonalizado ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-inner flex flex-col items-start min-h-[400px] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2000')] opacity-5 bg-cover bg-center mix-blend-multiply pointer-events-none" />

              <div className="w-full relative z-10">
                {/* Collaborator identity bar */}
                {user && (
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold mb-4 w-full",
                    user.operacao === "araruama"
                      ? "bg-blue-50 text-blue-700 border border-blue-100"
                      : "bg-primary/8 text-primary border border-primary/15"
                  )}>
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span>{user.header}</span>
                    <span className="ml-auto font-normal text-slate-400">{user.wa}</span>
                  </div>
                )}

                {/* Totals summary */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">PIX Total</p>
                    <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{quoteResult?.totalPix}</p>
                    {descontoPix > 0 && <p className="text-xs text-emerald-500">{descontoPix}% off</p>}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Prazo Total</p>
                    <p className="text-lg font-extrabold text-blue-700 mt-0.5">{quoteResult?.totalPrazo}</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 text-center">
                    <p className="text-xs text-violet-600 font-bold uppercase tracking-wide">12x de</p>
                    <p className="text-lg font-extrabold text-violet-700 mt-0.5">{quoteResult?.parcela12}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mb-4">
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
                    {copied ? "Copiado!" : "Copiar"}
                  </button>

                  <button
                    onClick={handleOpenWhatsApp}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-green-500 hover:bg-green-600 text-white shadow-sm transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {whatsapp ? "Abrir WhatsApp" : "Enviar WhatsApp"}
                  </button>

                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    PDF
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Prévia WhatsApp</span>
                </div>

                <div className="whatsapp-bubble p-5 shadow-sm text-[14px] whitespace-pre-wrap leading-relaxed">
                  {textoPersonalizado}
                </div>

                <p className="text-center text-xs text-slate-400 mt-4 font-medium">
                  Copie ou abra direto no WhatsApp do cliente.
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
