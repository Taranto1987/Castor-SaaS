import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Brain, ShoppingBag, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface DiagnosticoRow {
  id: number;
  produto_recomendado: string | null;
  confianca: string | null;
  flag_calibracao: string | null;
  criadoEm: string | null;
}

interface OutcomeRow {
  id: number;
  vendeu: boolean | null;
  produto_vendido: string | null;
  ticket: string | null;
  satisfacao_30d: number | null;
}

interface TwinData {
  identity: { id: number; name: string | null; phone: string | null };
  diagnosticos: DiagnosticoRow[];
  latest_outcome: OutcomeRow | null;
}

export default function Outcomes() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? "";

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [twin, setTwin] = useState<TwinData | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Outcome form state
  const [vendeu, setVendeu] = useState<boolean | null>(null);
  const [produtoVendido, setProdutoVendido] = useState("");
  const [ticket, setTicket] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function buscar() {
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) return;
    setLoading(true);
    setTwin(null);
    setNotFound(false);
    setSaved(false);
    setSaveError("");
    try {
      const res = await fetch(`/api/twin/by-phone/${normalized}`, {
        headers: { "x-session-token": token },
      });
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Erro ao buscar cliente");
      const data: TwinData = await res.json();
      setTwin(data);
      // Pre-fill form from existing outcome
      if (data.latest_outcome) {
        setVendeu(data.latest_outcome.vendeu);
        setProdutoVendido(data.latest_outcome.produto_vendido ?? "");
        setTicket(data.latest_outcome.ticket ?? "");
      } else {
        setVendeu(null);
        setProdutoVendido("");
        setTicket("");
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function salvar() {
    if (!twin?.diagnosticos[0]) return;
    const diagnosticoId = twin.diagnosticos[0].id;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({
          diagnosticoId,
          vendeu,
          produto_vendido: produtoVendido || null,
          ticket: ticket || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError((err as { error?: string }).error ?? "Erro ao salvar");
        return;
      }
      setSaved(true);
    } catch {
      setSaveError("Erro de rede. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const diag = twin?.diagnosticos[0] ?? null;
  const confPct = diag?.confianca ? Math.round(Number(diag.confianca) * 100) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Diagnósticos & Outcomes</h1>
        <p className="text-sm text-slate-500 mt-1">Registre o resultado de cada atendimento originado no Mapa do Sono.</p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="WhatsApp do cliente (ex: 22999990000)"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={buscar}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
      </div>

      <AnimatePresence>
        {notFound && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-sm text-red-500"
          >
            Cliente não encontrado. Verifique o número e tente novamente.
          </motion.p>
        )}

        {twin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Customer card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{twin.identity.name ?? "Nome não cadastrado"}</p>
                  <p className="text-xs text-slate-400">{twin.identity.phone ?? phone}</p>
                </div>
              </div>

              {diag ? (
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Brain className="w-4 h-4 text-red-500 shrink-0" />
                    <span>
                      <span className="font-semibold">{diag.produto_recomendado ?? "—"}</span>
                      {confPct !== null && (
                        <span className="ml-2 text-xs text-slate-400">confiança {confPct}%</span>
                      )}
                    </span>
                  </div>
                  {diag.flag_calibracao && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
                      Alerta: {diag.flag_calibracao.replace(/_/g, " ")}
                    </p>
                  )}
                  {diag.criadoEm && (
                    <p className="text-xs text-slate-400">
                      Diagnóstico em {new Date(diag.criadoEm).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 border-t border-slate-100 pt-4">
                  Nenhum diagnóstico registrado para este cliente.
                </p>
              )}
            </div>

            {/* Outcome form — only when there's a diagnosis */}
            {diag && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-slate-500" />
                  <h2 className="font-bold text-slate-800 text-sm">Registrar Outcome</h2>
                </div>

                {/* Vendeu toggle */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Venda realizada?</p>
                  <div className="flex gap-2">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        onClick={() => setVendeu(v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          vendeu === v
                            ? v ? "bg-green-50 border-green-400 text-green-700" : "bg-red-50 border-red-400 text-red-700"
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {v ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {v ? "Sim" : "Não"}
                      </button>
                    ))}
                  </div>
                </div>

                {vendeu && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Produto Vendido</label>
                      <input
                        value={produtoVendido}
                        onChange={(e) => setProdutoVendido(e.target.value)}
                        placeholder="Ex: Castor Pocket Royal Casal"
                        className="mt-1.5 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor (R$)</label>
                      <input
                        type="number"
                        value={ticket}
                        onChange={(e) => setTicket(e.target.value)}
                        placeholder="0,00"
                        className="mt-1.5 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </>
                )}

                {saveError && <p className="text-sm text-red-500">{saveError}</p>}

                {saved ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                    <CheckCircle className="w-4 h-4" /> Outcome registrado com sucesso.
                  </div>
                ) : (
                  <button
                    onClick={salvar}
                    disabled={saving || vendeu === null}
                    className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Salvar Outcome
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
