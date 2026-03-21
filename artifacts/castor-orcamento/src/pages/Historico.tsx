import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronDown, ChevronUp, Copy, CheckCircle2, Phone, Package, RefreshCw, FileText } from "lucide-react";
import { useHistoricoOrcamentos } from "@workspace/api-client-react";
import type { HistoricoItem } from "@workspace/api-client-react/src/generated/api.schemas";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatarData(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function formatarNumero(whatsapp?: string) {
  if (!whatsapp) return null;
  const digitos = whatsapp.replace(/\D/g, "");
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function ItemCard({ item }: { item: HistoricoItem }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const produtos = Array.isArray(item.produtosJson) ? item.produtosJson as any[] : [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.texto);
      setCopied(true);
      toast({ title: "Copiado!", description: "Texto do orçamento copiado." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  const handleWhatsApp = () => {
    const numero = (item.whatsapp || "").replace(/\D/g, "");
    const texto = encodeURIComponent(item.texto);
    const url = numero
      ? `https://wa.me/55${numero}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">{item.cliente}</span>
            {item.whatsapp && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" />{formatarNumero(item.whatsapp)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatarData(item.criadoEm)}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />{produtos.length} {produtos.length === 1 ? "produto" : "produtos"}
            </span>
            {item.totalPix && (
              <span className="text-emerald-600 font-bold">PIX {item.totalPix}</span>
            )}
            {item.totalPrazo && (
              <span className="text-blue-600 font-bold">Prazo {item.totalPrazo}</span>
            )}
            {item.descontoPix && item.descontoPix > 0 ? (
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold">
                -{item.descontoPix}% PIX
              </span>
            ) : null}
          </div>
          {produtos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {produtos.slice(0, 3).map((p: any, i: number) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {p.nome}
                </span>
              ))}
              {produtos.length > 3 && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  +{produtos.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              copied
                ? "bg-green-100 text-green-700"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-600 text-white transition-all"
          >
            <Phone className="w-3.5 h-3.5" />
            WA
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-500"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Texto do Orçamento</p>
              <div className="whatsapp-bubble p-4 text-[13px] whitespace-pre-wrap leading-relaxed">
                {item.texto}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Historico() {
  const { data: historico, isLoading, refetch } = useHistoricoOrcamentos();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Histórico
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base">
            Todos os orçamentos gerados e salvos pela equipe.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Carregando histórico...</p>
        </div>
      ) : !historico || historico.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-2">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Nenhum orçamento salvo ainda</p>
          <p className="text-sm text-slate-400">Gere um orçamento e clique em "Salvar" para aparecer aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">{historico.length} orçamento{historico.length !== 1 ? "s" : ""} encontrado{historico.length !== 1 ? "s" : ""}</p>
          {historico.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
