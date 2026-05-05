import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Users, Clock, Ruler, Scale, Layers,
  BedDouble, Activity, Thermometer, LayoutGrid, History, Star,
} from "lucide-react";
import RulerPicker from "@/components/RulerPicker";
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
}

type StepBase = {
  key: keyof DiagnosticoData;
  pergunta: string;
  subtitulo: string;
  Icon: React.ComponentType<{ className?: string }>;
};

type StepOpcoes = StepBase & {
  tipo: "opcoes";
  opcoes: Opcao[];
};

type StepRuler = StepBase & {
  tipo: "ruler";
  ruler: { min: number; max: number; step: number; unit: string; defaultValue: number };
};

type Step = StepOpcoes | StepRuler;

// ─── STEPS ───────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    key: "objetivo", tipo: "opcoes", Icon: ShoppingCart,
    pergunta: "O que você está procurando?",
    subtitulo: "Selecione o que você busca",
    opcoes: [
      { label: "Colchão", value: "colchao" },
      { label: "Cama box completa", value: "cama_box" },
      { label: "Quero recomendação personalizada", value: "recomendacao" },
    ],
  },
  {
    key: "usuario_tipo", tipo: "opcoes", Icon: Users,
    pergunta: "Para quem é o colchão?",
    subtitulo: "Quem vai usar o colchão?",
    opcoes: [
      { label: "Para mim", value: "solo" },
      { label: "Para um casal", value: "casal" },
      { label: "Para hóspede", value: "hospede" },
    ],
  },
  {
    key: "frequencia", tipo: "opcoes", Icon: Clock,
    pergunta: "Qual a frequência de uso?",
    subtitulo: "Com que frequência será utilizado",
    opcoes: [
      { label: "Uso diário", value: "diario" },
      { label: "Às vezes", value: "semanal" },
      { label: "Uso esporádico", value: "esporadico" },
    ],
  },
  {
    key: "altura_cm", tipo: "ruler", Icon: Ruler,
    pergunta: "Qual a sua altura?",
    subtitulo: "Informe sua altura",
    ruler: { min: 1.50, max: 2.00, step: 0.01, unit: "m", defaultValue: 1.75 },
  },
  {
    key: "peso_kg", tipo: "ruler", Icon: Scale,
    pergunta: "Qual o seu peso?",
    subtitulo: "Informe seu peso",
    ruler: { min: 40, max: 150, step: 1, unit: "kg", defaultValue: 75 },
  },
  {
    key: "conforto", tipo: "opcoes", Icon: Layers,
    pergunta: "Qual o seu nível de conforto preferido?",
    subtitulo: "Sua preferência de firmeza",
    opcoes: [
      { label: "Macio", value: "macio" },
      { label: "Intermediário", value: "intermediario" },
      { label: "Firme", value: "firme" },
    ],
  },
  {
    key: "posicao", tipo: "opcoes", Icon: BedDouble,
    pergunta: "Qual posição você mais dorme?",
    subtitulo: "Posição principal ao dormir",
    opcoes: [
      { label: "De lado", value: "lado" },
      { label: "De costas", value: "costas" },
      { label: "De barriga", value: "barriga" },
      { label: "Varia durante a noite", value: "misto" },
    ],
  },
  {
    key: "dor", tipo: "opcoes", Icon: Activity,
    pergunta: "Você sente alguma dor com frequência?",
    subtitulo: "Algum desconforto recorrente?",
    opcoes: [
      { label: "Lombar", value: "lombar" },
      { label: "Coluna", value: "coluna" },
      { label: "Ombro", value: "ombro" },
      { label: "Nenhuma", value: "nenhuma" },
    ],
  },
  {
    key: "calor", tipo: "opcoes", Icon: Thermometer,
    pergunta: "Você sente calor ao dormir?",
    subtitulo: "Temperatura durante o sono",
    opcoes: [
      { label: "Sim, esquento muito", value: "sim" },
      { label: "Não, temperatura normal", value: "nao" },
    ],
  },
  {
    key: "tamanho", tipo: "opcoes", Icon: LayoutGrid,
    pergunta: "Qual o tamanho desejado?",
    subtitulo: "Qual tamanho é o ideal?",
    opcoes: [
      { label: "Solteiro", value: "solteiro" },
      { label: "Casal", value: "casal" },
      { label: "Queen", value: "queen" },
      { label: "King", value: "king" },
    ],
  },
  {
    key: "historico", tipo: "opcoes", Icon: History,
    pergunta: "Você está substituindo qual colchão atual?",
    subtitulo: "Seu colchão anterior",
    opcoes: [
      { label: "Colchão de mola", value: "mola" },
      { label: "Espuma ou viscoelástico", value: "espuma" },
      { label: "Cama de madeira / estrado", value: "madeira" },
      { label: "Primeiro colchão de qualidade", value: "nenhum" },
    ],
  },
  {
    key: "prioridade", tipo: "opcoes", Icon: Star,
    pergunta: "O que é mais importante para você?",
    subtitulo: "O que mais importa na escolha",
    opcoes: [
      { label: "Conforto máximo", value: "conforto" },
      { label: "Máxima durabilidade", value: "max_durabilidade" },
      { label: "Melhor custo-benefício", value: "custo_beneficio" },
    ],
  },
];

const TOTAL = STEPS.length;
const WA = "5522992410112";

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function MapaSono() {
  const [step, setStep] = useState<"welcome" | number | "loading" | "result">("welcome");
  const [data, setData] = useState<DiagnosticoData>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => { trackPageView("mapa_sono"); }, []);

  const idx = typeof step === "number" ? step : -1;
  const currentStep = idx >= 0 && idx < TOTAL ? STEPS[idx] : null;
  const progress = typeof step === "number" ? Math.round((step / TOTAL) * 100) : step === "result" ? 100 : 0;

  // Initialize ruler defaults when landing on a ruler step
  useEffect(() => {
    if (!currentStep || currentStep.tipo !== "ruler") return;
    if (data[currentStep.key] === undefined) {
      setData((prev) => ({ ...prev, [currentStep.key]: currentStep.ruler.defaultValue }));
    }
  }, [idx]);

  function comecar() {
    setStep(0);
    setData({});
    setResultado(null);
    // nome/whatsapp preserved — captured on welcome screen before this runs
  }

  function escolher(key: keyof DiagnosticoData, value: string) {
    const next = idx + 1;
    const newData = { ...data, [key]: value };
    setData(newData);
    if (next < TOTAL) setStep(next);
    else enviar(newData);
  }

  function avancarRuler() {
    const next = idx + 1;
    if (next < TOTAL) setStep(next);
    else enviar(data);
  }

  async function enviar(finalData: DiagnosticoData) {
    setStep("loading");
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...finalData, nome, whatsapp }),
      });
      if (!res.ok) throw new Error();
      const r: Resultado = await res.json();
      setResultado(r);
      setStep("result");
      trackMapaSonoCompleto(r.tecnologia, r.firmeza, Math.round(r.confianca * 100));
    } catch {
      setResultado({
        perfil: "Perfil personalizado",
        suporte: "medio",
        firmeza: "intermediario",
        tecnologia: "pocket",
        produto: "Colchão Castor Silver Star Pocket",
        justificativa: "Compatível com seu peso, postura e necessidade de alívio de pressão.",
        gatilho: "conforto + durabilidade",
        confianca: 0.87,
      });
      setStep("result");
    }
  }

  function voltar() {
    if (step === "result") { setStep(TOTAL - 1); return; }
    if (typeof step === "number") {
      setStep(step === 0 ? "welcome" : step - 1);
    }
  }

  // ── WELCOME ────────────────────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-6 shadow-[0_0_40px_rgba(255,0,0,0.12)]"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/70">
            SleepMapAI · Castor
          </span>
          <h1 className="text-2xl font-black text-white leading-tight mt-1 mb-2">
            O colchão ideal<br />para o seu corpo
          </h1>
          <p className="text-sm text-white/55 mb-6 leading-relaxed">
            Diagnóstico personalizado em {TOTAL} perguntas rápidas. Receba a recomendação exata para o seu perfil.
          </p>

          <div className="space-y-2.5 mb-6">
            {[
              { icon: "🎯", text: `${TOTAL} cliques — sem formulários longos` },
              { icon: "🧠", text: "Motor de decisão baseado no seu biotipo" },
              { icon: "📲", text: "Resultado completo + WhatsApp direto" },
            ].map((i) => (
              <div key={i.icon} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-lg shrink-0">{i.icon}</span>
                <p className="text-xs font-semibold text-white/75">{i.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-5">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome (opcional)"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-600"
            />
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Seu WhatsApp (opcional)"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-600"
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

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-[420px] bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-10 text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-red-800 border-t-red-400 rounded-full mx-auto mb-6"
          />
          <p className="text-white font-bold text-lg mb-1">Estamos finalizando</p>
          <p className="text-white/50 text-sm">sua análise personalizada…</p>
        </motion.div>
      </div>
    );
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (step === "result" && resultado) {
    const tecLabel: Record<string, string> = {
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
    const msgWA = encodeURIComponent(
      `Olá! Fiz o diagnóstico no Mapa do Sono e recebi a recomendação: *${resultado.produto}*.\n\nQuero saber mais detalhes e condições! 🛏️`
    );

    return (
      <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] space-y-3"
        >
          <div className="bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/60">
                Diagnóstico concluído
              </span>
              <span className="text-[10px] font-bold text-red-400">100% ✓</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full mb-5">
              <div className="h-full bg-red-600 rounded-full w-full" />
            </div>

            <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1">
              Seu colchão ideal foi encontrado
            </p>
            <p className="text-xl font-black text-white mb-0.5">{resultado.produto}</p>
            <p className="text-sm text-white/55 mb-4">
              {tecLabel[resultado.tecnologia] ?? resultado.tecnologia} ·{" "}
              Firmeza {firmezaLabel[resultado.firmeza] ?? resultado.firmeza}
            </p>

            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white/45">
                Compatibilidade com seu perfil
              </span>
              <span className="text-2xl font-black text-white">{pct}%</span>
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
              <p className="text-xs text-white/55 leading-relaxed">
                <strong className="text-white/85">Por quê?</strong> {resultado.justificativa}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "🚚", label: "Entrega rápida" },
              { icon: "📦", label: "Pronta entrega" },
              { icon: "💳", label: "12x sem juros" },
            ].map((g) => (
              <div
                key={g.label}
                className="bg-white/5 border border-white/10 rounded-xl px-2 py-3 text-center"
              >
                <p className="text-xl mb-1">{g.icon}</p>
                <p className="text-[10px] font-bold text-white/60 leading-tight">{g.label}</p>
              </div>
            ))}
          </div>

          <a
            href={`https://wa.me/${WA}?text=${msgWA}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackWhatsAppClick("mapa_sono_resultado", "Cabo Frio")}
            className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-400 text-white font-extrabold px-5 py-4 rounded-xl text-base transition-colors"
          >
            💬 Falar no WhatsApp agora
          </a>
          <p className="text-center text-[10px] text-white/25">
            Você chega com seu perfil completo — atendimento instantâneo!
          </p>

          <button
            onClick={comecar}
            className="w-full border border-white/12 text-white/40 font-semibold rounded-xl py-3 text-sm hover:border-white/25 hover:text-white/60 transition-all"
          >
            Refazer o diagnóstico
          </button>
        </motion.div>
      </div>
    );
  }

  // ── STEP ───────────────────────────────────────────────────────────────────
  if (!currentStep) return null;
  const { Icon } = currentStep;

  return (
    <div className="min-h-full bg-[#0b0b0b] flex items-center justify-center p-5">
      <div className="w-full max-w-[420px]">

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] font-bold mb-1.5">
            <span className="text-white/35">Etapa {idx + 1} de {TOTAL}</span>
            <span className="text-red-500">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-600 rounded-full"
              initial={{ width: `${Math.round((idx / TOTAL) * 100)}%` }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="bg-gradient-to-b from-[#1a0000] to-[#0d0d0d] border border-red-700/60 rounded-2xl p-5 shadow-[0_0_40px_rgba(255,0,0,0.10)]"
          >
            {/* Icon + title + subtitle */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mb-3 shadow-[0_4px_16px_rgba(220,38,38,0.4)]">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg font-black text-white leading-tight mb-1">
                {currentStep.pergunta}
              </h2>
              <p className="text-xs text-white/40">{currentStep.subtitulo}</p>
            </div>

            {/* Options */}
            {currentStep.tipo === "opcoes" && (
              <div className="space-y-2">
                {currentStep.opcoes.map((op) => (
                  <button
                    key={op.value}
                    onClick={() => escolher(currentStep.key, op.value)}
                    className="w-full text-left border border-white/12 hover:border-red-600 bg-white/4 hover:bg-red-600/10 text-white rounded-xl px-4 py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            )}

            {/* Ruler */}
            {currentStep.tipo === "ruler" && (
              <div>
                <RulerPicker
                  min={currentStep.ruler.min}
                  max={currentStep.ruler.max}
                  step={currentStep.ruler.step}
                  unit={currentStep.ruler.unit}
                  value={(data[currentStep.key] as number | undefined) ?? currentStep.ruler.defaultValue}
                  onChange={(v) => setData((prev) => ({ ...prev, [currentStep.key]: v }))}
                />
                <button
                  onClick={avancarRuler}
                  className="w-full mt-5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl py-4 text-base transition-colors"
                >
                  Continuar →
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <button
          onClick={voltar}
          className="mt-3 w-full text-center text-xs text-white/25 hover:text-white/45 py-2 transition-colors"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
}
