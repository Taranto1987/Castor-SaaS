import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Clock, Plus, X, Package, MessageCircle,
  RefreshCw, Edit3, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { trackOutletPedido, trackWhatsAppClick, trackPageView } from "@/lib/tracking";

interface ProdutoOutlet {
  id: number;
  nome: string;
  categoria: string;
  medidas?: string | null;
  custoBRL?: string | null;
  precoPix?: string | null;
  prazoEncomenda?: string | null;
  descricao?: string | null;
}

function parseBRL(str?: string | null): number {
  if (!str) return 0;
  return parseFloat(str.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcularPrecoVenda(custo?: string | null, precoPix?: string | null): number | null {
  const c = parseBRL(custo);
  if (c > 0) return Math.ceil(c * 1.6);
  const p = parseBRL(precoPix);
  return p > 0 ? p : null;
}

function OutletModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: Partial<ProdutoOutlet>) => void;
}) {
  const [nome, setNome] = useState("");
  const [medidas, setMedidas] = useState("");
  const [custo, setCusto] = useState("");
  const [prazo, setPrazo] = useState("10 dias úteis");
  const [categoria, setCategoria] = useState("colchoes");

  const custoNum = parseBRL(custo);
  const precoVenda = custoNum > 0 ? Math.ceil(custoNum * 1.6) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Novo Produto Outlet</h2>
            <p className="text-xs text-slate-400 mt-0.5">Margem de 60% sobre o custo</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Nome do produto *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Ex: Colchão Castor Premium Pocket Queen"
              value={nome}
              onChange={e => setNome(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Medidas</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="158x198x28cm"
                value={medidas}
                onChange={e => setMedidas(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Categoria</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="colchoes"
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Custo fábrica (R$) *</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="2500"
                value={custo}
                onChange={e => setCusto(e.target.value)}
                type="number"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Prazo entrega</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="10 dias úteis"
                value={prazo}
                onChange={e => setPrazo(e.target.value)}
              />
            </div>
          </div>

          {custoNum > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-semibold">Preço de venda (60% margem)</p>
                <p className="text-xl font-extrabold text-emerald-700">{formatBRL(precoVenda)}</p>
              </div>
              <div className="text-right text-xs text-emerald-600">
                <p>Custo: {formatBRL(custoNum)}</p>
                <p>Margem: {formatBRL(precoVenda - custoNum)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!nome.trim()) return;
              onSave({
                nome: nome.trim(),
                medidas: medidas || undefined,
                custoBRL: custo ? String(custoNum) : undefined,
                prazoEncomenda: prazo || "A combinar",
                categoria: categoria || "colchoes",
              });
              onClose();
            }}
            disabled={!nome.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Adicionar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function registrarInteresse(produtoId: number) {
  fetch(`/api/produtos/outlet/${produtoId}/interesse`, { method: "POST" }).catch(() => {});
}

function ProdutoCard({ produto, isDono, onDelete }: {
  produto: ProdutoOutlet;
  isDono: boolean;
  onDelete: (id: number) => void;
}) {
  const precoVenda = calcularPrecoVenda(produto.custoBRL, produto.precoPix);
  const custo = parseBRL(produto.custoBRL);

  const msg = encodeURIComponent(
    `Olá, Castor! 🛏️ Tenho interesse no produto por encomenda:\n\n*${produto.nome}*${produto.medidas ? `\nMedidas: ${produto.medidas}` : ""}${precoVenda ? `\nValor: ${formatBRL(precoVenda)}` : ""}\n\nPrazo: ${produto.prazoEncomenda ?? "A combinar"}\n\nPode confirmar disponibilidade e condições de pagamento?`
  );
  const waUrl = `https://wa.me/5522992410112?text=${msg}`;

  const handlePedir = () => {
    registrarInteresse(produto.id);
    trackOutletPedido(produto.nome);
    trackWhatsAppClick("outlet_pedir", "Cabo Frio");
    window.open(waUrl, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-slate-900 text-sm leading-tight">{produto.nome}</span>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Encomenda {produto.prazoEncomenda ?? "a combinar"}
              </span>
            </div>
            {produto.medidas && (
              <p className="text-xs text-slate-400">{produto.medidas}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {precoVenda ? (
                <p className="text-lg font-extrabold text-emerald-700">
                  {formatBRL(precoVenda)}
                  <span className="text-xs font-normal text-slate-400 ml-1">PIX</span>
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">Preço a combinar</p>
              )}
              {custo > 0 && isDono && (
                <p className="text-xs text-slate-400">
                  Custo: {formatBRL(custo)} · Margem: {formatBRL(precoVenda! - custo)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <button
              onClick={handlePedir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-600 text-white transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Pedir
            </button>
            {isDono && (
              <button
                onClick={() => onDelete(produto.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 text-red-500 transition-all border border-red-100"
              >
                <Trash2 className="w-3 h-3" />
                Remover
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Outlet() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isDono = user?.papel === "dono";
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { trackPageView("outlet"); }, []);

  const { data: produtos = [], isLoading, refetch } = useQuery<ProdutoOutlet[]>({
    queryKey: ["outlet-produtos"],
    queryFn: async () => {
      const res = await fetch("/api/produtos/outlet");
      if (!res.ok) throw new Error("Erro ao carregar outlet");
      return res.json();
    },
  });

  const addOutlet = useMutation({
    mutationFn: async (data: Partial<ProdutoOutlet>) => {
      const res = await fetch("/api/produtos/outlet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao adicionar produto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outlet-produtos"] });
      toast({ title: "Produto adicionado ao Outlet!" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const removeOutlet = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/produtos/${id}/encomenda`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encomenda: false }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outlet-produtos"] });
      toast({ title: "Produto removido do Outlet" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Outlet por Encomenda
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Catálogo completo da fábrica sem necessidade de estoque. Margem de 60%.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          {isDono && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Adicionar produto
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <ShoppingCart className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">Como funciona o Outlet?</p>
          <p className="text-xs text-blue-600 mt-0.5">
            O cliente escolhe o produto aqui, manda a encomenda pelo WhatsApp, você solicita direto à fábrica Castor e entrega no prazo combinado. Sem custo de estoque, 60% de margem garantida.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="font-medium">Carregando outlet...</span>
        </div>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
            <Package className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-600">Nenhum produto no Outlet ainda</p>
          {isDono && (
            <p className="text-sm text-slate-400">
              Clique em "Adicionar produto" para cadastrar os primeiros itens.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">{produtos.length} produto{produtos.length !== 1 ? "s" : ""} disponíveis</p>
          {produtos.map(p => (
            <ProdutoCard
              key={p.id}
              produto={p}
              isDono={isDono}
              onDelete={id => removeOutlet.mutate(id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <OutletModal
            onClose={() => setShowModal(false)}
            onSave={data => addOutlet.mutate(data)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
