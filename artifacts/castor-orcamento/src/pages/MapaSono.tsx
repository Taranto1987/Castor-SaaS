import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Users, Calendar, Ruler, Scale,
  Cloud, BedDouble, Activity, Thermometer, Maximize2,
  RefreshCw, Star, ChevronLeft, ChevronRight,
  MessageCircle, User, Home, Check, Zap, Heart,
  Shield, Clock, Package, Layers, Phone,
} from "lucide-react";
import { trackWhatsAppClick } from "@/lib/tracking";

export interface MapaSonoProps { embedded?: boolean; }

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG     = "#0c0c0c";
const CARD   = "#140000";
const BORDER = "#2a0808";
const RED    = "#C41230";

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = "welcome" | "quiz" | "mid_loading" | "capture" | "analyzing" | "result";

interface Answers {
  finalidade?: string;
  casal?: string;
  frequencia?: string;
  altura?: number;
  peso?: number;
  firmeza?: string;
  posicao?: string;
  dores?: string[];
  temperatura?: string;
  tamanho?: string;
  substituicao?: string;
  prioridade?: string;
}

interface Opt { value: string; label: string; Icon: React.ElementType; }

interface QStep {
  id: keyof Answers;
  question: string;
  subtitle?: string;
  StepIcon: React.ElementType;
  type: "single" | "multi" | "height" | "weight";
  options?: Opt[];
  grid2?: boolean;
  min?: number; max?: number; defaultVal?: number;
}

// ── Steps ──────────────────────────────────────────────────────────────────────
const STEPS: QStep[] = [
  {
    id: "finalidade", StepIcon: ShoppingCart, type: "single",
    question: "O que você está procurando?",
    subtitle: "Isso nos ajuda a direcionar a recomendação certa para você.",
    options: [
      { value: "colchao",      label: "Colchão",              Icon: BedDouble       },
      { value: "box",          label: "Cama box completa",    Icon: Package         },
      { value: "recomendacao", label: "Quero recomendação",   Icon: MessageCircle   },
    ],
  },
  {
    id: "casal", StepIcon: Users, type: "single",
    question: "Para quem é o colchão?",
    options: [
      { value: "sozinho", label: "Só para mim",      Icon: User  },
      { value: "casal",   label: "Para um casal",    Icon: Users },
      { value: "hospede", label: "Para hóspede",     Icon: Home  },
    ],
  },
  {
    id: "frequencia", StepIcon: Calendar, type: "single",
    question: "Qual a frequência de uso?",
    options: [
      { value: "diario",    label: "Uso diário",               Icon: Zap      },
      { value: "semanal",   label: "Algumas vezes na semana",  Icon: Calendar },
      { value: "esporadico",label: "Uso esporádico",           Icon: Clock    },
    ],
  },
  {
    id: "altura", StepIcon: Ruler, type: "height",
    question: "Qual a sua altura?",
    subtitle: "Informe sua altura",
    min: 140, max: 210, defaultVal: 170,
  },
  {
    id: "peso", StepIcon: Scale, type: "weight",
    question: "Qual o seu peso?",
    subtitle: "Informe seu peso",
    min: 40, max: 150, defaultVal: 75,
  },
  {
    id: "firmeza", StepIcon: Cloud, type: "single",
    question: "Qual o seu nível de conforto preferido?",
    options: [
      { value: "macio",         label: "Mais macio",      Icon: Cloud  },
      { value: "intermediario", label: "Intermediário",   Icon: Layers },
      { value: "firme",         label: "Mais firme",      Icon: Shield },
    ],
  },
  {
    id: "posicao", StepIcon: BedDouble, type: "single",
    question: "Qual posição você mais dorme?",
    options: [
      { value: "lado",    label: "De lado",            Icon: Activity  },
      { value: "costas",  label: "De costas",          Icon: User      },
      { value: "barriga", label: "De barriga",         Icon: Heart     },
      { value: "variado", label: "Varia de posição",   Icon: RefreshCw },
    ],
  },
  {
    id: "dores", StepIcon: Activity, type: "multi",
    question: "Você sente alguma dor com frequência?",
    options: [
      { value: "lombar",  label: "Lombar",    Icon: Zap      },
      { value: "coluna",  label: "Coluna",    Icon: Activity },
      { value: "ombro",   label: "Ombro",     Icon: User     },
      { value: "nenhuma", label: "Nenhuma",   Icon: Check    },
    ],
  },
  {
    id: "temperatura", StepIcon: Thermometer, type: "single",
    question: "Você sente calor ao dormir?",
    options: [
      { value: "sim", label: "Sim", Icon: Thermometer },
      { value: "nao", label: "Não", Icon: Cloud        },
    ],
  },
  {
    id: "tamanho", StepIcon: Maximize2, type: "single", grid2: true,
    question: "Qual o tamanho desejado?",
    options: [
      { value: "solteiro", label: "Solteiro", Icon: User     },
      { value: "casal",    label: "Casal",    Icon: Users    },
      { value: "queen",    label: "Queen",    Icon: BedDouble },
      { value: "king",     label: "King",     Icon: Star     },
    ],
  },
  {
    id: "substituicao", StepIcon: RefreshCw, type: "single",
    question: "Você está substituindo seu colchão atual?",
    options: [
      { value: "sim", label: "Sim, vou substituir",    Icon: RefreshCw },
      { value: "nao", label: "Não, é uma compra nova", Icon: Package   },
    ],
  },
  {
    id: "prioridade", StepIcon: Star, type: "single",
    question: "O que é mais importante para você?",
    subtitle: "Isso nos ajuda a encontrar o colchão perfeito.",
    options: [
      { value: "conforto",     label: "Conforto máximo",  Icon: Heart  },
      { value: "durabilidade", label: "Durabilidade",     Icon: Shield },
      { value: "custo",        label: "Custo-benefício",  Icon: Star   },
    ],
  },
];

const TOTAL = STEPS.length;
const MID_AFTER = 4; // show mid-loading after step index 4 (peso)

// ── Recommendation engine ──────────────────────────────────────────────────────
function computeResult(a: Answers) {
  const peso = a.peso ?? 75;
  const alt  = a.altura ?? 170;
  const imc  = peso / ((alt / 100) ** 2);

  let firmeza = "Intermediário";
  if (imc >= 28 || a.posicao === "costas") firmeza = "Firme";
  if (imc < 22 && a.posicao !== "costas") firmeza = "Macio";
  if (a.firmeza === "macio"  && firmeza !== "Firme") firmeza = "Macio";
  if (a.firmeza === "firme") firmeza = "Firme";

  const dores = a.dores ?? [];
  if (dores.some(d => ["lombar", "coluna"].includes(d)) && firmeza === "Macio") firmeza = "Intermediário";

  const tags: string[] = [
    firmeza === "Firme"  ? "Alto Suporte"          :
    firmeza === "Macio"  ? "Suave e Aconchegante"  : "Conforto Equilibrado",
  ];
  if (a.temperatura === "sim")                        tags.push("Tecnologia Térmica");
  if (a.casal === "casal")                            tags.push("Molas Ensacadas");
  if (dores.some(d => d !== "nenhuma"))               tags.push("Alívio de Pressão");
  if (a.prioridade === "durabilidade")                tags.push("Alta Durabilidade");

  const nome =
    a.casal === "casal"   ? "Castor Duo Confort"    :
    firmeza === "Firme"   ? "Castor Suporte Active" :
    firmeza === "Macio"   ? "Castor Soft Premium"   : "Castor Premium D45";

  return { nome, firmeza, tags };
}

function buildWAMsg(a: Answers, capNome: string, res: { nome: string; firmeza: string }) {
  const altStr  = a.altura ? `${(a.altura / 100).toFixed(2).replace(".", ",")} m` : "-";
  const pesoStr = a.peso   ? `${a.peso} kg` : "-";
  const doresStr = (a.dores ?? []).filter(Boolean).join(", ") || "nenhuma";
  return [
    `Olá! Fiz o Mapa do Sono da Castor e recebi minha recomendação. 🌙`,
    ``,
    `👤 ${capNome}`,
    ``,
    `📋 Meu perfil:`,
    `• Altura: ${altStr} · Peso: ${pesoStr}`,
    `• Para: ${a.casal === "casal" ? "casal" : "uso individual"}`,
    `• Posição ao dormir: ${a.posicao ?? "-"}`,
    `• Dores: ${doresStr}`,
    `• Calor ao dormir: ${a.temperatura === "sim" ? "sim" : "não"}`,
    `• Prioridade: ${a.prioridade ?? "-"}`,
    ``,
    `✅ Recomendação recebida: ${res.nome} (${res.firmeza})`,
    ``,
    `Gostaria de saber mais sobre esse colchão!`,
  ].join("\n");
}

// ── Progress header ─────────────────────────────────────────────────────────────
function ProgressHeader({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / TOTAL) * 100);
  return (
    <div className="px-5 pt-5 pb-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "#777" }}>
          {step + 1} / {TOTAL}
        </span>
        <span className="text-xs font-semibold" style={{ color: "#777" }}>
          {pct}%
        </span>
      </div>
      <div className="h-1 rounded-full" style={{ background: "#1e0000" }}>
        <motion.div
          className="h-1 rounded-full"
          style={{ background: RED }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
        />
      </div>
    </div>
  );
}

// ── Number picker ───────────────────────────────────────────────────────────────
function NumberPicker({
  value, min, max, format, onChange,
}: {
  value: number; min: number; max: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const ticks = Array.from({ length: 11 }, (_, i) => ({
    i,
    left: i * 10,
    major: i % 2 === 0,
    v: Math.round(min + (i / 10) * (max - min)),
  }));

  return (
    <div className="px-6">
      <div className="flex items-center justify-center gap-6 mb-8">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white"
          style={{ background: CARD, border: `1.5px solid ${BORDER}` }}
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>

        <AnimatePresence mode="wait">
          <motion.div
            key={value}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12 }}
            className="text-5xl font-black text-white tracking-tight min-w-[170px] text-center"
          >
            {format(value)}
          </motion.div>
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white"
          style={{ background: CARD, border: `1.5px solid ${BORDER}` }}
        >
          <ChevronRight className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Ruler */}
      <div className="relative h-9">
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: "#2a2a2a" }} />
        <motion.div
          className="absolute top-0 left-0 h-px"
          style={{ background: RED }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
        {/* Current dot */}
        <motion.div
          className="absolute -top-1.5"
          animate={{ left: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ transform: "translateX(-50%)" }}
        >
          <div className="w-3.5 h-3.5 rounded-full" style={{ background: RED, boxShadow: `0 0 10px ${RED}99` }} />
        </motion.div>
        {/* Ticks */}
        {ticks.map(({ left, major, v, i }) => (
          <div key={i} className="absolute flex flex-col items-center" style={{ left: `${left}%`, transform: "translateX(-50%)" }}>
            <div style={{ width: 1, height: major ? 14 : 7, background: left <= pct ? RED : "#3a3a3a" }} />
            {major && (
              <span className="text-[9px] mt-0.5 whitespace-nowrap" style={{ color: "#555" }}>
                {v}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quiz screen ─────────────────────────────────────────────────────────────────
function QuizScreen({
  step, answers, onAnswer, onMultiConfirm, onBack, onContinueNumber,
  sliderValues, setSliderValue,
}: {
  step: number;
  answers: Answers;
  onAnswer: (id: keyof Answers, val: string) => void;
  onMultiConfirm: (id: keyof Answers, vals: string[]) => void;
  onBack: () => void;
  onContinueNumber: (id: keyof Answers, val: number) => void;
  sliderValues: Record<string, number>;
  setSliderValue: (id: string, val: number) => void;
}) {
  const s = STEPS[step];
  const [multiSel, setMultiSel] = useState<string[]>([]);

  useEffect(() => { setMultiSel([]); }, [step]);

  const isHeight = s.type === "height";
  const isWeight = s.type === "weight";
  const isNum    = isHeight || isWeight;
  const numVal   = sliderValues[s.id as string] ?? (s.defaultVal ?? (isHeight ? 170 : 75));

  const fmt = isHeight
    ? (v: number) => `${(v / 100).toFixed(2).replace(".", ",")} m`
    : (v: number) => `${v} kg`;

  function toggleMulti(val: string) {
    if (val === "nenhuma") { setMultiSel(["nenhuma"]); return; }
    setMultiSel(prev => {
      const without = prev.filter(v => v !== "nenhuma");
      return without.includes(val) ? without.filter(v => v !== val) : [...without, val];
    });
  }

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <ProgressHeader step={step} />

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {/* Back */}
        {step > 0 && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 mb-5 text-sm font-semibold"
            style={{ color: "#666" }}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
        )}

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: RED, boxShadow: `0 4px 24px ${RED}55` }}>
            <s.StepIcon className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Question */}
        <h2 className="text-center text-2xl font-black text-white mb-2 leading-snug">
          {s.question}
        </h2>
        {s.subtitle && (
          <p className="text-center text-sm mb-6" style={{ color: "#888" }}>
            {s.subtitle}
          </p>
        )}
        {!s.subtitle && <div className="mb-6" />}

        {/* Number picker */}
        {isNum && (
          <>
            <NumberPicker
              value={numVal}
              min={s.min!}
              max={s.max!}
              format={fmt}
              onChange={v => setSliderValue(s.id as string, v)}
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onContinueNumber(s.id, numVal)}
              className="mt-8 w-full py-4 rounded-2xl font-extrabold text-white text-base"
              style={{ background: RED }}
            >
              Continuar →
            </motion.button>
          </>
        )}

        {/* Single select */}
        {s.type === "single" && s.options && (
          <div className={s.grid2 ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
            {s.options.map(opt => (
              <motion.button
                key={opt.value}
                whileTap={{ scale: 0.97 }}
                onClick={() => onAnswer(s.id, opt.value)}
                className="flex items-center gap-3 p-4 rounded-xl border text-left transition-all"
                style={{
                  background: answers[s.id] === opt.value ? "#1e0000" : CARD,
                  borderColor: answers[s.id] === opt.value ? RED : BORDER,
                }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#0a0000", border: `1px solid ${BORDER}` }}>
                  <opt.Icon className="w-4 h-4" style={{ color: RED }} />
                </div>
                <span className="text-white font-semibold text-sm leading-tight">{opt.label}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Multi select */}
        {s.type === "multi" && s.options && (
          <>
            <div className="flex flex-col gap-3 mb-5">
              {s.options.map(opt => {
                const sel = multiSel.includes(opt.value);
                return (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleMulti(opt.value)}
                    className="flex items-center gap-3 p-4 rounded-xl border text-left"
                    style={{
                      background: sel ? "#1e0000" : CARD,
                      borderColor: sel ? RED : BORDER,
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "#0a0000", border: `1px solid ${BORDER}` }}>
                      <opt.Icon className="w-4 h-4" style={{ color: sel ? RED : "#555" }} />
                    </div>
                    <span className="text-white font-semibold text-sm flex-1">{opt.label}</span>
                    {sel && <Check className="w-4 h-4 shrink-0" style={{ color: RED }} />}
                  </motion.button>
                );
              })}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => multiSel.length > 0 && onMultiConfirm(s.id, multiSel)}
              className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
              style={{
                background: multiSel.length > 0 ? RED : "#2a0808",
                opacity: multiSel.length > 0 ? 1 : 0.5,
              }}
            >
              Confirmar →
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Mid-loading screen ──────────────────────────────────────────────────────────
function MidLoadingScreen() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const total = 1800;
    const raf = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - start) / total) * 100));
    }, 30);
    return () => clearInterval(raf);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center" style={{ background: BG }}>
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full" style={{ border: `3px solid ${BORDER}` }} />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ borderTop: `3px solid ${RED}`, borderRight: `3px solid transparent`, borderBottom: "3px solid transparent", borderLeft: "3px solid transparent" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Scale className="w-8 h-8" style={{ color: RED }} />
        </div>
      </div>
      <h3 className="text-2xl font-black text-white mb-2">Analisando seu biotipo</h3>
      <p className="text-sm mb-8" style={{ color: "#777" }}>
        Calculando perfil ideal com base na sua altura e peso...
      </p>
      <div className="w-full max-w-xs h-1.5 rounded-full" style={{ background: "#1a0000" }}>
        <div className="h-1.5 rounded-full transition-none" style={{ background: RED, width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ── Capture screen ──────────────────────────────────────────────────────────────
function CaptureScreen({
  onSubmit, onBack,
}: {
  onSubmit: (nome: string, whatsapp: string) => void;
  onBack: () => void;
}) {
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        <button onClick={onBack} className="flex items-center gap-1.5 mb-6 text-sm font-semibold" style={{ color: "#666" }}>
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="text-center mb-8">
          <div className="text-3xl mb-3">👋</div>
          <h2 className="text-2xl font-black text-white mb-2">Quase lá!</h2>
          <p className="font-bold text-lg text-white mb-1">Estamos finalizando sua análise personalizada</p>
          <p className="text-sm" style={{ color: "#888" }}>
            Para ver sua recomendação completa, precisamos de seus dados.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: CARD, borderColor: BORDER }}>
            <User className="w-5 h-5 shrink-0" style={{ color: "#666" }} />
            <input
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder:text-[#444] outline-none text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: CARD, borderColor: BORDER }}>
            <Phone className="w-5 h-5 shrink-0" style={{ color: "#666" }} />
            <input
              type="tel"
              placeholder="Seu WhatsApp"
              value={zap}
              onChange={e => setZap(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder:text-[#444] outline-none text-sm font-medium"
            />
          </div>
        </div>

        <p className="text-center text-xs mb-6" style={{ color: "#555" }}>
          🔒 Seus dados estão seguros conosco. Não enviamos spam.
        </p>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => (nome.trim() || zap.trim()) && onSubmit(nome.trim(), zap.trim())}
          className="w-full py-4 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-2"
          style={{ background: RED, opacity: nome.trim() || zap.trim() ? 1 : 0.6 }}
        >
          Ver minha recomendação →
        </motion.button>
      </div>
    </div>
  );
}

// ── Analyzing screen ────────────────────────────────────────────────────────────
function AnalyzingScreen() {
  const items = [
    "Calculando IMC e biotipo corporal...",
    "Mapeando posição de sono...",
    "Cruzando dados de dores e temperatura...",
    "Selecionando o colchão ideal...",
  ];
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center" style={{ background: BG }}>
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full" style={{ border: `3px solid ${BORDER}` }} />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ borderTop: `3px solid ${RED}`, borderRight: "3px solid transparent", borderBottom: "3px solid transparent", borderLeft: "3px solid transparent" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Star className="w-8 h-8" style={{ color: RED }} />
        </div>
      </div>
      <h3 className="text-2xl font-black text-white mb-6">Processando suas respostas...</h3>
      <div className="w-full max-w-xs text-left space-y-3">
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.45 }}
            className="flex items-center gap-3 text-sm"
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: RED }} />
            <span style={{ color: "#aaa" }}>{item}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Result screen ───────────────────────────────────────────────────────────────
function ResultScreen({
  answers, capNome, capZap, onRestart,
}: {
  answers: Answers; capNome: string; capZap: string; onRestart: () => void;
}) {
  const result = computeResult(answers);
  const msg    = buildWAMsg(answers, capNome, result);
  const waUrl  = `https://wa.me/5522992410112?text=${encodeURIComponent(msg)}`;

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
        {/* Header */}
        <div className="text-center pt-8 mb-6">
          <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: RED }}>
            ✅ ANÁLISE CONCLUÍDA
          </p>
          <h2 className="text-2xl font-black text-white mb-2">Seu colchão ideal foi encontrado!</h2>
          <p className="text-sm" style={{ color: "#888" }}>
            Com base nas suas respostas, encontramos o colchão perfeito para o seu perfil.
          </p>
        </div>

        {/* Product card */}
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#666" }}>
              Recomendação Personalizada
            </p>
            <h3 className="text-xl font-black text-white mb-4">{result.nome}</h3>
            <div className="flex flex-wrap gap-2">
              {result.tags.map(tag => (
                <span key={tag} className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "#1e0000", color: RED, border: `1px solid ${BORDER}` }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Profile summary */}
        <div className="rounded-2xl px-5 py-4 mb-6" style={{ background: "#0e0e0e", border: `1px solid #1e1e1e` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#555" }}>Seu Perfil</p>
          <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "#888" }}>
            {answers.altura && (
              <span>Altura: {(answers.altura / 100).toFixed(2).replace(".", ",")} m</span>
            )}
            {answers.peso && (
              <span>Peso: {answers.peso} kg</span>
            )}
            {answers.posicao && (
              <span>Posição: {answers.posicao}</span>
            )}
            {answers.temperatura && (
              <span>Calor: {answers.temperatura === "sim" ? "sim" : "não"}</span>
            )}
          </div>
        </div>

        {/* CTA */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick("mapa_sono_resultado", "Cabo Frio")}
          className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-extrabold text-white text-base mb-3"
          style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}
        >
          <MessageCircle className="w-5 h-5" />
          Falar no WhatsApp
        </a>

        <button
          onClick={onRestart}
          className="w-full py-3 rounded-2xl text-sm font-semibold"
          style={{ color: "#666" }}
        >
          Refazer o diagnóstico
        </button>
      </div>
    </div>
  );
}

// ── Welcome screen ──────────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center" style={{ background: BG }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: RED, boxShadow: `0 4px 24px ${RED}55` }}>
        <BedDouble className="w-8 h-8 text-white" />
      </div>
      <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: RED }}>
        Diagnóstico Gratuito
      </p>
      <h1 className="text-4xl font-black text-white mb-3 leading-tight">
        Mapa do Sono<br />
        <span style={{ color: "#aaa" }}>Castor</span>
      </h1>
      <p className="text-base mb-8 max-w-sm" style={{ color: "#888" }}>
        Responda {TOTAL} perguntas rápidas e receba a recomendação de colchão personalizada para o seu corpo.
      </p>
      <div className="flex flex-col gap-2 mb-10 w-full max-w-xs text-left">
        {["100% Online · Leva menos de 60 segundos", "Personalizado · Baseado no seu biotipo", "Gratuito · Sem compromisso"].map(t => (
          <div key={t} className="flex items-center gap-3 text-sm" style={{ color: "#666" }}>
            <Check className="w-4 h-4 shrink-0" style={{ color: RED }} /> {t}
          </div>
        ))}
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        onClick={onStart}
        className="w-full max-w-xs py-4 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-2"
        style={{ background: RED, boxShadow: `0 4px 24px ${RED}55` }}
      >
        Começar diagnóstico →
      </motion.button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MapaSono({ embedded = false }: MapaSonoProps) {
  const [phase, setPhase]     = useState<Phase>(embedded ? "quiz" : "welcome");
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [capNome, setCapNome] = useState("");
  const [capZap,  setCapZap]  = useState("");

  const midTimer      = useRef<number | null>(null);
  const analyzingTimer = useRef<number | null>(null);
  const autoTimer     = useRef<number | null>(null);

  useEffect(() => () => {
    [midTimer, analyzingTimer, autoTimer].forEach(r => {
      if (r.current !== null) window.clearTimeout(r.current);
    });
  }, []);

  function setAnswer(id: keyof Answers, val: string) {
    const next = { ...answers, [id]: val };
    setAnswers(next);
    if (autoTimer.current !== null) window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(() => { autoTimer.current = null; advance(next); }, 280);
  }

  function setMultiAnswer(id: keyof Answers, vals: string[]) {
    const next = { ...answers, [id]: vals };
    setAnswers(next);
    advance(next);
  }

  function setNumAnswer(id: keyof Answers, val: number) {
    const next = { ...answers, [id]: val };
    setAnswers(next);
    advance(next);
  }

  function advance(cur: Answers) {
    void cur; // just for completeness
    if (step === MID_AFTER) {
      // After peso → mid loading
      setPhase("mid_loading");
      midTimer.current = window.setTimeout(() => {
        midTimer.current = null;
        setStep(s => s + 1);
        setPhase("quiz");
      }, 2000);
    } else if (step >= TOTAL - 1) {
      // After last step → capture
      setPhase("capture");
    } else {
      setStep(s => s + 1);
    }
  }

  function goBack() {
    if (autoTimer.current !== null) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    if (phase === "capture") { setStep(TOTAL - 1); setPhase("quiz"); }
    else if (step > 0) setStep(s => s - 1);
    else if (!embedded) setPhase("welcome");
  }

  function handleCapture(nome: string, zap: string) {
    setCapNome(nome); setCapZap(zap);
    setPhase("analyzing");
    analyzingTimer.current = window.setTimeout(() => {
      analyzingTimer.current = null;
      setPhase("result");
    }, 2600);
  }

  function restart() {
    setPhase(embedded ? "quiz" : "welcome");
    setStep(0);
    setAnswers({});
    setSliders({});
    setCapNome(""); setCapZap("");
  }

  const outerClass = embedded ? "flex flex-col min-h-full" : "flex flex-col min-h-screen";

  return (
    <div className={outerClass} style={{ background: BG }}>
      <AnimatePresence mode="wait">
        {phase === "welcome" && !embedded && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <WelcomeScreen onStart={() => setPhase("quiz")} />
          </motion.div>
        )}

        {phase === "quiz" && (
          <motion.div
            key={`quiz-${step}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <QuizScreen
              step={step}
              answers={answers}
              onAnswer={setAnswer}
              onMultiConfirm={setMultiAnswer}
              onContinueNumber={(id, val) => { setSliders(s => ({ ...s, [id as string]: val })); setNumAnswer(id, val); }}
              onBack={goBack}
              sliderValues={sliders}
              setSliderValue={(id, val) => setSliders(s => ({ ...s, [id]: val }))}
            />
          </motion.div>
        )}

        {phase === "mid_loading" && (
          <motion.div key="mid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <MidLoadingScreen />
          </motion.div>
        )}

        {phase === "capture" && (
          <motion.div key="capture" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col">
            <CaptureScreen onSubmit={handleCapture} onBack={goBack} />
          </motion.div>
        )}

        {phase === "analyzing" && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <AnalyzingScreen />
          </motion.div>
        )}

        {phase === "result" && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col">
            <ResultScreen answers={answers} capNome={capNome} capZap={capZap} onRestart={restart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
