import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, MessageCircle, RotateCcw,
  Package, User, BedDouble, Activity, Thermometer, Users, Layers,
  Scale, Ruler, Calendar, Wind, Clock, History, MapPin, Moon, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trackMapaSonoCompleto, trackWhatsAppClick, trackPageView } from "@/lib/tracking";

const WA_CABO_FRIO = { numero: "5522992410112", contato: "ThallesZzz", loja: "Cabo Frio" };
const WA_ARARUAMA  = { numero: "5522988447240", contato: "Marcela",    loja: "Araruama" };
const CIDADES_ARARUAMA = ["araruama", "saquarema", "iguaba grande", "maricá", "silva jardim"];

const C_DARK = "#6B0E1E";
const C_MID  = "#8B1428";
const C_RED  = "#C41230";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ProdutoCatalogo {
  id: number;
  nome: string;
  categoria: string;
  precoPix?: string | null;
  precoPrazo?: string | null;
}

interface UserProfile {
  finalidade?: string;
  biotipo?: string;
  posicao?: string;
  dores?: string[];
  temperatura?: string;
  casal?: string;
  firmeza?: string;
  peso?: string;
  altura?: string;
  idade?: string;
  alergia?: string;
  durabilidade?: string;
  historico?: string;
}

interface Resultado {
  estrutura: "MOLA" | "ESPUMA";
  firmeza: string;
  perfil: string;
  justificativa: string;
  confianca: number;
  tecnologias: string[];
  estrategia: { continuidade: boolean; migracao: boolean; upgrade: boolean };
}

interface Opcao { label: string; value: string; desc?: string; }

interface SliderConfig {
  min: number; max: number; step: number; defaultValue: number;
  unit: string;
  format: (v: number) => string;
  toProfileValue: (v: number) => string;
}

interface Step {
  id: keyof UserProfile;
  pergunta: string;
  subtitulo: string;
  icon: React.ElementType;
  tipo: "single" | "multi" | "slider";
  opcoes: Opcao[];
  slider?: SliderConfig;
}

// ─── STEPS ───────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "finalidade", icon: Package,
    pergunta: "Para qual uso é o colchão?",
    subtitulo: "Selecione a opção que melhor descreve sua necessidade.",
    tipo: "single",
    opcoes: [
      { label: "Uso diário",    desc: "Casa principal — dormida todos os dias", value: "diario"    },
      { label: "Casa de praia", desc: "Temporada ou fim de semana",             value: "praia"     },
      { label: "Uso ocasional", desc: "Quarto de hóspedes ou extra",            value: "ocasional" },
    ],
  },
  {
    id: "casal", icon: Users,
    pergunta: "Para quem é o colchão?",
    subtitulo: "",
    tipo: "single",
    opcoes: [
      { label: "Só para mim",              desc: "Uso individual",                          value: "sozinho"         },
      { label: "Casal — pesos parecidos",  desc: "Diferença menor que 20 kg entre os dois", value: "casal_similar"   },
      { label: "Casal — pesos diferentes", desc: "Diferença maior que 20 kg",               value: "casal_diferente" },
      { label: "Com filho(s) pequeno(s)",  desc: "Criança dorme na mesma cama às vezes",    value: "familia"         },
    ],
  },
  {
    id: "biotipo", icon: User,
    pergunta: "Como você descreveria seu biotipo?",
    subtitulo: "Isso determina o suporte correto para o seu corpo.",
    tipo: "single",
    opcoes: [
      { label: "Leve",   desc: "Até 60 kg",        value: "leve"   },
      { label: "Médio",  desc: "Entre 60 e 90 kg",  value: "medio"  },
      { label: "Pesado", desc: "Acima de 90 kg",    value: "pesado" },
    ],
  },
  {
    id: "altura", icon: Ruler,
    pergunta: "Qual é a sua altura?",
    subtitulo: "Arraste o controle para selecionar.",
    tipo: "slider",
    opcoes: [],
    slider: {
      min: 140, max: 210, step: 1, defaultValue: 170,
      unit: "m",
      format: (v) => `${(v / 100).toFixed(2).replace(".", ",")} m`,
      toProfileValue: (v) => v < 160 ? "ate160" : v <= 175 ? "160a175" : v <= 190 ? "175a190" : "acima190",
    },
  },
  {
    id: "peso", icon: Scale,
    pergunta: "Qual é o seu peso aproximado?",
    subtitulo: "Para calcular a densidade correta do colchão.",
    tipo: "slider",
    opcoes: [],
    slider: {
      min: 40, max: 150, step: 1, defaultValue: 70,
      unit: "kg",
      format: (v) => `${v} kg`,
      toProfileValue: (v) => v < 50 ? "ate50" : v < 70 ? "50a70" : v < 90 ? "70a90" : v < 110 ? "90a110" : "acima110",
    },
  },
  {
    id: "posicao", icon: BedDouble,
    pergunta: "Qual posição você mais dorme?",
    subtitulo: "A posição influencia diretamente na firmeza ideal.",
    tipo: "single",
    opcoes: [
      { label: "De lado",                   desc: "Posição fetal ou semi-fetal",        value: "lado"    },
      { label: "De costas",                  desc: "Posição supina / barriga para cima", value: "costas"  },
      { label: "De bruços",                  desc: "Barriga voltada para baixo",         value: "brucos"  },
      { label: "Mudo muito durante a noite", desc: "Posição varia ao longo da noite",    value: "variado" },
    ],
  },
  {
    id: "firmeza", icon: Layers,
    pergunta: "Qual firmeza você prefere?",
    subtitulo: "Considere seu conforto subjetivo, não só a saúde.",
    tipo: "single",
    opcoes: [
      { label: "Muito firme", desc: "Gosto de sentir resistência ao deitar",   value: "muito_firme" },
      { label: "Firme",        desc: "Suporte bom sem ser duro",                value: "firme"       },
      { label: "Médio",        desc: "Equilíbrio entre firmeza e conforto",    value: "medio"       },
      { label: "Macio",        desc: "Afundo um pouco — gosto de ser abraçado", value: "macio"       },
    ],
  },
  {
    id: "temperatura", icon: Thermometer,
    pergunta: "Você sente calor ao dormir?",
    subtitulo: "A regulação térmica interfere na qualidade do sono.",
    tipo: "single",
    opcoes: [
      { label: "Esquento muito",     desc: "Sudo fácil ou acordo com calor",     value: "quente" },
      { label: "Temperatura normal", desc: "Não tenho problema com temperatura", value: "normal" },
      { label: "Tenho frio",         desc: "Preciso de cobertor mesmo no verão", value: "frio"   },
    ],
  },
  {
    id: "dores", icon: Activity,
    pergunta: "Você sente alguma dor com frequência?",
    subtitulo: "Pode marcar mais de uma opção.",
    tipo: "multi",
    opcoes: [
      { label: "Não sinto dores",               value: "nenhuma" },
      { label: "Costas / Coluna",               desc: "Lombar ou torácica",            value: "coluna"  },
      { label: "Quadril",                        desc: "Lateral ou glúteos",            value: "quadril" },
      { label: "Ombros / Pescoço",               desc: "Cervical e membros superiores", value: "ombros"  },
      { label: "Pressão nos pontos de contato",  desc: "Formigamento ou dormência",     value: "pressao" },
    ],
  },
  {
    id: "alergia", icon: Wind,
    pergunta: "Você tem alguma sensibilidade?",
    subtitulo: "Fundamental para indicar o tecido e tratamento certo.",
    tipo: "single",
    opcoes: [
      { label: "Não tenho alergias", value: "nenhuma" },
      { label: "Rinite ou Asma",      desc: "Sensibilidade a pó ou ácaro",   value: "rinite"  },
      { label: "Pele sensível",       desc: "Reação a tecidos ou materiais", value: "pele"    },
      { label: "Não sei ao certo",    value: "nao_sei" },
    ],
  },
  {
    id: "durabilidade", icon: Clock,
    pergunta: "Por quanto tempo quer que dure?",
    subtitulo: "Isso define a densidade e a estrutura mais indicadas.",
    tipo: "single",
    opcoes: [
      { label: "Curto prazo",  desc: "1 a 3 anos de uso",   value: "curto" },
      { label: "Médio prazo",  desc: "3 a 7 anos de uso",   value: "medio" },
      { label: "Longo prazo",  desc: "7 a 10+ anos de uso", value: "longo" },
    ],
  },
  {
    id: "idade", icon: Calendar,
    pergunta: "Qual é a sua faixa de idade?",
    subtitulo: "Necessidades de suporte articular variam com a idade.",
    tipo: "single",
    opcoes: [
      { label: "Até 18 anos",      desc: "Jovem em crescimento",              value: "menor18" },
      { label: "18 a 35 anos",     desc: "Adulto jovem — ativo",              value: "18a35"   },
      { label: "35 a 55 anos",     desc: "Adulto — foco em recuperação",      value: "35a55"   },
      { label: "Acima de 55 anos", desc: "Maior atenção ao conforto articular", value: "acima55" },
    ],
  },
  {
    id: "historico", icon: History,
    pergunta: "Qual é o seu colchão atual?",
    subtitulo: "Saber de onde você vem ajuda a calibrar a transição.",
    tipo: "single",
    opcoes: [
      { label: "Colchão de mola",               value: "mola"    },
      { label: "Espuma ou viscoelástico",        value: "espuma"  },
      { label: "Cama de madeira / estrado",      value: "madeira" },
      { label: "Nunca tive colchão de qualidade", value: "nenhum" },
    ],
  },
];

const STEP_OPTION_SET = STEPS.reduce((acc, step) => {
  if (step.tipo !== "slider") acc[step.id] = new Set(step.opcoes.map(o => o.value));
  return acc;
}, {} as Partial<Record<keyof UserProfile, Set<string>>>);

// ─── VALIDATION ──────────────────────────────────────────────────────────────

function validarPerfil(p: UserProfile): string | null {
  for (const step of STEPS) {
    const valor = p[step.id];
    if (step.tipo === "slider") {
      if (typeof valor !== "string" || valor.length === 0) return `Responda: ${step.pergunta}`;
    } else if (step.tipo === "multi") {
      if (!Array.isArray(valor) || valor.length === 0) return `Responda: ${step.pergunta}`;
      if (valor.some(v => !STEP_OPTION_SET[step.id]?.has(v))) return `Resposta inválida: ${step.pergunta}`;
    } else {
      if (typeof valor !== "string" || !STEP_OPTION_SET[step.id]?.has(valor)) return `Responda: ${step.pergunta}`;
    }
  }
  return null;
}

// ─── SCORING ENGINE ──────────────────────────────────────────────────────────

function calcularResultado(p: UserProfile): Resultado {
  let scoreMola = 0; let scoreEspuma = 0;

  if (p.biotipo === "pesado") scoreMola += 3;
  else if (p.biotipo === "medio") scoreMola += 1;
  else scoreEspuma += 1;

  if (p.finalidade === "praia") scoreMola += 2;
  if (p.finalidade === "diario") scoreMola += 1;
  if (p.temperatura === "quente") scoreMola += 2;
  else if (p.temperatura === "frio") scoreEspuma += 1;

  if (p.casal === "casal_diferente" || p.casal === "casal_similar") scoreMola += 2;
  if (p.casal === "familia") scoreMola += 1;
  if (p.durabilidade === "longo") scoreMola += 2;
  else if (p.durabilidade === "medio") scoreMola += 1;

  const dores = Array.isArray(p.dores) ? p.dores : [];
  if (dores.includes("coluna") || dores.includes("quadril") || dores.includes("pressao")) scoreEspuma += 2;
  if (dores.includes("ombros")) scoreEspuma += 1;
  if (p.firmeza === "muito_firme" || p.firmeza === "firme") scoreMola += 1;
  if (p.firmeza === "macio") scoreEspuma += 2;
  if (p.idade === "acima55") scoreEspuma += 2;
  if (p.idade === "menor18" || p.idade === "18a35") scoreMola += 1;
  if (p.alergia === "rinite") scoreEspuma += 2;
  if (p.alergia === "pele") scoreEspuma += 1;
  if (p.posicao === "lado" || p.posicao === "brucos") scoreEspuma += 1;

  const estrategia = { continuidade: false, migracao: false, upgrade: false };
  if (p.historico === "mola")   { scoreMola   += 2; estrategia.continuidade = true; }
  if (p.historico === "espuma") { scoreEspuma += 1; estrategia.continuidade = true; }
  if (p.historico === "madeira"){ scoreEspuma += 3; estrategia.migracao     = true; }
  if (p.historico === "nenhum") { scoreMola   += 1; estrategia.upgrade      = true; }

  const estrutura: "MOLA" | "ESPUMA" = scoreMola >= scoreEspuma ? "MOLA" : "ESPUMA";

  let firmeza = "Médio";
  if (p.firmeza === "muito_firme") firmeza = "Extra Firme";
  else if (p.firmeza === "firme")  firmeza = "Firme";
  else if (p.firmeza === "macio")  firmeza = "Macio";

  const finalidadeLabel: Record<string, string> = { diario: "uso diário", praia: "casa de praia", ocasional: "uso ocasional" };
  const perfil = `${p.biotipo === "pesado" ? "Pessoa pesada" : p.biotipo === "medio" ? "Biotipo médio" : "Pessoa leve"}, ${finalidadeLabel[p.finalidade ?? ""] ?? ""}`;

  const justificativas: string[] = [];
  const tecnologias: string[] = [];

  if (estrutura === "MOLA") {
    if (p.temperatura === "quente") { justificativas.push("a ventilação natural das molas mantém o corpo na temperatura ideal de 18–22°C para sono REM (Stanford Sleep Center)"); tecnologias.push("Fresh Comfort Gel®"); }
    if (p.biotipo === "pesado")     { justificativas.push("as molas Tecnopedic® de aço temperado eletronicamente garantem suporte real para seu biotipo, sem afundamento precoce (INER)"); tecnologias.push("Molas Tecnopedic®"); }
    if (p.casal?.includes("casal")) { justificativas.push("o sistema Pocket® pré-comprimido elimina a transferência de movimento — se um se mexe, o outro não sente"); tecnologias.push("Pocket® Autêntico"); }
    if (p.durabilidade === "longo") { justificativas.push("o sistema Double Face permite girar o colchão, aumentando a vida útil em até 50% — projetado para 10+ anos"); tecnologias.push("Double Face"); }
    if (!tecnologias.includes("Pocket® Autêntico")) tecnologias.push("Pocket® Autêntico");
  } else {
    if (dores.length > 0 && !dores.includes("nenhuma")) { justificativas.push("firmeza média comprovada como superior para dores lombares e de quadril em estudo publicado pela The Lancet"); tecnologias.push("Selo Pró-Espuma INER"); }
    if (p.alergia === "rinite" || p.alergia === "pele") { justificativas.push("o tratamento Actigard® elimina permanentemente ácaros, fungos e bactérias — essencial para saúde respiratória"); tecnologias.push("Actigard® Anti-ácaros"); }
    if (p.posicao === "lado" || p.posicao === "brucos") { justificativas.push("o Pillow Top reduz pontos de pressão em ombros e quadris, diminuindo o giro na cama em até 80%"); tecnologias.push("Pillow Top"); }
    if (p.idade === "acima55")      { justificativas.push("conforto articular certificado pelo INER com densidade real garantida — D33 a D45 sem carga mineral"); tecnologias.push("Densidade Real INER"); }
    if (p.temperatura === "quente") { justificativas.push("espuma com células abertas + partículas de gel dissipam o calor corporal durante o sono"); tecnologias.push("Fresh Comfort Gel®"); }
    if (tecnologias.length === 0) tecnologias.push("Selo Pró-Espuma INER");
  }

  const justificativa = justificativas.length > 0
    ? justificativas.slice(0, 2).join("; ") + "."
    : "perfil equilibrado com boa relação custo-benefício certificada pelo INER.";

  const total = scoreMola + scoreEspuma;
  const dominant = Math.max(scoreMola, scoreEspuma);
  const confianca = Math.round(70 + (total === 0 ? 0.75 : dominant / total) * 29);

  return { estrutura, firmeza, perfil, justificativa, confianca, tecnologias, estrategia };
}

function gerarMensagemWA(p: UserProfile, r: Resultado, contato: string): string {
  const labels: Record<string, Record<string, string>> = {
    finalidade:  { diario: "Uso diário", praia: "Casa de praia", ocasional: "Uso ocasional" },
    biotipo:     { leve: "Leve (até 60kg)", medio: "Médio (60–90kg)", pesado: "Pesado (+90kg)" },
    posicao:     { lado: "De lado", costas: "De costas", brucos: "De bruços", variado: "Varia" },
    temperatura: { quente: "Esquento muito", normal: "Normal", frio: "Tenho frio" },
    casal:       { sozinho: "Sozinho(a)", casal_similar: "Casal (pesos similares)", casal_diferente: "Casal (pesos diferentes)", familia: "Com filhos" },
    firmeza:     { muito_firme: "Muito firme", firme: "Firme", medio: "Médio", macio: "Macio" },
    alergia:     { nenhuma: "Nenhuma", rinite: "Rinite/Asma", pele: "Pele sensível", nao_sei: "Não sei" },
    durabilidade:{ curto: "1–3 anos", medio: "3–7 anos", longo: "7–10+ anos" },
    historico:   { mola: "Mola", espuma: "Espuma", madeira: "Madeira/estrado", nenhum: "Não tive" },
  };
  const get = (key: keyof UserProfile, val?: string) => val ? (labels[key]?.[val] ?? val) : "—";
  const doresLabel = Array.isArray(p.dores) && !p.dores.includes("nenhuma")
    ? p.dores.map(d => ({ coluna: "Costas/coluna", quadril: "Quadril", ombros: "Ombros/pescoço", pressao: "Pressão" }[d] ?? d)).join(", ")
    : "Nenhuma";
  return `Olá, ${contato}! 👋 Acabei de preencher o *Mapa do Sono* e quero minha recomendação personalizada!\n\n📋 *Meu perfil completo:*\n• Finalidade: ${get("finalidade", p.finalidade)}\n• Biotipo: ${get("biotipo", p.biotipo)}\n• Posição ao dormir: ${get("posicao", p.posicao)}\n• Dores: ${doresLabel}\n• Temperatura: ${get("temperatura", p.temperatura)}\n• Uso: ${get("casal", p.casal)}\n• Firmeza preferida: ${get("firmeza", p.firmeza)}\n• Peso: ${p.peso ?? "—"} / Altura: ${p.altura ?? "—"}\n• Idade: ${p.idade ?? "—"}\n• Alergia: ${get("alergia", p.alergia)}\n• Durabilidade esperada: ${get("durabilidade", p.durabilidade)}\n• Histórico: ${get("historico", p.historico)}\n\n🎯 *Resultado do Mapa do Sono:*\nEstrutura recomendada: *${r.estrutura === "MOLA" ? "Mola Ensacada" : "Espuma / Viscoelástico"}*\nFirmeza ideal: *${r.firmeza}*\n\nQuero ver as opções disponíveis e saber o melhor preço! 🛏️\n\n💊 *Compatibilidade com meu perfil:* ${r.confianca}%\n🔧 *Tecnologias indicadas:* ${r.tecnologias.join(" · ")}\n\nTambém tenho interesse no *kit completo* (protetor de colchão + travesseiro)! 😊`;
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function RadioOption({ opcao, selected, onSelect }: { opcao: Opcao; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center justify-between px-5 py-[18px] border-b border-slate-100 last:border-0 text-left transition-colors",
        selected ? "bg-rose-50/70" : "bg-white active:bg-slate-50/80"
      )}
    >
      <div className="flex-1 min-w-0 pr-4">
        <p className={cn("text-[15px] font-semibold leading-snug", selected ? "text-[#6B0E1E]" : "text-slate-800")}>
          {opcao.label}
        </p>
        {opcao.desc && (
          <p className={cn("text-[12px] mt-0.5 leading-snug", selected ? "text-[#8B1428]/60" : "text-slate-400")}>
            {opcao.desc}
          </p>
        )}
      </div>
      <div className={cn(
        "w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150",
        selected ? "border-[#C41230]" : "border-slate-300"
      )}>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="w-[10px] h-[10px] rounded-full bg-[#C41230]"
          />
        )}
      </div>
    </motion.button>
  );
}

function MultiOption({ opcao, selected, onToggle }: { opcao: Opcao; selected: boolean; onToggle: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onToggle}
      className={cn(
        "w-full flex items-center justify-between px-5 py-[18px] border-b border-slate-100 last:border-0 text-left transition-colors",
        selected ? "bg-rose-50/70" : "bg-white active:bg-slate-50/80"
      )}
    >
      <div className="flex-1 min-w-0 pr-4">
        <p className={cn("text-[15px] font-semibold leading-snug", selected ? "text-[#6B0E1E]" : "text-slate-800")}>
          {opcao.label}
        </p>
        {opcao.desc && (
          <p className={cn("text-[12px] mt-0.5 leading-snug", selected ? "text-[#8B1428]/60" : "text-slate-400")}>
            {opcao.desc}
          </p>
        )}
      </div>
      <div className={cn(
        "w-[22px] h-[22px] rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all duration-150",
        selected ? "border-[#C41230] bg-[#C41230]" : "border-slate-300 bg-white"
      )}>
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="1.5,6 4.5,9 10.5,3" />
          </svg>
        )}
      </div>
    </motion.button>
  );
}

function SliderInput({ cfg, value, onChange }: { cfg: SliderConfig; value: number; onChange: (v: number) => void }) {
  const pct = ((value - cfg.min) / (cfg.max - cfg.min)) * 100;
  const formatted = cfg.format(value);
  const parts = formatted.split(" ");
  const numPart  = parts[0];
  const unitPart = parts.slice(1).join(" ");

  return (
    <div className="flex flex-col items-center px-8 pt-10 pb-8">
      <div className="text-center mb-10 select-none">
        <motion.span
          key={numPart}
          initial={{ opacity: 0.5, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.08 }}
          className="text-[76px] font-black text-slate-900 leading-none tabular-nums"
        >
          {numPart}
        </motion.span>
        <span className="text-[26px] font-bold text-slate-400 ml-2">{unitPart}</span>
      </div>

      <div className="w-full">
        <input
          type="range"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="castor-slider w-full"
          style={{
            background: `linear-gradient(to right, ${C_RED} ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
      </div>

      <div className="flex justify-between w-full mt-3 text-xs text-slate-400 font-semibold">
        <span>{cfg.format(cfg.min)}</span>
        <span>{cfg.format(cfg.max)}</span>
      </div>
    </div>
  );
}

function AnalyzingScreen() {
  const checks = [
    "Avaliando sua posição de sono",
    "Calculando densidade ideal",
    "Selecionando tecnologias",
    "Gerando recomendação personalizada",
  ];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: `linear-gradient(160deg, ${C_DARK} 0%, ${C_MID} 100%)` }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center px-8 w-full max-w-sm"
      >
        <motion.div
          className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white mx-auto mb-7"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <h2 className="text-white text-xl font-black mb-2">Analisando seu perfil…</h2>
        <p className="text-white/60 text-sm mb-8">Estamos finalizando sua recomendação personalizada</p>

        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-8">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.2, ease: "easeInOut" }}
          />
        </div>

        <div className="space-y-2.5 text-left">
          {checks.map((check, i) => (
            <motion.div
              key={check}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.42, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.42 + 0.18, type: "spring", stiffness: 500 }}
                className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0"
              >
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <polyline points="1.5,6 4.5,9 10.5,3" />
                </svg>
              </motion.div>
              <p className="text-white/80 text-[14px] font-medium">{check}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

interface MapaSonoProps {
  embedded?: boolean;
}

export default function MapaSono({ embedded = false }: MapaSonoProps) {
  const [phase, setPhase] = useState<"welcome" | "quiz" | "analyzing" | "result">("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile]     = useState<UserProfile>({});
  const [multiSelect, setMultiSelect]   = useState<string[]>([]);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [sliderValues, setSliderValues] = useState<Partial<Record<keyof UserProfile, number>>>({});
  const [resultado, setResultado]   = useState<Resultado | null>(null);
  const [precoCalc, setPrecoCalc]   = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [produtosRec, setProdutosRec] = useState<ProdutoCatalogo[]>([]);
  const [waDestino, setWaDestino]   = useState(WA_CABO_FRIO);
  const [autoDetected, setAutoDetected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoAdvanceTimer = useRef<number | null>(null);

  useEffect(() => { trackPageView("mapa_sono"); }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then(r => r.json())
      .then((data: { city?: string }) => {
        const cidade = (data.city ?? "").toLowerCase();
        if (CIDADES_ARARUAMA.some(c => cidade.includes(c))) setWaDestino(WA_ARARUAMA);
        setAutoDetected(true);
      })
      .catch(() => { setAutoDetected(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [stepIndex, phase]);

  useEffect(() => {
    if (phase !== "result" || !resultado) return;
    fetch("/api/produtos")
      .then(r => r.ok ? r.json() : [])
      .then((produtos: ProdutoCatalogo[]) => {
        const keywords = resultado.estrutura === "MOLA"
          ? ["mola", "pocket", "molas", "ensacada"]
          : ["espuma", "visco", "viscoelástico", "viscoelastico", "gel", "latex"];
        const colchoes = produtos.filter((p: ProdutoCatalogo) => {
          const cat = (p.categoria ?? "").toLowerCase();
          const nome = (p.nome ?? "").toLowerCase();
          if (!cat.includes("colch") && !nome.includes("colch")) return false;
          return keywords.some(kw => nome.includes(kw) || cat.includes(kw));
        });
        setProdutosRec(colchoes.slice(0, 3));
      })
      .catch(() => {});
  }, [phase, resultado]);

  // Restore step state when navigating back
  useEffect(() => {
    if (phase !== "quiz") return;
    const step = STEPS[stepIndex];
    if (!step) return;
    if (step.tipo === "multi") {
      const saved = (profile as Record<string, unknown>)[step.id];
      setMultiSelect(Array.isArray(saved) ? (saved as string[]) : []);
      setPendingValue(null);
    } else if (step.tipo === "single") {
      const saved = (profile as Record<string, unknown>)[step.id];
      setPendingValue(typeof saved === "string" ? saved : null);
      setMultiSelect([]);
    }
    // Clear auto-advance timer when step changes
    if (autoAdvanceTimer.current !== null) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, [stepIndex, phase]);

  const currentStep = phase === "quiz" ? STEPS[stepIndex] ?? null : null;
  const total = STEPS.length;
  const pct   = phase === "quiz"
    ? Math.round((stepIndex / total) * 100)
    : phase === "analyzing" || phase === "result" ? 100 : 0;

  function getSliderValue(id: keyof UserProfile, cfg: SliderConfig): number {
    return sliderValues[id] ?? cfg.defaultValue;
  }

  function finalizeQuiz(p: UserProfile) {
    const err = validarPerfil(p);
    if (err) { setValidationError(err); return; }
    const res = calcularResultado(p);
    setResultado(res);
    trackMapaSonoCompleto(res.estrutura, res.firmeza, res.confianca);
    setPhase("analyzing");
    window.setTimeout(() => setPhase("result"), 2600);
  }

  function advanceSingle(value: string) {
    if (!currentStep) return;
    const newProfile = { ...profile, [currentStep.id]: value };
    setProfile(newProfile);
    setPendingValue(null);
    setValidationError(null);
    if (stepIndex + 1 >= total) finalizeQuiz(newProfile);
    else setStepIndex(i => i + 1);
  }

  function avancar() {
    if (!currentStep) return;
    setValidationError(null);
    if (currentStep.tipo === "slider" && currentStep.slider) {
      const val = getSliderValue(currentStep.id, currentStep.slider);
      const newProfile = { ...profile, [currentStep.id]: currentStep.slider.toProfileValue(val) };
      setProfile(newProfile);
      if (stepIndex + 1 >= total) finalizeQuiz(newProfile);
      else setStepIndex(i => i + 1);
    } else if (currentStep.tipo === "multi") {
      if (multiSelect.length === 0) return;
      const newProfile = { ...profile, [currentStep.id]: multiSelect };
      setProfile(newProfile);
      setMultiSelect([]);
      if (stepIndex + 1 >= total) finalizeQuiz(newProfile);
      else setStepIndex(i => i + 1);
    }
  }

  function voltar() {
    if (autoAdvanceTimer.current !== null) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (stepIndex === 0) setPhase("welcome");
    else setStepIndex(i => i - 1);
  }

  function toggleMulti(val: string) {
    if (val === "nenhuma") { setMultiSelect(["nenhuma"]); return; }
    setMultiSelect(prev => {
      const without = prev.filter(v => v !== "nenhuma");
      return without.includes(val) ? without.filter(v => v !== val) : [...without, val];
    });
  }

  function reiniciar() {
    setPhase("welcome");
    setStepIndex(0);
    setProfile({});
    setMultiSelect([]);
    setPendingValue(null);
    setSliderValues({});
    setResultado(null);
    setPrecoCalc("");
    setValidationError(null);
    setProdutosRec([]);
  }

  function handleSingleSelect(value: string) {
    setPendingValue(value);
    if (autoAdvanceTimer.current !== null) window.clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = window.setTimeout(() => {
      autoAdvanceTimer.current = null;
      advanceSingle(value);
    }, 300);
  }

  const canNext = currentStep
    ? currentStep.tipo === "slider" ? true
      : currentStep.tipo === "multi" ? multiSelect.length > 0
      : !!pendingValue
    : false;

  // ── WELCOME ──────────────────────────────────────────────────────────────────
  if (phase === "welcome") {
    return (
      <div
        ref={scrollRef}
        className={cn("flex flex-col", embedded ? "min-h-full" : "min-h-screen")}
        style={{ background: `linear-gradient(155deg, ${C_DARK} 0%, ${C_MID} 60%, #A01020 100%)` }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
                <Moon className="w-7 h-7 text-white" />
              </div>
              <p className="text-white/50 text-[11px] font-bold tracking-[0.25em] uppercase mb-2">
                Castor Colchões · {waDestino.loja}
              </p>
              <h1 className="text-white text-[38px] font-black leading-none mb-3">Mapa do Sono</h1>
              <p className="text-white/70 text-[15px] leading-relaxed max-w-[280px] mx-auto">
                Descubra o colchão ideal para o seu corpo em menos de 3 minutos.
              </p>
              {autoDetected && (
                <button
                  onClick={() => setWaDestino(prev => prev.numero === WA_CABO_FRIO.numero ? WA_ARARUAMA : WA_CABO_FRIO)}
                  className="mt-3 inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-[11px] bg-white/8 hover:bg-white/15 px-3 py-1.5 rounded-full transition-all"
                >
                  <MapPin className="w-3 h-3" />
                  Loja: {waDestino.loja} — trocar
                </button>
              )}
            </div>

            <div className="space-y-2 mb-8">
              {[
                { t: `${total} perguntas — só cliques, sem digitar`,  d: "Rápido e direto ao ponto" },
                { t: "Motor de recomendação baseado em pesquisas INER", d: "Ciência aplicada ao sono" },
                { t: "Resultado completo no WhatsApp",                  d: "Atendimento imediato" },
              ].map(item => (
                <div key={item.t} className="flex items-start gap-3 bg-white/8 rounded-2xl px-4 py-3.5">
                  <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <polyline points="1.5,6 4.5,9 10.5,3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-[13px] font-semibold leading-snug">{item.t}</p>
                    <p className="text-white/45 text-[11px] mt-0.5">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={() => { setStepIndex(0); setPhase("quiz"); }}
              className="w-full py-4 rounded-2xl bg-white font-black text-[16px] flex items-center justify-center gap-2 shadow-lg shadow-black/20"
              style={{ color: C_DARK }}
            >
              Começar diagnóstico
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── ANALYZING ────────────────────────────────────────────────────────────────
  if (phase === "analyzing") return <AnalyzingScreen />;

  // ── RESULT ───────────────────────────────────────────────────────────────────
  if (phase === "result" && resultado) {
    const wa = `https://wa.me/${waDestino.numero}?text=${encodeURIComponent(gerarMensagemWA(profile, resultado, waDestino.contato))}`;
    return (
      <div ref={scrollRef} className={cn("bg-slate-50 overflow-auto", embedded ? "min-h-full" : "min-h-screen")}>
        {/* Crimson result header */}
        <div
          className="px-5 pt-6 pb-10"
          style={{ background: `linear-gradient(155deg, ${C_DARK} 0%, ${C_MID} 100%)` }}
        >
          <p className="text-white/50 text-[10px] font-bold tracking-[0.25em] uppercase mb-5">
            Mapa do Sono · Resultado
          </p>
          <h2 className="text-white text-[24px] font-black leading-snug mb-1">
            Seu colchão ideal<br />foi encontrado!
          </h2>
          <p className="text-white/60 text-sm mb-6">Baseado em {total} respostas personalizadas</p>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">Estrutura recomendada</p>
            <p className="text-white text-[20px] font-black">
              {resultado.estrutura === "MOLA" ? "🌀 Mola Ensacada" : "🧽 Espuma / Viscoelástico"}
            </p>
            <p className="text-white/80 text-sm font-semibold mt-0.5">Firmeza: {resultado.firmeza}</p>

            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-white/60">Compatibilidade com seu perfil</span>
                <span className="text-white">{resultado.confianca}%</span>
              </div>
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${resultado.confianca}%` }}
                  transition={{ delay: 0.3, duration: 0.9 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 -mt-4 space-y-3 pb-8">
          {/* Technologies */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tecnologias indicadas</p>
            <div className="flex flex-wrap gap-2">
              {resultado.tecnologias.map(t => (
                <span key={t} className="text-[12px] font-bold px-3 py-1.5 rounded-full border-2" style={{ borderColor: C_RED, color: C_DARK }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Why */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Por que essa recomendação?</p>
            <p className="text-sm text-slate-600 leading-relaxed">{resultado.justificativa}</p>
            {resultado.estrategia.upgrade   && <p className="text-xs font-bold mt-2" style={{ color: C_RED }}>🚀 Grande evolução no seu sono!</p>}
            {resultado.estrategia.migracao  && <p className="text-xs font-bold mt-2" style={{ color: C_RED }}>🔄 Migração para maior conforto e saúde.</p>}
            {resultado.estrategia.continuidade && <p className="text-xs font-bold mt-2" style={{ color: C_RED }}>✅ Vamos encontrar a versão ideal para você!</p>}
          </div>

          {/* Price calculator */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Calculadora: custo por noite</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold shrink-0">R$</span>
              <input
                type="number"
                placeholder="valor do colchão"
                value={precoCalc}
                onChange={e => setPrecoCalc(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#C41230] min-w-0"
              />
              {precoCalc && Number(precoCalc) > 0 && (
                <span className="text-xs font-black text-emerald-600 shrink-0 whitespace-nowrap">
                  R$ {(Number(precoCalc) / 3650).toFixed(2)}/noite
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">Base: 10 anos = 3.650 noites de vida útil Castor.</p>
          </div>

          {/* Products */}
          {produtosRec.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 shrink-0" style={{ color: C_RED }} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponíveis agora na Castor</p>
              </div>
              <div className="divide-y divide-slate-50">
                {produtosRec.map(p => {
                  const msg = encodeURIComponent(`Olá, ${waDestino.contato}! 👋 Pelo Mapa do Sono recebi a recomendação *${resultado?.estrutura === "MOLA" ? "Mola Ensacada" : "Espuma/Viscoelástico"}* e gostei do colchão *${p.nome}*. Pode me dar mais detalhes e melhores condições? 🛏️`);
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight truncate">{p.nome}</p>
                        {p.precoPix && <p className="text-xs text-emerald-600 font-bold mt-0.5">PIX {p.precoPix}</p>}
                      </div>
                      <a
                        href={`https://wa.me/${waDestino.numero}?text=${msg}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => trackWhatsAppClick("mapa_sono_produto", waDestino.loja)}
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-all shrink-0 active:scale-95"
                      >
                        <MessageCircle className="w-3 h-3" /> Quero esse
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2">
            {[{ icon: "🚚", label: "Entrega rápida" }, { icon: "📦", label: "Pronta entrega" }, { icon: "💳", label: "12x sem juros" }].map(g => (
              <div key={g.label} className="bg-emerald-50 border border-emerald-100 rounded-2xl px-2 py-3 text-center">
                <p className="text-xl mb-1">{g.icon}</p>
                <p className="text-[10px] font-bold text-emerald-700 leading-tight">{g.label}</p>
              </div>
            ))}
          </div>

          {/* Address */}
          <a
            href="https://maps.app.goo.gl/UuF6w1nAvTgXockS6"
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm hover:border-rose-200 transition-all group"
          >
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C_RED }} />
            <div>
              <p className="text-xs font-bold text-slate-800 group-hover:text-rose-700 transition-colors">Av. Júlia Kubitschek, 64</p>
              <p className="text-[10px] text-slate-400">Jardim Flamboyant · Cabo Frio — RJ</p>
              <p className="text-[10px] text-blue-500 font-semibold mt-0.5">Ver no Google Maps →</p>
            </div>
          </a>

          {/* CTAs */}
          <div className="space-y-2">
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackWhatsAppClick("mapa_sono_resultado", waDestino.loja)}
              className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-400 text-white font-extrabold px-5 py-4 rounded-2xl shadow-lg shadow-green-900/20 transition-all active:scale-95 text-[15px]"
            >
              <MessageCircle className="w-5 h-5" />
              Falar com {waDestino.contato} agora
            </a>
            <p className="text-center text-[10px] text-slate-400">Você já chega com seu perfil — atendimento imediato!</p>
            <button
              onClick={reiniciar}
              className="flex items-center justify-center gap-2 w-full bg-white text-slate-500 font-semibold border border-slate-200 px-5 py-3 rounded-2xl text-sm hover:bg-slate-50 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Refazer o mapa
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUIZ STEP ────────────────────────────────────────────────────────────────
  if (!currentStep) return null;

  return (
    <div className={cn("bg-white flex flex-col", embedded ? "min-h-full" : "min-h-screen")}>
      {/* Sticky header (hidden when embedded — modal provides its own) */}
      {!embedded && (
        <div
          className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 shrink-0"
          style={{ backgroundColor: C_DARK }}
        >
          <button onClick={voltar} className="text-white/60 hover:text-white p-1 -ml-1 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-white/80 text-[13px] font-bold">Mapa do Sono</p>
          <span className="text-white/60 text-[12px] font-bold tabular-nums">{stepIndex + 1}/{total}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-[3px] bg-slate-100 shrink-0">
        <motion.div
          className="h-full"
          style={{ backgroundColor: C_RED }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -36 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Question header */}
            <div className="px-5 pt-8 pb-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Etapa {stepIndex + 1} de {total}
              </p>
              <h2 className="text-[22px] font-black text-slate-900 leading-snug">
                {currentStep.pergunta}
              </h2>
              {currentStep.subtitulo && (
                <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">{currentStep.subtitulo}</p>
              )}
            </div>

            {/* Options / Slider */}
            <div className="border-t border-slate-100">
              {currentStep.tipo === "slider" && currentStep.slider ? (
                <SliderInput
                  cfg={currentStep.slider}
                  value={getSliderValue(currentStep.id, currentStep.slider)}
                  onChange={v => setSliderValues(prev => ({ ...prev, [currentStep.id]: v }))}
                />
              ) : currentStep.tipo === "multi" ? (
                currentStep.opcoes.map(op => (
                  <MultiOption
                    key={op.value}
                    opcao={op}
                    selected={multiSelect.includes(op.value)}
                    onToggle={() => toggleMulti(op.value)}
                  />
                ))
              ) : (
                currentStep.opcoes.map(op => (
                  <RadioOption
                    key={op.value}
                    opcao={op}
                    selected={pendingValue === op.value}
                    onSelect={() => handleSingleSelect(op.value)}
                  />
                ))
              )}
            </div>

            {validationError && (
              <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {validationError}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav — always visible for slider/multi; hidden for single (auto-advances) */}
      <div
        className={cn(
          "shrink-0 border-t border-slate-100 px-4 py-4 bg-white flex gap-3",
          !embedded && "sticky bottom-0",
          currentStep.tipo === "single" && "opacity-0 pointer-events-none select-none h-0 py-0 border-0"
        )}
      >
        <button
          onClick={voltar}
          className="flex items-center justify-center w-12 h-12 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <motion.button
          onClick={avancar}
          disabled={!canNext}
          whileTap={canNext ? { scale: 0.97 } : {}}
          className={cn(
            "flex-1 h-12 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all",
            canNext ? "text-white shadow-md" : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
          style={canNext ? { backgroundColor: C_RED } : undefined}
        >
          {stepIndex + 1 === total ? "Ver resultado" : "Próximo"}
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}
