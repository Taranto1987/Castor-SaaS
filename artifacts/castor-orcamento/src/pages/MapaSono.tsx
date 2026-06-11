import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Users, Calendar, Ruler, Scale,
  Cloud, BedDouble, Activity, Thermometer, Maximize2,
  RefreshCw, Star, ChevronLeft, ChevronRight,
  MessageCircle, User, Home, Check, Zap, Heart,
  Shield, Clock, Package, Layers, Phone, Loader2,
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
  tipo_colchao_atual?: string;
  tempo_uso_colchao?: string;
  prioridade?: string;
  // Dados do parceiro — coletados só quando casal === "casal"
  altura2?: number;
  peso2?: number;
  firmeza2?: string;
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
  showIf?: (a: Answers) => boolean;
}

// ── Steps — parceiro com showIf ────────────────────────────────────────────────
const CASAL = (a: Answers) => a.casal === "casal";

const ALL_STEPS: QStep[] = [
  {
    id: "finalidade", StepIcon: ShoppingCart, type: "single",
    question: "O que você está procurando?",
    subtitle: "Isso nos ajuda a direcionar a recomendação certa para você.",
    options: [
      { value: "colchao",      label: "Colchão",             Icon: BedDouble     },
      { value: "box",          label: "Cama box completa",   Icon: Package       },
      { value: "recomendacao", label: "Quero recomendação",  Icon: MessageCircle },
    ],
  },
  {
    id: "casal", StepIcon: Users, type: "single",
    question: "Para quem é o colchão?",
    options: [
      { value: "sozinho", label: "Só para mim",   Icon: User  },
      { value: "casal",   label: "Para um casal", Icon: Users },
      { value: "hospede", label: "Para hóspede",  Icon: Home  },
    ],
  },
  {
    id: "frequencia", StepIcon: Calendar, type: "single",
    question: "Qual a frequência de uso?",
    options: [
      { value: "diario",     label: "Uso diário",              Icon: Zap      },
      { value: "semanal",    label: "Algumas vezes na semana", Icon: Calendar },
      { value: "esporadico", label: "Uso esporádico",          Icon: Clock    },
    ],
  },
  // ── Pessoa 1 ──
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
      { value: "macio",         label: "Mais macio",    Icon: Cloud  },
      { value: "intermediario", label: "Intermediário", Icon: Layers },
      { value: "firme",         label: "Mais firme",    Icon: Shield },
    ],
  },
  // ── Pessoa 2 (condicional) ──
  {
    id: "altura2", StepIcon: Ruler, type: "height",
    question: "Qual a altura do(a) parceiro(a)?",
    subtitle: "Perfil da 2ª pessoa que vai dormir na cama",
    min: 140, max: 210, defaultVal: 165,
    showIf: CASAL,
  },
  {
    id: "peso2", StepIcon: Scale, type: "weight",
    question: "Qual o peso do(a) parceiro(a)?",
    subtitle: "Perfil da 2ª pessoa",
    min: 40, max: 150, defaultVal: 65,
    showIf: CASAL,
  },
  {
    id: "firmeza2", StepIcon: Cloud, type: "single",
    question: "Qual o conforto preferido do(a) parceiro(a)?",
    subtitle: "Isso define o suporte ideal para os dois",
    options: [
      { value: "macio",         label: "Mais macio",    Icon: Cloud  },
      { value: "intermediario", label: "Intermediário", Icon: Layers },
      { value: "firme",         label: "Mais firme",    Icon: Shield },
    ],
    showIf: CASAL,
  },
  // ── Compartilhado ──
  {
    id: "posicao", StepIcon: BedDouble, type: "single",
    question: "Qual posição você mais dorme?",
    options: [
      { value: "lado",    label: "De lado",          Icon: Activity  },
      { value: "costas",  label: "De costas",        Icon: User      },
      { value: "barriga", label: "De barriga",       Icon: Heart     },
      { value: "variado", label: "Varia de posição", Icon: RefreshCw },
    ],
  },
  {
    id: "dores", StepIcon: Activity, type: "multi",
    question: "Você sente alguma dor com frequência?",
    options: [
      { value: "lombar",  label: "Lombar",  Icon: Zap      },
      { value: "coluna",  label: "Coluna",  Icon: Activity },
      { value: "ombro",   label: "Ombro",   Icon: User     },
      { value: "quadril", label: "Quadril", Icon: Heart    },
      { value: "nenhuma", label: "Nenhuma", Icon: Check    },
    ],
  },
  {
    id: "temperatura", StepIcon: Thermometer, type: "single",
    question: "Você sente calor ao dormir?",
    options: [
      { value: "sim", label: "Sim", Icon: Thermometer },
      { value: "nao", label: "Não", Icon: Cloud       },
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
    id: "tipo_colchao_atual", StepIcon: BedDouble, type: "single",
    question: "Qual o tipo do seu colchão atual?",
    subtitle: "Isso nos ajuda a calibrar a transição de conforto.",
    options: [
      { value: "espuma",  label: "Espuma",          Icon: Layers    },
      { value: "mola",    label: "Molas bonell",     Icon: Zap       },
      { value: "pocket",  label: "Molas ensacadas",  Icon: Shield    },
      { value: "madeira", label: "Madeira / tatame", Icon: Package   },
    ],
    showIf: (a: Answers) => a.substituicao === "sim",
  },
  {
    id: "tempo_uso_colchao", StepIcon: Clock, type: "single",
    question: "Há quanto tempo você usa esse colchão?",
    subtitle: "Quanto mais tempo, maior a adaptação do seu corpo.",
    options: [
      { value: "menos_2", label: "Menos de 2 anos", Icon: Clock    },
      { value: "2_5",     label: "2 a 5 anos",      Icon: Calendar },
      { value: "mais_5",  label: "Mais de 5 anos",  Icon: Star     },
      { value: "mais_10", label: "Mais de 10 anos", Icon: Shield   },
    ],
    showIf: (a: Answers) => a.substituicao === "sim",
  },
  {
    id: "prioridade", StepIcon: Star, type: "single",
    question: "O que é mais importante para você?",
    subtitle: "Isso nos ajuda a encontrar o colchão perfeito.",
    options: [
      { value: "conforto",     label: "Conforto máximo", Icon: Heart  },
      { value: "durabilidade", label: "Durabilidade",    Icon: Shield },
      { value: "custo",        label: "Custo-benefício", Icon: Star   },
    ],
  },
];

function getActiveSteps(a: Answers): QStep[] {
  return ALL_STEPS.filter(s => !s.showIf || s.showIf(a));
}

// ── Recommendation engine types ────────────────────────────────────────────────
interface ApiProduto {
  id: number;
  nome: string;
  precoPix?: string;
  imagem?: string;
  familyName?: string;
  familySlug?: string;
  size?: string;
  categoria: string;
  medidas?: string;
  disponivel?: boolean;
  encomenda?: boolean;
}

interface ScoredProduto {
  produto: ApiProduto;
  score: number;
  tags: string[];
  confianca: number;
  flag_calibracao: string | null;
  texto_calibracao: string | null;
}

// ── Recommendation engine ──────────────────────────────────────────────────────
const SIZE_MAP: Record<string, string> = {
  solteiro: "Solteiro",
  casal: "Casal",
  queen: "Queen",
  king: "King",
};

type Firmeza = "firme" | "intermediario_firme" | "intermediario" | "intermediario_macio" | "macio";
const RANK: Record<Firmeza, number> = {
  firme: 4, intermediario_firme: 3, intermediario: 2, intermediario_macio: 1, macio: 0,
};

interface FirmezaResult {
  firmeza: Firmeza;
  flag_calibracao: "adaptacao_leve" | "adaptacao_moderada" | "adaptacao_intensa" | null;
  texto_calibracao: string | null;
}

const HIST_FIRMEZA: Record<string, Firmeza> = {
  espuma:  "intermediario",
  mola:    "intermediario_firme",
  pocket:  "intermediario",
  madeira: "firme",
};

const HIST_TEMPO_MULT: Record<string, number> = {
  menos_2: 0,
  "2_5":   0.3,
  mais_5:  0.6,
  mais_10: 1.0,
};

function calcDrift(a: Answers, firmezaBio: Firmeza): FirmezaResult {
  if (a.substituicao !== "sim" || !a.tipo_colchao_atual || !a.tempo_uso_colchao) {
    return { firmeza: firmezaBio, flag_calibracao: null, texto_calibracao: null };
  }

  const histF = HIST_FIRMEZA[a.tipo_colchao_atual] ?? "intermediario";
  const mult  = HIST_TEMPO_MULT[a.tempo_uso_colchao] ?? 0;
  const histR = RANK[histF];
  const bioR  = RANK[firmezaBio];
  const delta = Math.abs(histR - bioR);

  if (delta === 0 || mult === 0) {
    return { firmeza: firmezaBio, flag_calibracao: null, texto_calibracao: null };
  }

  const drift    = Math.round(delta * mult);
  const dir      = histR > bioR ? 1 : -1;
  const ajusteR  = Math.max(0, Math.min(4, bioR + Math.floor(drift * dir)));
  const firmezaAjustada = (Object.entries(RANK) as [Firmeza, number][])
    .find(([, v]) => v === ajusteR)?.[0] ?? firmezaBio;

  let flag: FirmezaResult["flag_calibracao"] = null;
  let texto: string | null = null;

  if (drift >= 2) {
    flag  = "adaptacao_intensa";
    texto = `Seu corpo se adaptou a ${a.tipo_colchao_atual} por muitos anos. O colchão ideal pode parecer diferente nos primeiros dias — isso é normal.`;
  } else if (drift === 1) {
    flag  = "adaptacao_moderada";
    texto = `Há uma pequena diferença entre o que seu corpo prefere e o que você está acostumado. O período de adaptação é de 7 a 15 dias.`;
  }

  return { firmeza: firmezaAjustada, flag_calibracao: flag, texto_calibracao: texto };
}

function calcConfianca(topScore: number, secondScore: number, totalCandidates: number): number {
  if (totalCandidates === 0) return 0;
  const base    = Math.min(1, topScore / 12);
  const gap     = topScore - secondScore;
  const clarity = Math.min(1, gap / 4);
  const raw     = base * 0.6 + clarity * 0.4;
  return Math.round(Math.max(0.55, Math.min(0.98, raw)) * 100) / 100;
}

function calcFirmezaIndividual(
  peso: number, alt: number, firmezaPref?: string, posicao?: string
): Firmeza {
  const imc = peso / ((alt / 100) ** 2);
  let f: Firmeza = "intermediario";
  if (imc >= 28 || posicao === "costas") f = "firme";
  if (imc < 22 && posicao !== "costas")  f = "macio";
  if (firmezaPref === "firme")                          f = "firme";
  if (firmezaPref === "macio" && f !== "firme")         f = "macio";
  return f;
}

function calcFirmezaAlvo(a: Answers): FirmezaResult {
  const f1 = calcFirmezaIndividual(
    a.peso ?? 75, a.altura ?? 170, a.firmeza, a.posicao
  );

  let r1 = f1;
  if ((a.dores ?? []).some(d => ["lombar", "coluna", "quadril"].includes(d)) && r1 === "macio") {
    r1 = "intermediario";
  }

  let firmezaBio: Firmeza;
  if (a.casal !== "casal" || !a.altura2 || !a.peso2) {
    firmezaBio = r1;
  } else {
    const f2 = calcFirmezaIndividual(a.peso2, a.altura2, a.firmeza2);
    firmezaBio = RANK[r1] >= RANK[f2] ? r1 : f2;
  }

  return calcDrift(a, firmezaBio);
}

function scoreAndTag(
  p: ApiProduto,
  a: Answers,
  fAlvo: Firmeza,
): { score: number; tags: string[] } {
  const txt = `${p.nome} ${p.familyName ?? ""}`.toLowerCase();
  const densM = txt.match(/\bd(\d{2,3})\b/);
  const dens = densM ? parseInt(densM[1]) : null;
  const hasPillow = txt.includes("pillow");
  const hasSpring = txt.includes("molas") || txt.includes("spring") ||
                    txt.includes("pocket") || txt.includes("ensacad");
  let score = 0;

  // Firmness
  if (fAlvo === "firme") {
    if (dens && dens >= 45) score += 4;
    if (dens && dens >= 53) score += 2;
    if (dens && dens <= 28) score -= 3;
    if (!hasPillow) score += 1;
  } else if (fAlvo === "macio") {
    if (hasPillow) score += 4;
    if (dens && dens <= 33) score += 2;
    if (dens && dens >= 53) score -= 2;
  } else {
    if (dens === 45) score += 3;
    if (dens === 33) score += 2;
  }

  // Casal
  if (a.casal === "casal") {
    if (hasSpring) score += 5;
    // Diferença de peso entre os dois → springs individuais ajudam mais
    if (a.peso2 && Math.abs((a.peso ?? 75) - a.peso2) >= 15 && hasSpring) score += 3;
    // Firmeza diferente entre os dois → springs individuais ajudam mais
    if (a.firmeza !== a.firmeza2 && hasSpring) score += 2;
  }

  // Temperatura
  if (a.temperatura === "sim") {
    if (hasSpring) score += 3;
    if (hasPillow) score -= 1;
  }

  // Dores
  const hasPain = (a.dores ?? []).some(d => ["lombar", "coluna", "ombro", "quadril"].includes(d));
  if (hasPain && dens && dens >= 45) score += 2;
  if (hasPain && (txt.includes("ortoped") || txt.includes("anatomic"))) score += 3;

  // Prioridade
  if (a.prioridade === "durabilidade" && dens && dens >= 45) score += 2;
  if (a.prioridade === "conforto" && (hasPillow || txt.includes("premium"))) score += 1;

  // Tags
  const tags: string[] = [];
  const fLabel = fAlvo === "firme" ? "Alto Suporte" : fAlvo === "macio" ? "Suave e Aconchegante" : "Conforto Equilibrado";
  tags.push(fLabel);
  if (hasSpring) tags.push("Molas Ensacadas");
  if (hasPillow) tags.push("Pillow Top");
  if (dens && dens >= 45) tags.push(`Densidade D${dens}`);
  if (hasPain) tags.push("Alívio de Pressão");
  if (a.prioridade === "durabilidade" && dens && dens >= 45) tags.push("Alta Durabilidade");

  return { score, tags: tags.slice(0, 4) };
}

async function fetchRecomendacoes(a: Answers): Promise<ScoredProduto[]> {
  // Timeout obrigatório: sem ele, uma conexão que nunca liquida (proxy/cold start)
  // deixa o skeleton "Buscando produtos..." girando para sempre.
  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch("/api/produtos?categoria=colchoes&limite=100", { signal: ctrl.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!res.ok) throw new Error("api_error");
  const all: ApiProduto[] = await res.json();

  const firmezaResult = calcFirmezaAlvo(a);
  const fAlvo         = firmezaResult.firmeza;
  const tamanhoAlvo   = a.tamanho ? SIZE_MAP[a.tamanho] : null;

  const candidates = all.filter(p => {
    if (!p.disponivel) return false;
    if (p.encomenda) return false;
    if (tamanhoAlvo && p.size && p.size !== tamanhoAlvo) return false;
    return true;
  });

  const scored = candidates.map(p => {
    const { score, tags } = scoreAndTag(p, a, fAlvo);
    return { produto: p, score, tags };
  });

  scored.sort((a, b) => b.score - a.score);

  // Deduplica por família — máximo 1 produto por linha de modelo
  const seen = new Set<string>();
  const unique: { produto: ApiProduto; score: number; tags: string[] }[] = [];
  for (const s of scored) {
    const key = s.produto.familySlug ?? s.produto.nome;
    if (!seen.has(key)) { seen.add(key); unique.push(s); }
    if (unique.length >= 3) break;
  }

  const topScore    = unique[0]?.score ?? 0;
  const secondScore = unique[1]?.score ?? 0;
  const confianca   = calcConfianca(topScore, secondScore, candidates.length);

  return unique.map((s, i) => ({
    ...s,
    confianca:        i === 0 ? confianca : 0,
    flag_calibracao:  i === 0 ? firmezaResult.flag_calibracao : null,
    texto_calibracao: i === 0 ? firmezaResult.texto_calibracao : null,
  }));
}

function buildWAMsg(a: Answers, capNome: string, produtoNome?: string, precoPix?: string) {
  const altStr  = a.altura ? `${(a.altura / 100).toFixed(2).replace(".", ",")} m` : "-";
  const pesoStr = a.peso ? `${a.peso} kg` : "-";
  const doresStr = (a.dores ?? []).filter(d => d !== "nenhuma").join(", ") || "nenhuma";

  const lines = [
    `Olá! Fiz o Mapa do Sono da Castor. 🌙`,
    ``,
    `👤 ${capNome}`,
    ``,
    `📋 Meu perfil:`,
    `• Altura: ${altStr} · Peso: ${pesoStr}`,
    `• Para: ${a.casal === "casal" ? "casal" : "uso individual"}`,
  ];

  if (a.casal === "casal" && a.altura2 && a.peso2) {
    const alt2Str  = `${(a.altura2 / 100).toFixed(2).replace(".", ",")} m`;
    lines.push(`• Parceiro(a): ${alt2Str} · ${a.peso2} kg`);
  }

  lines.push(
    `• Posição ao dormir: ${a.posicao ?? "-"}`,
    `• Dores: ${doresStr}`,
    `• Calor ao dormir: ${a.temperatura === "sim" ? "sim" : "não"}`,
    `• Prioridade: ${a.prioridade ?? "-"}`,
  );

  if (a.tipo_colchao_atual) {
    lines.push(`• Colchão atual: ${a.tipo_colchao_atual}${a.tempo_uso_colchao ? ` (${a.tempo_uso_colchao.replace("_", " ")})` : ""}`);
  }

  lines.push(``);

  if (produtoNome) {
    const precoStr = precoPix ? ` — ${precoPix}` : "";
    lines.push(`✅ Recomendação: ${produtoNome}${precoStr}`, ``);
    lines.push(`Gostaria de saber mais sobre esse colchão!`);
  } else {
    lines.push(`Gostaria de ver os colchões disponíveis para o meu perfil!`);
  }

  return lines.join("\n");
}

// ── Progress header ─────────────────────────────────────────────────────────────
function ProgressHeader({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <div className="px-5 pt-5 pb-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "#777" }}>
          {step + 1} / {total}
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
        <motion.div
          className="absolute -top-1.5"
          animate={{ left: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ transform: "translateX(-50%)" }}
        >
          <div className="w-3.5 h-3.5 rounded-full" style={{ background: RED, boxShadow: `0 0 10px ${RED}99` }} />
        </motion.div>
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
  step, total, stepDef, answers, onAnswer, onMultiConfirm, onBack, onContinueNumber,
  sliderValues, setSliderValue,
}: {
  step: number;
  total: number;
  stepDef: QStep;
  answers: Answers;
  onAnswer: (id: keyof Answers, val: string) => void;
  onMultiConfirm: (id: keyof Answers, vals: string[]) => void;
  onBack: () => void;
  onContinueNumber: (id: keyof Answers, val: number) => void;
  sliderValues: Record<string, number>;
  setSliderValue: (id: string, val: number) => void;
}) {
  const s = stepDef;
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
      <ProgressHeader step={step} total={total} />

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
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

        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: RED, boxShadow: `0 4px 24px ${RED}55` }}>
            <s.StepIcon className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-center text-2xl font-black text-white mb-2 leading-snug">
          {s.question}
        </h2>
        {s.subtitle && (
          <p className="text-center text-sm mb-6" style={{ color: "#888" }}>
            {s.subtitle}
          </p>
        )}
        {!s.subtitle && <div className="mb-6" />}

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
function CaptureScreen({ onSubmit, onBack }: {
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
          <p className="font-bold text-lg text-white mb-1">Finalizando sua análise personalizada</p>
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
  answers, capNome, capZap, onRestart, recomendacoes, produtosLoading,
}: {
  answers: Answers;
  capNome: string;
  capZap: string;
  onRestart: () => void;
  recomendacoes: ScoredProduto[];
  produtosLoading: boolean;
}) {
  void capZap;

  const primary      = recomendacoes[0] ?? null;
  const alternatives = recomendacoes.slice(1);
  const semProdutos  = !produtosLoading && recomendacoes.length === 0;

  const mainNome   = primary?.produto.familyName ?? primary?.produto.nome;
  const mainPreco  = primary?.produto.precoPix;
  const mainWaMsg  = buildWAMsg(answers, capNome, mainNome, mainPreco);
  const mainWaUrl  = `https://wa.me/5522992410112?text=${encodeURIComponent(mainWaMsg)}`;

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
        {/* Header */}
        <div className="text-center pt-8 mb-6">
          <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: RED }}>
            ✅ ANÁLISE CONCLUÍDA
          </p>
          <h2 className="text-2xl font-black text-white mb-2">
            {semProdutos ? "Fale com um especialista" : "Seu colchão ideal foi encontrado!"}
          </h2>
          <p className="text-sm" style={{ color: "#888" }}>
            {semProdutos
              ? "Nossa equipe vai te indicar o modelo ideal para o seu perfil pessoalmente."
              : "Com base nas suas respostas, encontramos o colchão perfeito para você."}
          </p>
        </div>

        {/* Loading skeleton */}
        {produtosLoading && (
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center gap-3 mb-5"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: RED }} />
            <span className="text-sm" style={{ color: "#666" }}>Buscando produtos...</span>
          </div>
        )}

        {/* Sem produtos — não inventamos nada */}
        {semProdutos && (
          <div className="rounded-2xl p-6 text-center mb-5"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="text-4xl mb-3">💬</div>
            <p className="text-white font-black text-lg mb-1">Catálogo em atualização</p>
            <p className="text-sm" style={{ color: "#888" }}>
              Nossa equipe recebeu seu perfil e vai te indicar o melhor colchão via WhatsApp.
            </p>
          </div>
        )}

        {/* Produto principal */}
        {primary && (
          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {primary.produto.imagem && (
              <div className="w-full h-44 overflow-hidden" style={{ background: "#0e0e0e" }}>
                <img
                  src={primary.produto.imagem}
                  alt={mainNome}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            )}
            <div className="px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#666" }}>
                Recomendação Personalizada
              </p>
              <h3 className="text-xl font-black text-white mb-1 leading-tight">{mainNome}</h3>
              {primary.produto.size && (
                <p className="text-sm mb-2" style={{ color: "#888" }}>{primary.produto.size}</p>
              )}
              {mainPreco && (
                <p className="text-lg font-extrabold mb-3" style={{ color: RED }}>{mainPreco} no Pix</p>
              )}
              <div className="flex flex-wrap gap-2">
                {primary.tags.map(tag => (
                  <span key={tag} className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: "#1e0000", color: RED, border: `1px solid ${BORDER}` }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Calibração de adaptação */}
        {primary?.flag_calibracao && primary.texto_calibracao && (
          <div className="rounded-2xl px-5 py-4 mb-5"
            style={{ background: "#1a1200", border: "1px solid #3d2e00" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#f59e0b" }}>
              ⚠️ Período de Adaptação
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#d4a017" }}>
              {primary.texto_calibracao}
            </p>
          </div>
        )}

        {/* Confiança */}
        {primary && !produtosLoading && (
          <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
            style={{ background: "#0e0e0e", border: "1px solid #1e1e1e" }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: RED }} />
            <p className="text-xs" style={{ color: "#666" }}>
              Compatibilidade biomecânica:{" "}
              <span className="font-bold" style={{ color: "#aaa" }}>
                {Math.round((primary.confianca ?? 0) * 100)}%
              </span>
            </p>
          </div>
        )}

        {/* Perfil */}
        <div className="rounded-2xl px-5 py-4 mb-5" style={{ background: "#0e0e0e", border: `1px solid #1e1e1e` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#555" }}>Seu Perfil</p>
          <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "#888" }}>
            {answers.altura && <span>Altura: {(answers.altura / 100).toFixed(2).replace(".", ",")} m</span>}
            {answers.peso   && <span>Peso: {answers.peso} kg</span>}
            {answers.casal === "casal" && answers.altura2 && (
              <span>Parceiro(a): {(answers.altura2 / 100).toFixed(2).replace(".", ",")} m</span>
            )}
            {answers.casal === "casal" && answers.peso2 && (
              <span>Peso parceiro(a): {answers.peso2} kg</span>
            )}
            {answers.posicao    && <span>Posição: {answers.posicao}</span>}
            {answers.temperatura && <span>Calor: {answers.temperatura === "sim" ? "sim" : "não"}</span>}
          </div>
        </div>

        {/* Alternativas */}
        {alternatives.length > 0 && (
          <>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#555" }}>
              Outras opções para você
            </p>
            <div className="flex flex-col gap-3 mb-5">
              {alternatives.map((alt, i) => {
                const altNome = alt.produto.familyName ?? alt.produto.nome;
                const altMsg  = buildWAMsg(answers, capNome, altNome, alt.produto.precoPix);
                const altUrl  = `https://wa.me/5522992410112?text=${encodeURIComponent(altMsg)}`;
                return (
                  <div key={i} className="rounded-xl px-4 py-4 flex items-center gap-4"
                    style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                    {alt.produto.imagem && (
                      <img src={alt.produto.imagem} alt={altNome}
                        className="w-14 h-14 rounded-lg object-contain shrink-0"
                        style={{ background: "#0e0e0e" }} loading="lazy" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm leading-tight truncate">{altNome}</p>
                      {alt.produto.size && (
                        <p className="text-xs mt-0.5" style={{ color: "#666" }}>{alt.produto.size}</p>
                      )}
                      {alt.produto.precoPix && (
                        <p className="text-sm font-extrabold mt-1" style={{ color: RED }}>{alt.produto.precoPix}</p>
                      )}
                    </div>
                    <a href={altUrl} target="_blank" rel="noopener noreferrer"
                      onClick={() => trackWhatsAppClick("mapa_sono_alternativa", "Cabo Frio")}
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: "#25D366" }}>
                      <MessageCircle className="w-4 h-4 text-white" />
                    </a>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* CTA principal */}
        <a
          href={mainWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick("mapa_sono_resultado", "Cabo Frio")}
          className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-extrabold text-white text-base mb-3"
          style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}
        >
          <MessageCircle className="w-5 h-5" />
          Falar no WhatsApp
        </a>

        <button onClick={onRestart} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ color: "#666" }}>
          Refazer o diagnóstico
        </button>
      </div>
    </div>
  );
}

// ── Welcome screen ──────────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  // Show base step count (solo, without partner steps)
  const baseTotal = getActiveSteps({}).length;
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
        Responda {baseTotal} perguntas rápidas e receba a recomendação de colchão personalizada para o seu corpo.
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
  const [recomendacoes, setRecomendacoes] = useState<ScoredProduto[]>([]);
  const [produtosLoading, setProdutosLoading] = useState(false);

  const midTimer        = useRef<number | null>(null);
  const analyzingTimer  = useRef<number | null>(null);
  const autoTimer       = useRef<number | null>(null);
  // Último clique vence o VALOR; primeiro clique vence o TIMER (first-click-wins).
  // Sem isso, cliques repetidos <280ms resetavam o debounce e o avanço nunca disparava.
  const pendingAnswer   = useRef<{ id: keyof Answers; next: Answers } | null>(null);
  const quizStartedAt   = useRef<number>(Date.now());
  const stepTimestamps  = useRef<Record<number, number>>({});

  useEffect(() => () => {
    [midTimer, analyzingTimer, autoTimer].forEach(r => {
      if (r.current !== null) window.clearTimeout(r.current);
    });
  }, []);

  // Recalculate active steps on every render (casal changes step count)
  const activeSteps = getActiveSteps(answers);
  const safeStep    = Math.min(step, activeSteps.length - 1);
  const stepDef     = activeSteps[safeStep];
  const TOTAL       = activeSteps.length;

  function advance(id: keyof Answers, cur: Answers) {
    const steps = getActiveSteps(cur);
    const idx   = steps.findIndex(s => s.id === id);

    // Track timestamp per step for behavioral analysis
    stepTimestamps.current[idx] = Date.now();

    if (id === "peso") {
      // Mid-loading só após peso da pessoa 1
      setPhase("mid_loading");
      midTimer.current = window.setTimeout(() => {
        midTimer.current = null;
        const next = idx + 1;
        if (next >= steps.length) { setPhase("capture"); } else { setStep(next); setPhase("quiz"); }
      }, 2000);
    } else if (idx >= steps.length - 1) {
      setPhase("capture");
    } else {
      setStep(idx + 1);
    }
  }

  function setAnswer(id: keyof Answers, val: string) {
    // Ao mudar casal de "casal" → outro, limpa dados do parceiro
    let next: Answers = { ...answers, [id]: val };
    if (id === "casal" && val !== "casal") {
      next = { ...next, altura2: undefined, peso2: undefined, firmeza2: undefined };
    }
    setAnswers(next);
    pendingAnswer.current = { id, next };
    if (autoTimer.current === null) {
      autoTimer.current = window.setTimeout(() => {
        autoTimer.current = null;
        const p = pendingAnswer.current;
        pendingAnswer.current = null;
        if (p) advance(p.id, p.next);
      }, 280);
    }
  }

  function setMultiAnswer(id: keyof Answers, vals: string[]) {
    const next = { ...answers, [id]: vals };
    setAnswers(next);
    advance(id, next);
  }

  function setNumAnswer(id: keyof Answers, val: number) {
    const next = { ...answers, [id]: val };
    setAnswers(next);
    advance(id, next);
  }

  function goBack() {
    if (autoTimer.current !== null) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    pendingAnswer.current = null;
    if (phase === "capture") { setStep(TOTAL - 1); setPhase("quiz"); }
    else if (safeStep > 0) setStep(safeStep - 1);
    else if (!embedded) setPhase("welcome");
  }

  function handleCapture(nome: string, zap: string) {
    setCapNome(nome);
    setCapZap(zap);
    setPhase("analyzing");
    setRecomendacoes([]);
    setProdutosLoading(true);

    const totalMs = Date.now() - quizStartedAt.current;

    // Fire-and-forget: persist diagnosis + resolve Digital Twin
    fetch("/api/diagnostico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...answers,
        nome,
        whatsapp: zap,
        perfil_comportamental: {
          quiz_duration_ms:  totalMs,
          step_timestamps:   stepTimestamps.current,
          total_steps:       getActiveSteps(answers).length,
        },
      }),
    }).catch(() => { /* non-critical */ });

    fetchRecomendacoes(answers)
      .then(r => { setRecomendacoes(r); setProdutosLoading(false); })
      .catch(() => { setProdutosLoading(false); });

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
    setRecomendacoes([]);
    setProdutosLoading(false);
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
            key={`quiz-${safeStep}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <QuizScreen
              step={safeStep}
              total={TOTAL}
              stepDef={stepDef}
              answers={answers}
              onAnswer={setAnswer}
              onMultiConfirm={setMultiAnswer}
              onContinueNumber={(id, val) => {
                setSliders(s => ({ ...s, [id as string]: val }));
                setNumAnswer(id, val);
              }}
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
            <ResultScreen
              answers={answers}
              capNome={capNome}
              capZap={capZap}
              onRestart={restart}
              recomendacoes={recomendacoes}
              produtosLoading={produtosLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
