import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CheckCircle2, MessageCircle, RotateCcw,
  Package, User, BedDouble, Activity, Thermometer, Users, Layers,
  Scale, Ruler, Calendar, Wind, Clock, History, MapPin, Moon, ShoppingCart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trackMapaSonoCompleto, trackWhatsAppClick, trackPageView } from "@/lib/tracking";

const WA_CABO_FRIO = { numero: "5522992410112", contato: "ThallesZzz", loja: "Cabo Frio" };
const WA_ARARUAMA  = { numero: "5522988447240", contato: "Marcela",    loja: "Araruama" };
const CIDADES_ARARUAMA = ["araruama", "saquarema", "iguaba grande", "maricá", "silva jardim"];

interface ProdutoCatalogo {
  id: number;
  nome: string;
  categoria: string;
  precoPix?: string | null;
  precoPrazo?: string | null;
  descricao?: string | null;
}

// ─── TYPES ──────────────────────────────────────────────────────────────────

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

interface Opcao {
  label: string;
  value: string;
  desc?: string;
}

interface Step {
  id: keyof UserProfile;
  pergunta: string;
  subtitulo: string;
  icon: React.ElementType;
  tipo: "single" | "multi";
  opcoes: Opcao[];
}

// ─── ETAPAS ──────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "finalidade", icon: Package,
    pergunta: "Para qual uso é o colchão?",
    subtitulo: "Selecione a opção que melhor descreve sua necessidade.",
    tipo: "single",
    opcoes: [
      { label: "Uso diário",        desc: "Casa principal — dormida todos os dias",   value: "diario"    },
      { label: "Casa de praia",      desc: "Temporada ou fim de semana",               value: "praia"     },
      { label: "Uso ocasional",      desc: "Quarto de hóspedes ou extra",             value: "ocasional" },
    ],
  },
  {
    id: "biotipo", icon: User,
    pergunta: "Qual é o seu biotipo?",
    subtitulo: "Isso determina o suporte correto para o seu corpo.",
    tipo: "single",
    opcoes: [
      { label: "Leve",    desc: "Até 60 kg",        value: "leve"   },
      { label: "Médio",   desc: "Entre 60 e 90 kg", value: "medio"  },
      { label: "Pesado",  desc: "Acima de 90 kg",   value: "pesado" },
    ],
  },
  {
    id: "posicao", icon: BedDouble,
    pergunta: "Como você costuma dormir?",
    subtitulo: "A posição influencia diretamente na firmeza ideal.",
    tipo: "single",
    opcoes: [
      { label: "De lado",                      desc: "Posição fetal ou semi-fetal", value: "lado"    },
      { label: "De barriga para cima",          desc: "Posição supina / costas",    value: "costas"  },
      { label: "De bruços",                     desc: "Barriga voltada para baixo", value: "brucos"  },
      { label: "Mudo muito durante a noite",    desc: "Posição varia ao longo da noite", value: "variado" },
    ],
  },
  {
    id: "dores", icon: Activity,
    pergunta: "Você sente dores ao acordar?",
    subtitulo: "Pode marcar mais de uma opção.",
    tipo: "multi",
    opcoes: [
      { label: "Não sinto dores",           value: "nenhuma" },
      { label: "Costas / Coluna",           desc: "Lombar ou torácica", value: "coluna"  },
      { label: "Quadril",                   desc: "Lateral ou glúteos", value: "quadril" },
      { label: "Ombros / Pescoço",          desc: "Cervical e membros superiores", value: "ombros"  },
      { label: "Pressão nos pontos de contato", desc: "Formigamento ou dormência", value: "pressao" },
    ],
  },
  {
    id: "temperatura", icon: Thermometer,
    pergunta: "Como você se sente durante a noite?",
    subtitulo: "A regulação térmica interfere na qualidade do sono.",
    tipo: "single",
    opcoes: [
      { label: "Esquento muito",    desc: "Sudo fácil ou acordo com calor", value: "quente" },
      { label: "Temperatura normal",desc: "Não tenho problema com temperatura", value: "normal" },
      { label: "Tenho frio",        desc: "Preciso de cobertor mesmo no verão", value: "frio"   },
    ],
  },
  {
    id: "casal", icon: Users,
    pergunta: "Você vai dormir sozinho ou acompanhado?",
    subtitulo: "Isso define se a transferência de movimento é um fator.",
    tipo: "single",
    opcoes: [
      { label: "Sozinho(a)",                desc: "Cama só para mim",                         value: "sozinho"         },
      { label: "Casal — pesos similares",   desc: "Diferença menor que 20 kg entre os dois",  value: "casal_similar"   },
      { label: "Casal — pesos diferentes",  desc: "Diferença maior que 20 kg",                value: "casal_diferente" },
      { label: "Com filho(s) pequeno(s)",   desc: "Criança dorme na mesma cama às vezes",     value: "familia"         },
    ],
  },
  {
    id: "firmeza", icon: Layers,
    pergunta: "Qual firmeza você prefere?",
    subtitulo: "Considere seu conforto subjetivo, não só a saúde.",
    tipo: "single",
    opcoes: [
      { label: "Muito firme",  desc: "Gosto de sentir resistência ao deitar",        value: "muito_firme" },
      { label: "Firme",        desc: "Suporte bom sem ser duro",                     value: "firme"       },
      { label: "Médio",        desc: "Equilíbrio entre firmeza e conforto",          value: "medio"       },
      { label: "Macio",        desc: "Afundo um pouco — gosto de ser abraçado",      value: "macio"       },
    ],
  },
  {
    id: "peso", icon: Scale,
    pergunta: "Qual é o seu peso aproximado?",
    subtitulo: "Para calcular a densidade correta do colchão.",
    tipo: "single",
    opcoes: [
      { label: "Até 50 kg",     value: "ate50"    },
      { label: "50 a 70 kg",    value: "50a70"    },
      { label: "70 a 90 kg",    value: "70a90"    },
      { label: "90 a 110 kg",   value: "90a110"   },
      { label: "Acima de 110 kg", value: "acima110" },
    ],
  },
  {
    id: "altura", icon: Ruler,
    pergunta: "Qual é a sua altura?",
    subtitulo: "Determina o tamanho ideal do colchão.",
    tipo: "single",
    opcoes: [
      { label: "Até 1,60 m",        value: "ate160"    },
      { label: "1,60 m a 1,75 m",   value: "160a175"   },
      { label: "1,75 m a 1,90 m",   value: "175a190"   },
      { label: "Acima de 1,90 m",   value: "acima190"  },
    ],
  },
  {
    id: "idade", icon: Calendar,
    pergunta: "Qual é a sua faixa de idade?",
    subtitulo: "Necessidades de suporte articular variam com a idade.",
    tipo: "single",
    opcoes: [
      { label: "Até 18 anos",     desc: "Jovem em crescimento",                 value: "menor18" },
      { label: "18 a 35 anos",    desc: "Adulto jovem — ativo",                 value: "18a35"   },
      { label: "35 a 55 anos",    desc: "Adulto — foco em recuperação",         value: "35a55"   },
      { label: "Acima de 55 anos",desc: "Maior atenção ao conforto articular", value: "acima55" },
    ],
  },
  {
    id: "alergia", icon: Wind,
    pergunta: "Você tem alguma sensibilidade ou alergia?",
    subtitulo: "Fundamental para indicar o tecido e tratamento certo.",
    tipo: "single",
    opcoes: [
      { label: "Não tenho alergias",   value: "nenhuma" },
      { label: "Rinite ou Asma",       desc: "Sensibilidade a pó ou ácaro", value: "rinite"  },
      { label: "Pele sensível",        desc: "Reação a tecidos ou materiais", value: "pele"    },
      { label: "Não sei ao certo",     value: "nao_sei" },
    ],
  },
  {
    id: "durabilidade", icon: Clock,
    pergunta: "Por quanto tempo quer que dure?",
    subtitulo: "Isso define a densidade e a estrutura mais indicadas.",
    tipo: "single",
    opcoes: [
      { label: "Curto prazo",   desc: "1 a 3 anos de uso",    value: "curto" },
      { label: "Médio prazo",   desc: "3 a 7 anos de uso",    value: "medio" },
      { label: "Longo prazo",   desc: "7 a 10+ anos de uso",  value: "longo" },
    ],
  },
  {
    id: "historico", icon: History,
    pergunta: "Qual é o seu colchão atual ou anterior?",
    subtitulo: "Saber de onde você vem ajuda a calibrar a transição.",
    tipo: "single",
    opcoes: [
      { label: "Colchão de mola",              value: "mola"    },
      { label: "Espuma ou viscoelástico",      value: "espuma"  },
      { label: "Cama de madeira / estrado",    value: "madeira" },
      { label: "Nunca tive colchão de qualidade", value: "nenhum" },
    ],
  },
];


const STEP_OPTION_SET: Record<keyof UserProfile, Set<string>> = STEPS.reduce((acc, step) => {
  acc[step.id] = new Set(step.opcoes.map((o) => o.value));
  return acc;
}, {} as Record<keyof UserProfile, Set<string>>);

const BIOTIPO_PESO_COMPATIVEL: Record<NonNullable<UserProfile["biotipo"]>, ReadonlySet<string>> = {
  leve: new Set(["ate50", "50a70"]),
  medio: new Set(["50a70", "70a90"]),
  pesado: new Set(["90a110", "acima110"]),
};

function validarPerfil(p: UserProfile): string | null {
  for (const step of STEPS) {
    const valor = p[step.id];
    if (step.tipo === "multi") {
      if (!Array.isArray(valor) || valor.length === 0) return `Responda: ${step.pergunta}`;
      if (valor.some((v) => !STEP_OPTION_SET[step.id].has(v))) return `Resposta inválida em: ${step.pergunta}`;
    } else {
      if (typeof valor !== "string" || !STEP_OPTION_SET[step.id].has(valor)) return `Resposta inválida em: ${step.pergunta}`;
    }
  }

  const peso = p.peso;
  const biotipo = p.biotipo as keyof typeof BIOTIPO_PESO_COMPATIVEL;
  if (!BIOTIPO_PESO_COMPATIVEL[biotipo].has(peso ?? "")) {
    return "Seu biotipo está incompatível com a faixa de peso informada.";
  }
  const biotipo = p.biotipo;
  const pesoLeve = peso === "ate50" || peso === "50a70";
  const pesoMedio = peso === "70a90";
  const pesoPesado = peso === "90a110" || peso === "acima110";

  if (biotipo === "leve" && !pesoLeve) return "Seu biotipo está incompatível com a faixa de peso informada.";
  if (biotipo === "medio" && !(pesoLeve || pesoMedio)) return "Seu biotipo está incompatível com a faixa de peso informada.";
  if (biotipo === "pesado" && !pesoPesado) return "Seu biotipo está incompatível com a faixa de peso informada.";

  return null;
}

// ─── MOTOR DE DECISÃO ─────────────────────────────────────────────────────────

function calcularResultado(p: UserProfile): Resultado {
  let scoreMola = 0;
  let scoreEspuma = 0;

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

  let estrategia = { continuidade: false, migracao: false, upgrade: false };
  if (p.historico === "mola")   { scoreMola   += 2; estrategia.continuidade = true; }
  if (p.historico === "espuma") { scoreEspuma += 1; estrategia.continuidade = true; }
  if (p.historico === "madeira"){ scoreEspuma += 3; estrategia.migracao     = true; }
  if (p.historico === "nenhum") { scoreMola   += 1; estrategia.upgrade      = true; }

  const estrutura: "MOLA" | "ESPUMA" = scoreMola >= scoreEspuma ? "MOLA" : "ESPUMA";

  let firmeza = "Médio";
  if (p.firmeza === "muito_firme") firmeza = "Extra Firme";
  else if (p.firmeza === "firme")  firmeza = "Firme";
  else if (p.firmeza === "macio")  firmeza = "Macio";

  const finalidadeLabel: Record<string, string> = {
    diario: "uso diário", praia: "casa de praia", ocasional: "uso ocasional",
  };
  const perfil = `${p.biotipo === "pesado" ? "Pessoa pesada" : p.biotipo === "medio" ? "Biotipo médio" : "Pessoa leve"}, ${finalidadeLabel[p.finalidade ?? ""] ?? ""}`;

  const justificativas: string[] = [];
  const tecnologias: string[] = [];

  if (estrutura === "MOLA") {
    if (p.temperatura === "quente")       { justificativas.push("a ventilação natural das molas mantém o corpo na temperatura ideal de 18–22°C para sono REM (Stanford Sleep Center)"); tecnologias.push("Fresh Comfort Gel®"); }
    if (p.biotipo === "pesado")           { justificativas.push("as molas Tecnopedic® de aço temperado eletronicamente garantem suporte real para seu biotipo, sem afundamento precoce (INER)"); tecnologias.push("Molas Tecnopedic®"); }
    if (p.casal?.includes("casal"))       { justificativas.push("o sistema Pocket® pré-comprimido elimina a transferência de movimento — se um se mexe, o outro não sente"); tecnologias.push("Pocket® Autêntico"); }
    if (p.durabilidade === "longo")       { justificativas.push("o sistema Double Face permite girar o colchão, aumentando a vida útil em até 50% — projetado para 10+ anos"); tecnologias.push("Double Face"); }
    if (!tecnologias.includes("Pocket® Autêntico")) tecnologias.push("Pocket® Autêntico");
  } else {
    if (dores.length > 0 && !dores.includes("nenhuma")) { justificativas.push("firmeza média comprovada como superior para dores lombares e de quadril em estudo publicado pela The Lancet"); tecnologias.push("Selo Pró-Espuma INER"); }
    if (p.alergia === "rinite" || p.alergia === "pele") { justificativas.push("o tratamento Actigard® elimina permanentemente ácaros, fungos e bactérias do tecido — essencial para saúde respiratória"); tecnologias.push("Actigard® Anti-ácaros"); }
    if (p.posicao === "lado" || p.posicao === "brucos") { justificativas.push("o Pillow Top / Euro Pillow reduz pontos de pressão em ombros e quadris, diminuindo o giro na cama em até 80%"); tecnologias.push("Pillow Top"); }
    if (p.idade === "acima55")            { justificativas.push("conforto articular certificado pelo INER com densidade real garantida — D33 a D45 sem carga mineral"); tecnologias.push("Densidade Real INER"); }
    if (p.temperatura === "quente")       { justificativas.push("espuma com células abertas + partículas de gel dissipam o calor corporal durante o sono"); tecnologias.push("Fresh Comfort Gel®"); }
    if (tecnologias.length === 0) tecnologias.push("Selo Pró-Espuma INER");
  }

  const justificativa = justificativas.length > 0
    ? justificativas.slice(0, 2).join("; ") + "."
    : "perfil equilibrado com boa relação custo-benefício certificada pelo INER.";

  const total = scoreMola + scoreEspuma;
  const dominant = Math.max(scoreMola, scoreEspuma);
  const rawConfianca = total === 0 ? 0.75 : dominant / total;
  const confianca = Math.round(70 + rawConfianca * 29);

  return { estrutura, firmeza, perfil, justificativa, confianca, tecnologias, estrategia };
}

function gerarMensagemWA(p: UserProfile, r: Resultado, contato: string): string {
  const labels: Record<string, Record<string, string>> = {
    finalidade: { diario: "Uso diário", praia: "Casa de praia", ocasional: "Uso ocasional" },
    biotipo:    { leve: "Leve (até 60kg)", medio: "Médio (60–90kg)", pesado: "Pesado (+90kg)" },
    posicao:    { lado: "De lado", costas: "De costas", brucos: "De bruços", variado: "Varia" },
    temperatura:{ quente: "Esquento muito", normal: "Normal", frio: "Tenho frio" },
    casal:      { sozinho: "Sozinho(a)", casal_similar: "Casal (pesos similares)", casal_diferente: "Casal (pesos diferentes)", familia: "Com filhos" },
    firmeza:    { muito_firme: "Muito firme", firme: "Firme", medio: "Médio", macio: "Macio" },
    alergia:    { nenhuma: "Nenhuma", rinite: "Rinite/Asma", pele: "Pele sensível", nao_sei: "Não sei" },
    durabilidade:{ curto: "1–3 anos", medio: "3–7 anos", longo: "7–10+ anos" },
    historico:  { mola: "Mola", espuma: "Espuma", madeira: "Madeira/estrado", nenhum: "Não tive" },
  };
  const get = (key: keyof UserProfile, val?: string) => val ? (labels[key]?.[val] ?? val) : "—";
  const doresLabel = Array.isArray(p.dores) && !p.dores.includes("nenhuma")
    ? p.dores.map(d => ({ coluna: "Costas/coluna", quadril: "Quadril", ombros: "Ombros/pescoço", pressao: "Pressão" }[d] ?? d)).join(", ")
    : "Nenhuma";
  return `Olá, ${contato}! 👋 Acabei de preencher o *Mapa do Sono* e quero minha recomendação personalizada!\n\n📋 *Meu perfil completo:*\n• Finalidade: ${get("finalidade", p.finalidade)}\n• Biotipo: ${get("biotipo", p.biotipo)}\n• Posição ao dormir: ${get("posicao", p.posicao)}\n• Dores: ${doresLabel}\n• Temperatura: ${get("temperatura", p.temperatura)}\n• Uso: ${get("casal", p.casal)}\n• Firmeza preferida: ${get("firmeza", p.firmeza)}\n• Peso: ${p.peso ?? "—"} / Altura: ${p.altura ?? "—"}\n• Idade: ${p.idade ?? "—"}\n• Alergia: ${get("alergia", p.alergia)}\n• Durabilidade esperada: ${get("durabilidade", p.durabilidade)}\n• Histórico: ${get("historico", p.historico)}\n\n🎯 *Resultado do Mapa do Sono:*\nEstrutura recomendada: *${r.estrutura === "MOLA" ? "Mola Ensacada" : "Espuma / Viscoelástico"}*\nFirmeza ideal: *${r.firmeza}*\n\nQuero ver as opções disponíveis e saber o melhor preço! 🛏️\n\n💊 *Compatibilidade com meu perfil:* ${r.confianca}%\n🔧 *Tecnologias indicadas:* ${r.tecnologias.join(" · ")}\n\nTambém tenho interesse no *kit completo* (protetor de colchão + travesseiro)! 😊`;
}

// ─── OPTION CARD ─────────────────────────────────────────────────────────────

function OpcaoCard({ opcao, selected, onClick }: {
  opcao: Opcao;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all flex items-start justify-between gap-3",
        selected
          ? "border-red-500 bg-red-50"
          : "border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/30"
      )}
    >
      <div>
        <p className={cn("font-bold text-sm leading-tight", selected ? "text-red-700" : "text-slate-800")}>
          {opcao.label}
        </p>
        {opcao.desc && (
          <p className={cn("text-xs mt-0.5 leading-snug", selected ? "text-red-500" : "text-slate-400")}>
            {opcao.desc}
          </p>
        )}
      </div>
      {selected && <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
    </motion.button>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function MapaSono() {
  const [stepIndex, setStepIndex] = useState(-1);
  const [profile, setProfile]     = useState<UserProfile>({});

  useEffect(() => { trackPageView("mapa_sono"); }, []);
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [resultado, setResultado]   = useState<Resultado | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [precoCalc, setPrecoCalc]   = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [produtosRec, setProdutosRec] = useState<ProdutoCatalogo[]>([]);
  const [waDestino, setWaDestino] = useState(WA_CABO_FRIO);
  const [autoDetected, setAutoDetected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentStep = stepIndex >= 0 && stepIndex < STEPS.length ? STEPS[stepIndex] : null;
  const total       = STEPS.length;
  const pct         = stepIndex < 0 ? 0 : Math.round(((stepIndex) / total) * 100);

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then(r => r.json())
      .then((data: { city?: string }) => {
        const cidade = (data.city ?? "").toLowerCase();
        if (CIDADES_ARARUAMA.some(c => cidade.includes(c))) {
          setWaDestino(WA_ARARUAMA);
        }
        setAutoDetected(true);
      })
      .catch(() => { setAutoDetected(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [stepIndex, showResult]);

  useEffect(() => {
    if (!showResult || !resultado) return;
    fetch("/api/produtos")
      .then(r => r.ok ? r.json() : [])
      .then((produtos: ProdutoCatalogo[]) => {
        const estrutura = resultado.estrutura;
        const keywords = estrutura === "MOLA"
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
  }, [showResult, resultado]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function avancar() {
    if (!currentStep) return;

    const newProfile = { ...profile };
    setValidationError(null);
    if (currentStep.tipo === "multi") {
      if (multiSelect.length === 0) return;
      (newProfile as any)[currentStep.id] = multiSelect;
    } else {
      if (!pendingValue) return;
      (newProfile as any)[currentStep.id] = pendingValue;
    }
    setProfile(newProfile);
    setPendingValue(null);
    setMultiSelect([]);

    if (stepIndex + 1 >= total) {
      const profileError = validarPerfil(newProfile);
      if (profileError) {
        setValidationError(profileError);
        return;
      }
      const res = calcularResultado(newProfile);
      setResultado(res);
      setShowResult(true);
      trackMapaSonoCompleto(res.estrutura, res.firmeza, res.confianca);
    } else {
      setStepIndex(i => i + 1);
    }
  }

  function voltar() {
    if (stepIndex <= 0) {
      setStepIndex(-1);
    } else {
      const prev = STEPS[stepIndex - 1];
      const prevVal = (profile as any)[prev.id];
      if (prev.tipo === "multi") {
        setMultiSelect(Array.isArray(prevVal) ? prevVal : []);
        setPendingValue(null);
      } else {
        setPendingValue(typeof prevVal === "string" ? prevVal : null);
        setMultiSelect([]);
      }
      setStepIndex(i => i - 1);
    }
  }

  function toggleMulti(val: string) {
    if (val === "nenhuma") { setMultiSelect(["nenhuma"]); return; }
    setMultiSelect(prev => {
      const without = prev.filter(v => v !== "nenhuma");
      return without.includes(val) ? without.filter(v => v !== val) : [...without, val];
    });
  }

  function reiniciar() {
    setStepIndex(-1);
    setProfile({});
    setMultiSelect([]);
    setPendingValue(null);
    setResultado(null);
    setShowResult(false);
    setPrecoCalc("");
    setValidationError(null);
  }

  const canNext = currentStep
    ? currentStep.tipo === "multi" ? multiSelect.length > 0 : !!pendingValue
    : false;

  // ── Restore pending value when landing on a step that has a saved answer
  useEffect(() => {
    if (!currentStep) return;
    const saved = (profile as any)[currentStep.id];
    if (currentStep.tipo === "multi") {
      setMultiSelect(Array.isArray(saved) ? saved : []);
      setPendingValue(null);
    } else {
      setPendingValue(typeof saved === "string" ? saved : null);
      setMultiSelect([]);
    }
  }, [stepIndex]);

  // ── WELCOME ─────────────────────────────────────────────────────────────────

  if (stepIndex === -1 && !showResult) {
    return (
      <div ref={scrollRef} className="bg-[#EDEBE8] min-h-full p-4 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[380px] bg-white rounded-3xl shadow-sm overflow-hidden"
        >
          {/* Hero topo */}
          <div className="bg-gradient-to-br from-red-700 to-red-900 px-6 py-8 text-white text-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 border-2 border-white/20 shadow-lg">
              <img src="/thalles-avatar.jpg" alt="Especialista" className="w-full h-full object-cover object-top" />
            </div>
            <p className="text-red-200 text-xs font-bold uppercase tracking-wider mb-1">Exclusivo · Castor {waDestino.loja}</p>
            <h2 className="text-2xl font-black leading-tight mb-2">Mapa do Sono</h2>
            <p className="text-red-100 text-sm leading-relaxed">
              Diagnóstico personalizado com {waDestino.contato}
            </p>
            {autoDetected && (
              <button
                onClick={() => setWaDestino(prev => prev.numero === WA_CABO_FRIO.numero ? WA_ARARUAMA : WA_CABO_FRIO)}
                className="mt-2 inline-flex items-center gap-1 text-red-200 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-all"
              >
                <MapPin className="w-3 h-3" />
                Trocar para {waDestino.numero === WA_CABO_FRIO.numero ? "Araruama" : "Cabo Frio"}
              </button>
            )}
          </div>

          {/* Corpo */}
          <div className="px-5 py-5 space-y-3">
            {[
              { icon: "🎯", texto: `${total} perguntas rápidas — só cliques` },
              { icon: "🧠", texto: "Motor de decisão baseado em pesquisas científicas" },
              { icon: "📲", texto: "Resultado completo direto no WhatsApp" },
            ].map(i => (
              <div key={i.icon} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <span className="text-xl shrink-0">{i.icon}</span>
                <p className="text-sm text-slate-700 font-semibold">{i.texto}</p>
              </div>
            ))}

            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setStepIndex(0)}
              animate={{
                boxShadow: ["0 4px 16px rgba(220,38,38,0.3)", "0 4px 28px rgba(220,38,38,0.55)", "0 4px 16px rgba(220,38,38,0.3)"],
              }}
              transition={{ boxShadow: { duration: 1.8, repeat: Infinity, repeatDelay: 1.5 } }}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-extrabold px-6 py-4 rounded-2xl text-base mt-2"
            >
              <Moon className="w-5 h-5" />
              Começar meu diagnóstico
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── RESULTADO ───────────────────────────────────────────────────────────────

  if (showResult && resultado) {
    const wa = `https://wa.me/${waDestino.numero}?text=${encodeURIComponent(gerarMensagemWA(profile, resultado, waDestino.contato))}`;
    return (
      <div ref={scrollRef} className="bg-[#EDEBE8] min-h-full p-4">
        <div className="w-full max-w-[380px] mx-auto space-y-3">

          {/* Barra de progresso */}
          <div className="px-1">
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-500">Diagnóstico concluído</span>
              <span className="text-red-600">100% ✓</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full w-full" />
            </div>
          </div>

          {/* Card resultado */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-red-600 to-red-900 rounded-3xl p-5 text-white shadow-xl"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Estrutura recomendada</p>
            <p className="text-2xl font-black tracking-tight mb-0.5">
              {resultado.estrutura === "MOLA" ? "🌀 Mola Ensacada" : "🧽 Espuma / Viscoelástico"}
            </p>
            <p className="text-sm font-bold opacity-90 mb-3">Firmeza: {resultado.firmeza}</p>

            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold opacity-70">Compatibilidade com seu perfil</p>
              <p className="text-2xl font-black">{resultado.confianca}%</p>
            </div>
            <div className="w-full h-1.5 bg-white/20 rounded-full mb-3">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${resultado.confianca}%` }}
                transition={{ delay: 0.4, duration: 0.8 }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {resultado.tecnologias.map(t => (
                <span key={t} className="bg-white/15 text-white text-[10px] font-bold px-2 py-1 rounded-full border border-white/20">{t}</span>
              ))}
            </div>

            <div className="border-t border-white/20 pt-3">
              <p className="text-xs opacity-80 leading-relaxed">
                <strong>Por quê?</strong> {resultado.justificativa}
              </p>
            </div>

            {resultado.estrategia.upgrade && (
              <div className="mt-2 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold">🚀 Essa será uma grande evolução no seu sono!</div>
            )}
            {resultado.estrategia.migracao && (
              <div className="mt-2 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold">🔄 Migração para maior conforto e saúde.</div>
            )}
            {resultado.estrategia.continuidade && (
              <div className="mt-2 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold">✅ Vamos encontrar a versão ideal para você!</div>
            )}
          </motion.div>

          {/* Calculadora */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl px-4 py-4 border border-slate-100 shadow-sm"
          >
            <p className="text-xs font-extrabold text-slate-700 mb-2">💡 Calculadora: quanto custa por noite?</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold shrink-0">R$</span>
              <input
                type="number"
                placeholder="valor do colchão"
                value={precoCalc}
                onChange={e => setPrecoCalc(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-400 min-w-0"
              />
              {precoCalc && Number(precoCalc) > 0 && (
                <span className="text-xs font-extrabold text-emerald-600 shrink-0">
                  = R$ {(Number(precoCalc) / 3650).toFixed(2)}/noite
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">Base: 10 anos de vida útil (3.650 noites) — durabilidade Castor.</p>
          </motion.div>

          {/* Produtos recomendados */}
          {produtosRec.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="px-4 pt-4 pb-2 border-b border-slate-100">
                <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-red-500" />
                  Colchões que combinam com você
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Disponíveis agora na Castor • Pronta entrega</p>
              </div>
              <div className="divide-y divide-slate-50">
                {produtosRec.map(p => {
                  const msgProduto = encodeURIComponent(
                    `Olá, ${waDestino.contato}! 👋 Pelo Mapa do Sono recebi a recomendação *${resultado?.estrutura === "MOLA" ? "Mola Ensacada" : "Espuma/Viscoelástico"}* e gostei do colchão *${p.nome}*. Pode me dar mais detalhes e melhores condições? 🛏️`
                  );
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight truncate">{p.nome}</p>
                        {p.precoPix && (
                          <p className="text-xs text-emerald-600 font-bold mt-0.5">PIX {p.precoPix}</p>
                        )}
                        {p.precoPrazo && !p.precoPix && (
                          <p className="text-xs text-blue-600 font-bold mt-0.5">{p.precoPrazo}</p>
                        )}
                      </div>
                      <a
                        href={`https://wa.me/${waDestino.numero}?text=${msgProduto}`}
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
            </motion.div>
          )}

          {/* Gatilhos */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-2"
          >
            {[
              { icon: "🚚", label: "Entrega rápida" },
              { icon: "📦", label: "Pronta entrega" },
              { icon: "💳", label: "12x sem juros" },
            ].map(g => (
              <div key={g.label} className="bg-emerald-50 border border-emerald-100 rounded-2xl px-2 py-3 text-center">
                <p className="text-xl mb-1">{g.icon}</p>
                <p className="text-[10px] font-bold text-emerald-700 leading-tight">{g.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Endereço */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <a
              href="https://maps.app.goo.gl/UuF6w1nAvTgXockS6"
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm hover:border-red-300 transition-all group"
            >
              <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800 group-hover:text-red-600 transition-colors">Av. Júlia Kubitschek, 64</p>
                <p className="text-[10px] text-slate-400">Jardim Flamboyant · Cabo Frio — RJ</p>
                <p className="text-[10px] text-blue-500 font-semibold mt-0.5">Ver no Google Maps →</p>
              </div>
            </a>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-2 pb-4"
          >
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackWhatsAppClick("mapa_sono_resultado", waDestino.loja)}
              className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-400 text-white font-extrabold px-5 py-4 rounded-2xl shadow-lg transition-all active:scale-95 text-base"
            >
              <MessageCircle className="w-5 h-5" />
              Falar com {waDestino.contato} agora
            </a>
            <p className="text-center text-[10px] text-slate-400">Você já chega com seu perfil completo — atendimento instantâneo!</p>
            <button
              onClick={reiniciar}
              className="flex items-center justify-center gap-2 w-full bg-white text-slate-500 font-semibold border border-slate-200 px-5 py-3 rounded-2xl text-sm hover:bg-slate-50 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Refazer o mapa
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── ETAPA ────────────────────────────────────────────────────────────────────

  if (!currentStep) return <div className="min-h-full flex items-center justify-center p-8 text-slate-500">Carregando...</div>;
  const IconStep = currentStep.icon;

  return (
    <div ref={scrollRef} className="bg-[#EDEBE8] min-h-full p-4 flex flex-col">
      <div className="w-full max-w-[380px] mx-auto flex flex-col flex-1 gap-3">

        {/* Progresso */}
        <div>
          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
            <span className="text-slate-500">Etapa {stepIndex + 1} de {total}</span>
            <span className="text-red-600">{pct}% concluído</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-500 rounded-full"
              initial={{ width: `${Math.round((stepIndex / total) * 100)}%` }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Card da questão */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-3xl shadow-sm overflow-hidden"
          >
            {/* Ícone + pergunta */}
            <div className="px-5 pt-6 pb-4 text-center border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <IconStep className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900 leading-tight mb-2">
                {currentStep.pergunta}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">{currentStep.subtitulo}</p>
            </div>

            {validationError && (
              <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {validationError}
              </div>
            )}

            {/* Opções */}
            <div className="px-4 py-4 space-y-2">
              {(Array.isArray(currentStep.opcoes) ? currentStep.opcoes : []).map(op => {
                const isSelected = currentStep.tipo === "multi"
                  ? multiSelect.includes(op.value)
                  : pendingValue === op.value;
                return (
                  <OpcaoCard
                    key={op.value}
                    opcao={op}
                    selected={isSelected}
                    onClick={() => {
                      if (currentStep.tipo === "multi") {
                        toggleMulti(op.value);
                      } else {
                        setPendingValue(op.value);
                      }
                    }}
                  />
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navegação */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={voltar}
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
          <motion.button
            onClick={avancar}
            disabled={!canNext}
            whileTap={canNext ? { scale: 0.97 } : {}}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm transition-all",
              canNext
                ? "bg-red-600 text-white hover:bg-red-500 active:scale-95 shadow-md shadow-red-200"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            {stepIndex + 1 === total ? "Ver resultado" : "Próximo"}
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
