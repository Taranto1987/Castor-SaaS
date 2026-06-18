import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Brain, ShoppingBag, CheckCircle, XCircle, Loader2, CalendarClock, Star } from "lucide-react";
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
  satisfacao_90d: number | null;
  satisfacao_180d: number | null;
  satisfacao_365d: number | null;
  dor_melhorou: boolean | null;
  trocou: boolean | null;
  nps: number | null;
  sleep_success_score: string | null;
}

const CHECKPOINTS = [
  { key: "satisfacao_30d",  label: "30 dias"  },
  { key: "satisfacao_90d",  label: "90 dias"  },
  { key: "satisfacao_180d", label: "180 dias" },
  { key: "satisfacao_365d", label: "365 dias" },
] as const;
type CheckpointKey = typeof CHECKPOINTS[number]["key"];

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
  const [outcomeId, setOutcomeId] = useState<number | null>(null);
  const [vendeu, setVendeu] = useState<boolean | null>(null);
  const [produtoVendido, setProdutoVendido] = useState("");
  const [ticket, setTicket] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Acompanhamento pós-venda (checkpoints 30/90/180/365d)
  const [outcome, setOutcome] = useState<OutcomeRow | null>(null);
  const [cpPeriodo, setCpPeriodo] = useState<CheckpointKey>("satisfacao_30d");
  const [cpSatisfacao, setCpSatisfacao] = useState<number | null>(null);
  const [cpDorMelhorou, setCpDorMelhorou] = useState<boolean | null>(null);
  const [cpTrocou, setCpTrocou] = useState<boolean | null>(null);
  const [cpNps, setCpNps] = useState<string>("");
  const [cpSaving, setCpSaving] = useState(false);
  const [cpMsg, setCpMsg] = useState("");

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
      setCpMsg("");
      // Pre-fill form from existing outcome
      if (data.latest_outcome) {
        setOutcomeId(data.latest_outcome.id);
        setOutcome(data.latest_outcome);
        setVendeu(data.latest_outcome.vendeu);
        setProdutoVendido(data.latest_outcome.produto_vendido ?? "");
        setTicket(data.latest_outcome.ticket ?? "");
      } else {
        setOutcomeId(null);
        setOutcome(null);
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
      const created: OutcomeRow = await res.json();
      setOutcomeId(created.id);
      setOutcome(created);
      setSaved(true);
    } catch {
      setSaveError("Erro de rede. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // Acompanhamento pós-venda — atualiza um checkpoint via PATCH /api/outcomes/:id.
  // O backend recalcula o Sleep Success Score quando há satisfação ≥ 90d.
  async function salvarCheckpoint() {
    if (!outcomeId) return;
    setCpSaving(true);
    setCpMsg("");
    try {
      const body: Record<string, unknown> = { [cpPeriodo]: cpSatisfacao };
      if (cpDorMelhorou !== null) body.dor_melhorou = cpDorMelhorou;
      if (cpTrocou !== null) body.trocou = cpTrocou;
      if (cpNps.trim() !== "") body.nps = Number(cpNps);

      const res = await fetch(`/api/outcomes/${outcomeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCpMsg((err as { error?: string }).error ?? "Erro ao salvar acompanhamento");
        return;
      }
      const updated: OutcomeRow = await res.json();
      setOutcome(updated);
      setCpMsg(
        updated.sleep_success_score
          ? `Salvo. Sleep Success Score: ${Number(updated.sleep_success_score).toFixed(0)}/100`
          : "Salvo. (Score calculado a partir de 90 dias.)",
      );
    } catch {
      setCpMsg("Erro de rede. Tente novamente.");
    } finally {
      setCpSaving(false);
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

            {/* Acompanhamento pós-venda — checkpoints 30/90/180/365 dias.
                Só faz sentido quando houve venda e o outcome já existe (tem id). */}
            {diag && outcomeId && vendeu === true && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-slate-500" />
                    <h2 className="font-bold text-slate-800 text-sm">Acompanhamento pós-venda</h2>
                  </div>
                  {outcome?.sleep_success_score && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-3 py-1">
                      Sleep Score {Number(outcome.sleep_success_score).toFixed(0)}/100
                    </span>
                  )}
                </div>

                {/* Seletor de período */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Período</p>
                  <div className="flex flex-wrap gap-2">
                    {CHECKPOINTS.map((cp) => {
                      const preenchido = outcome?.[cp.key] != null;
                      return (
                        <button
                          key={cp.key}
                          onClick={() => { setCpPeriodo(cp.key); setCpSatisfacao(outcome?.[cp.key] ?? null); setCpMsg(""); }}
                          className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                            cpPeriodo === cp.key
                              ? "bg-slate-900 border-slate-900 text-white"
                              : preenchido
                                ? "bg-green-50 border-green-300 text-green-700"
                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {cp.label}{preenchido ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Satisfação 1-5 */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Satisfação (1 a 5)</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setCpSatisfacao(n)}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                          cpSatisfacao !== null && n <= cpSatisfacao
                            ? "bg-amber-50 border-amber-400 text-amber-500"
                            : "bg-white border-slate-200 text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        <Star className="w-5 h-5" fill={cpSatisfacao !== null && n <= cpSatisfacao ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dor melhorou + Trocou */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">A dor melhorou?</p>
                    <div className="flex gap-2">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          onClick={() => setCpDorMelhorou(v)}
                          className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                            cpDorMelhorou === v
                              ? v ? "bg-green-50 border-green-400 text-green-700" : "bg-slate-100 border-slate-300 text-slate-600"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >{v ? "Sim" : "Não"}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Trocou/devolveu?</p>
                    <div className="flex gap-2">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          onClick={() => setCpTrocou(v)}
                          className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                            cpTrocou === v
                              ? v ? "bg-red-50 border-red-400 text-red-700" : "bg-green-50 border-green-400 text-green-700"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >{v ? "Sim" : "Não"}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* NPS */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">NPS (0 a 10)</label>
                  <input
                    type="number" min={0} max={10}
                    value={cpNps}
                    onChange={(e) => setCpNps(e.target.value)}
                    placeholder="ex: 9"
                    className="mt-1.5 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {cpMsg && <p className="text-sm text-slate-600">{cpMsg}</p>}

                <button
                  onClick={salvarCheckpoint}
                  disabled={cpSaving || cpSatisfacao === null}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar acompanhamento
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
