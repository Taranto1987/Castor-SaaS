import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackMapaSonoCompleto, trackWhatsAppClick, trackPageView } from "@/lib/tracking";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface DiagnosticoData {
  objetivo?: string;
  usuario_tipo?: string;
  frequencia?: string;
  altura_cm?: number;
  peso_kg?: number;
  conforto?: string;
  posicao?: string;
  dor?: string;
  calor?: string;
  tamanho?: string;
  historico?: string;
  prioridade?: string;
  nome?: string;
  whatsapp?: string;
}

interface Resultado {
  perfil: string;
  suporte: string;
  firmeza: string;
  tecnologia: string;
  produto: string;
  justificativa: string;
  gatilho: string;
  confianca: number;
}

interface Opcao {
  label: string;
  value: string;
  desc?: string;
}

// ─── STEPS ───────────────────────────────────────────────────────────────────

const STEPS = [
  {
    key: "objetivo" as keyof DiagnosticoData,
    pergunta: "O que você está procurando?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Colchão", value: "colchao" },
      { label: "Cama box completa", value: "cama_box" },
      { label: "Quero recomendação personalizada", value: "recomendacao" },
    ] as Opcao[],
  },
  {
    key: "usuario_tipo" as keyof DiagnosticoData,
    pergunta: "Para quem é o colchão?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Para mim", value: "solo" },
      { label: "Para um casal", value: "casal" },
      { label: "Para hóspede", value: "hospede" },
    ] as Opcao[],
  },
  {
    key: "frequencia" as keyof DiagnosticoData,
    pergunta: "Qual a frequência de uso?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Uso diário", value: "diario" },
      { label: "Às vezes", value: "semanal" },
      { label: "Uso esporádico", value: "esporadico" },
    ] as Opcao[],
  },
  {
    key: "altura_cm" as keyof DiagnosticoData,
    pergunta: "Qual a sua altura?",
    tipo: "input" as const,
    placeholder: "Ex: 178",
    unidade: "cm",
    numerico: true,
  },
  {
    key: "peso_kg" as keyof DiagnosticoData,
    pergunta: "Qual o seu peso?",
    tipo: "input" as const,
    placeholder: "Ex: 92",
    unidade: "kg",
    numerico: true,
  },
  {
    key: "conforto" as keyof DiagnosticoData,
    pergunta: "Qual o seu nível de conforto preferido?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Macio", value: "macio" },
      { label: "Intermediário", value: "intermediario" },
      { label: "Firme", value: "firme" },
    ] as Opcao[],
  },
  {
    key: "posicao" as keyof DiagnosticoData,
    pergunta: "Qual posição você mais dorme?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "De lado", value: "lado" },
      { label: "De costas", value: "costas" },
      { label: "De barriga", value: "barriga" },
      { label: "Varia durante a noite", value: "misto" },
    ] as Opcao[],
  },
  {
    key: "dor" as keyof DiagnosticoData,
    pergunta: "Você sente alguma dor com frequência?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Lombar", value: "lombar" },
      { label: "Coluna", value: "coluna" },
      { label: "Ombro", value: "ombro" },
      { label: "Nenhuma", value: "nenhuma" },
    ] as Opcao[],
  },
  {
    key: "calor" as keyof DiagnosticoData,
    pergunta: "Você sente calor ao dormir?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Sim, esquento muito", value: "sim" },
      { label: "Não, temperatura normal", value: "nao" },
    ] as Opcao[],
  },
  {
    key: "tamanho" as keyof DiagnosticoData,
    pergunta: "Qual o tamanho desejado?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Solteiro", value: "solteiro" },
      { label: "Casal", value: "casal" },
      { label: "Queen", value: "queen" },
      { label: "King", value: "king" },
    ] as Opcao[],
  },
  {
    key: "historico" as keyof DiagnosticoData,
    pergunta: "Você está substituindo qual colchão atual?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Colchão de mola", value: "mola" },
      { label: "Espuma ou viscoelástico", value: "espuma" },
      { label: "Cama de madeira / estrado", value: "madeira" },
      { label: "Primeiro colchão de qualidade", value: "nenhum" },
    ] as Opcao[],
  },
  {
    key: "prioridade" as keyof DiagnosticoData,
    pergunta: "O que é mais importante para você?",
    tipo: "opcoes" as const,
    opcoes: [
      { label: "Conforto máximo", value: "conforto" },
      { label: "Máxima durabilidade", value: "max_durabilidade" },
      { label: "Melhor custo-benefício", value: "custo_beneficio" },
    ] as Opcao[],
  },
];

const TOTAL_STEPS = STEPS.length;

const WA_NUMERO = "5522992410112";

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function MapaSono() {
  const [step, setStep] = useState<"welcome" | number | "loading" | "result">("welcome");
  const [data, setData] = useState<DiagnosticoData>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { trackPageView("mapa_sono"); }, []);

  const stepIndex = typeof step === "number" ? step : -1;
  const currentStep = stepIndex >= 0 && stepIndex < TOTAL_STEPS ? STEPS[stepIndex] : null;
  const progress = typeof step === "number"
    ? Math.round((step / TOTAL_STEPS) * 100)
    : step === "result"
    ? 100
    : 0;

  function comecar() {
    setStep(0);
    setData({});
    setResultado(null);
    setInputVal("");
    setError("");
    // nome/whatsapp intentionally preserved — captured on welcome screen before this runs
  }

  function escolher(key: keyof DiagnosticoData, value: string) {
    const newData = { ...data, [key]: value };
    setData(newData);
    const next = stepIndex + 1;
    if (next < TOTAL_STEPS) {
      setStep(next);
      setInputVal("");
      setError("");
    } else {
      enviarDiagnostico(newData);
    }
  }

  function avancarInput() {
    if (!currentStep) return;
    if (!inputVal.trim()) { setError("Por favor, informe um valor."); return; }
    const val = currentStep.numerico ? Number(inputVal.replace(",", ".")) : inputVal;
    if (currentStep.numerico && isNaN(val as number)) { setError("Por favor, informe um número válido."); return; }
    const newData = { ...data, [currentStep.key]: val };
    setData(newData);
    const next = stepIndex + 1;
    if (next < TOTAL_STEPS) {
      setStep(next);
      setInputVal("");
      setError("");
    } else {
      enviarDiagnostico(newData);
    }
  }

  async function enviarDiagnostico(finalData: DiagnosticoData) {
    setStep("loading");
    try {
      const payload = { ...finalData, nome, whatsapp };
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("API error");
      const r: Resultado = await res.json();
      setResultado(r);
      setStep("result");
      trackMapaSonoCompleto(r.tecnologia, r.firmeza, Math.round(r.confianca * 100));
    } catch {
      // fallback: show result screen with whatever we have
      setResultado({
        perfil: "Perfil personalizado",
        suporte: "medio",
        firmeza: "intermediario",
        tecnologia: "pocket",
        produto: "Colchão Castor Silver Star Pocket",
        justificativa: "Compatível com seu peso, postura e necessidade de alívio de pressão.",
        gatilho: "conforto + durabilidade + alívio de pressão",
        confianca: 0.87,
      });
      setStep("result");
    }
  }

  function voltar() {
    if (step === "welcome" || step === "loading") return;
    if (step === "result") { setStep(TOTAL_STEPS - 1); return; }
    if (typeof step === "number") {
      if (step === 0) setStep("welcome");
      else setStep(step - 1);
    }
  }

  const msgWA = resultado
    ? encodeURIComponent(
        `Olá! Fiz o diagnóstico no Mapa do Sono e recebi a recomendação: *${resultado.produto}*.\n\nQuero saber mais detalhes e condições! 🛏️`
      )
    : "";

  // ── WELCOME ─────────────────────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-6 shadow-[0_0_40px_rgba(255,0,0,0.12)]"
        >
          <div className="mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/70">SleepMapAI · Castor</span>
          </div>
          <h1 className="text-2xl font-black text-white leading-tight mb-2">
            O colchão ideal<br />para o seu corpo
          </h1>
          <p className="text-sm text-white/60 mb-6 leading-relaxed">
            Diagnóstico personalizado em {TOTAL_STEPS} perguntas rápidas. Receba a recomendação exata para o seu perfil e fale direto com nosso especialista.
          </p>
          <div className="space-y-2.5 mb-6">
            {[
              { icon: "🎯", text: `${TOTAL_STEPS} cliques — sem formulários longos` },
              { icon: "🧠", text: "Motor de decisão baseado no seu biotipo" },
              { icon: "📲", text: "Conversa no WhatsApp com resultado completo" },
            ].map((i) => (
              <div key={i.icon} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-lg shrink-0">{i.icon}</span>
                <p className="text-xs font-semibold text-white/80">{i.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome (opcional)"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-600"
            />
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Seu WhatsApp (opcional)"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-600"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={comecar}
            animate={{
              boxShadow: [
                "0 4px 20px rgba(220,38,38,0.3)",
                "0 4px 32px rgba(220,38,38,0.55)",
                "0 4px 20px rgba(220,38,38,0.3)",
              ],
            }}
            transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl py-4 text-base transition-colors"
          >
            Começar diagnóstico →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-[420px] bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-8 text-center shadow-[0_0_40px_rgba(255,0,0,0.12)]"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-red-700 border-t-red-400 rounded-full mx-auto mb-6"
          />
          <p className="text-white font-bold text-lg mb-1">Estamos finalizando</p>
          <p className="text-white/60 text-sm">sua análise personalizada…</p>
        </motion.div>
      </div>
    );
  }

  // ── RESULT ───────────────────────────────────────────────────────────────────
  if (step === "result" && resultado) {
    const tecnologiaLabel: Record<string, string> = {
      pocket: "Mola Ensacada (Pocket)",
      hibrido: "Híbrido Pocket + Espuma",
      espuma: "Espuma de Alta Densidade",
      gel: "Espuma Gel Refrescante",
    };
    const firmezaLabel: Record<string, string> = {
      firme: "Firme",
      intermediario: "Intermediário",
      intermediario_firme: "Intermediário Firme",
      intermediario_macio: "Intermediário Macio",
      macio: "Macio",
    };
    const pct = Math.round(resultado.confianca * 100);

    return (
      <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] space-y-3"
        >
          {/* Header */}
          <div className="bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-5 shadow-[0_0_40px_rgba(255,0,0,0.12)]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/70">Diagnóstico concluído</span>
              <span className="text-[10px] font-bold text-red-400">100% ✓</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full mb-4">
              <div className="h-full bg-red-600 rounded-full w-full" />
            </div>

            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Seu colchão ideal foi encontrado</p>
            <p className="text-xl font-black text-white mb-1">{resultado.produto}</p>
            <p className="text-sm text-white/60 mb-4">
              {tecnologiaLabel[resultado.tecnologia] ?? resultado.tecnologia} · Firmeza {firmezaLabel[resultado.firmeza] ?? resultado.firmeza}
            </p>

            {/* Confidence bar */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white/50">Compatibilidade com seu perfil</span>
              <span className="text-lg font-black text-white">{pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full mb-4">
              <motion.div
                className="h-full bg-red-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
              />
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-white/60 leading-relaxed">
                <strong className="text-white/90">Por quê?</strong> {resultado.justificativa}
              </p>
            </div>
          </div>

          {/* Gatilhos */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "🚚", label: "Entrega rápida" },
              { icon: "📦", label: "Pronta entrega" },
              { icon: "💳", label: "12x sem juros" },
            ].map((g) => (
              <div key={g.label} className="bg-white/5 border border-white/10 rounded-xl px-2 py-3 text-center">
                <p className="text-xl mb-1">{g.icon}</p>
                <p className="text-[10px] font-bold text-white/70 leading-tight">{g.label}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <a
            href={`https://wa.me/${WA_NUMERO}?text=${msgWA}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackWhatsAppClick("mapa_sono_resultado", "Cabo Frio")}
            className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-400 text-white font-extrabold px-5 py-4 rounded-xl text-base transition-colors"
          >
            💬 Falar no WhatsApp agora
          </a>
          <p className="text-center text-[10px] text-white/30">Você chega com seu perfil completo — atendimento instantâneo!</p>

          <button
            onClick={comecar}
            className="w-full border border-white/15 text-white/50 font-semibold rounded-xl py-3 text-sm hover:border-white/30 hover:text-white/70 transition-all"
          >
            Refazer o diagnóstico
          </button>
        </motion.div>
      </div>
    );
  }

  // ── STEP ─────────────────────────────────────────────────────────────────────
  if (!currentStep) return null;

  return (
    <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
      <div className="w-full max-w-[420px]">
        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] font-bold mb-1.5">
            <span className="text-white/40">Etapa {stepIndex + 1} de {TOTAL_STEPS}</span>
            <span className="text-red-500">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-600 rounded-full"
              initial={{ width: `${Math.round((stepIndex / TOTAL_STEPS) * 100)}%` }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-5 shadow-[0_0_40px_rgba(255,0,0,0.12)]"
          >
            <h2 className="text-lg font-black text-white mb-4 leading-tight">
              {currentStep.pergunta}
            </h2>

            {currentStep.tipo === "opcoes" && (
              <div className="space-y-2">
                {currentStep.opcoes.map((op) => (
                  <button
                    key={op.value}
                    onClick={() => escolher(currentStep.key, op.value)}
                    className="w-full text-left border border-white/15 hover:border-red-600 bg-white/5 hover:bg-red-600/10 text-white rounded-xl px-4 py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    {op.label}
                    {op.desc && <span className="block text-[11px] text-white/40 mt-0.5 font-normal">{op.desc}</span>}
                  </button>
                ))}
              </div>
            )}

            {currentStep.tipo === "input" && (
              <div>
                <div className="relative mb-2">
                  <input
                    autoFocus
                    value={inputVal}
                    onChange={(e) => { setInputVal(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && avancarInput()}
                    placeholder={currentStep.placeholder}
                    inputMode={currentStep.numerico ? "numeric" : "text"}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white text-2xl font-black placeholder-white/20 focus:outline-none focus:border-red-600 pr-16"
                  />
                  {currentStep.unidade && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/40">
                      {currentStep.unidade}
                    </span>
                  )}
                </div>
                {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                <button
                  onClick={avancarInput}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl py-4 text-base transition-colors"
                >
                  Continuar →
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <button
          onClick={voltar}
          className="mt-3 w-full text-center text-xs text-white/30 hover:text-white/50 py-2 transition-colors"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
}
