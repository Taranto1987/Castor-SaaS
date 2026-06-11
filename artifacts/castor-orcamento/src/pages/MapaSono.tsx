import { useEffect, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Scale, BedDouble, Activity, Thermometer,
  RefreshCw, Star, ChevronLeft, ChevronRight,
  MessageCircle, User, Check, Zap, Heart,
  Package, Layers, Phone, Moon,
} from "lucide-react";
import { trackWhatsAppClick } from "@/lib/tracking";
import { useLoja } from "@/contexts/LojaContext";

export interface MapaSonoProps { embedded?: boolean; }

// ── Design tokens (identidade visual intocada) ─────────────────────────────────
const BG     = "#0c0c0c";
const CARD   = "#140000";
const BORDER = "#2a0808";
const RED    = "#C41230";

const WA_NUMERO = "5522992410112";

// ── Domínio ─────────────────────────────────────────────────────────────────────
type Incomodo = "dor" | "calor" | "afundando" | "sono_ruim" | "conforto";
type Ocupacao = "sozinho" | "casal";
type Posicao  = "lado" | "costas" | "brucos" | "varia";
type Dor      = "lombar" | "cervical" | "ombro" | "quadril";
type Tamanho  = "solteiro" | "casal" | "queen" | "king";
type Conjunto = "colchao" | "box_colchao" | "box_bau_colchao";

interface PerfilRespostas {
  incomodo?: Incomodo;
  ocupacao?: Ocupacao;
  pesoA: number;
  pesoB: number;
  posicao?: Posicao;
  dores: Dor[];
  calor?: boolean;
}

type Categoria = "principal" | "premium" | "mais_macia" | "mais_firme" | "custo_beneficio";

interface RankingItem {
  produtoId: string;
  nome: string;
  score: number;
  classificacao: string;
  categoria: Categoria;
  motivos: string[];
  precoPix: string | null;
  imagem: string | null;
  size: string | null;
}

interface ResultadoCompatibilidade {
  ranking: RankingItem[];
  firmezaIndicada: string;
  perfilResumo: string;
}

// ── State machine ───────────────────────────────────────────────────────────────
type Fase  = "A_diagnostico" | "B_resultado" | "C_conversao" | "finalizado";
type StepA = "incomodo" | "ocupacao" | "peso" | "posicao" | "dores" | "calor";
type StepC = "tamanho" | "conjunto" | "lead";

const ORDEM_A: StepA[] = ["incomodo", "ocupacao", "peso", "posicao", "dores", "calor"];
const ORDEM_C: StepC[] = ["tamanho", "conjunto", "lead"];

interface State {
  fase: Fase;
  stepA: StepA;
  stepC: StepC;
  perfil: PerfilRespostas;
  resultado: ResultadoCompatibilidade | null;
  resultadoCarregando: boolean;
  tamanho: Tamanho | null;
  conjunto: Conjunto | null;
}

type Acao =
  | { type: "RESPONDER_A"; step: StepA; perfil: PerfilRespostas }
  | { type: "VOLTAR" }
  | { type: "RESULTADO_OK"; resultado: ResultadoCompatibilidade }
  | { type: "RESULTADO_ERRO" }
  | { type: "CONFIGURAR" }
  | { type: "ESCOLHER_TAMANHO"; tamanho: Tamanho }
  | { type: "ESCOLHER_CONJUNTO"; conjunto: Conjunto }
  | { type: "FINALIZAR" }
  | { type: "REINICIAR" };

const ESTADO_INICIAL: State = {
  fase: "A_diagnostico",
  stepA: "incomodo",
  stepC: "tamanho",
  perfil: { pesoA: 75, pesoB: 65, dores: [] },
  resultado: null,
  resultadoCarregando: false,
  tamanho: null,
  conjunto: null,
};

// Transições válidas — ÚNICAS permitidas:
// A: incomodo→ocupacao→peso→posicao→dores→calor→[gera resultado]→B
// B: ranking → CTA "Configurar minha escolha" → C
// C: tamanho→conjunto→lead→[POST lead]→[abre WhatsApp]→finalizado
// Voltar: dentro de A e dentro de C; de C não volta para A.
function reducer(state: State, acao: Acao): State {
  switch (acao.type) {
    case "RESPONDER_A": {
      if (state.fase !== "A_diagnostico" || acao.step !== state.stepA) return state;
      const idx = ORDEM_A.indexOf(state.stepA);
      if (state.stepA === "calor") {
        // Última etapa A → gera resultado SÍNCRONO do ponto de vista do usuário
        return { ...state, perfil: acao.perfil, fase: "B_resultado", resultadoCarregando: true };
      }
      const proximo = ORDEM_A[idx + 1];
      if (!proximo) return state;
      return { ...state, perfil: acao.perfil, stepA: proximo };
    }
    case "VOLTAR": {
      if (state.fase === "A_diagnostico") {
        const idx = ORDEM_A.indexOf(state.stepA);
        if (idx <= 0) return state;
        const anterior = ORDEM_A[idx - 1];
        return anterior ? { ...state, stepA: anterior } : state;
      }
      if (state.fase === "C_conversao") {
        const idx = ORDEM_C.indexOf(state.stepC);
        if (idx <= 0) return state; // de C não volta para A nem para B
        const anterior = ORDEM_C[idx - 1];
        return anterior ? { ...state, stepC: anterior } : state;
      }
      return state;
    }
    case "RESULTADO_OK":
      if (state.fase !== "B_resultado") return state;
      return { ...state, resultado: acao.resultado, resultadoCarregando: false };
    case "RESULTADO_ERRO":
      // Nunca tela morta: erro → modo "fale com especialista" (ranking vazio)
      if (state.fase !== "B_resultado") return state;
      return {
        ...state,
        resultado: { ranking: [], firmezaIndicada: "", perfilResumo: "" },
        resultadoCarregando: false,
      };
    case "CONFIGURAR":
      if (state.fase !== "B_resultado" || state.resultadoCarregando) return state;
      return { ...state, fase: "C_conversao", stepC: "tamanho" };
    case "ESCOLHER_TAMANHO":
      if (state.fase !== "C_conversao" || state.stepC !== "tamanho") return state;
      return { ...state, tamanho: acao.tamanho, stepC: "conjunto" };
    case "ESCOLHER_CONJUNTO":
      if (state.fase !== "C_conversao" || state.stepC !== "conjunto") return state;
      return { ...state, conjunto: acao.conjunto, stepC: "lead" };
    case "FINALIZAR":
      if (state.fase !== "C_conversao" || state.stepC !== "lead") return state;
      return { ...state, fase: "finalizado" };
    case "REINICIAR":
      return { ...ESTADO_INICIAL, perfil: { pesoA: 75, pesoB: 65, dores: [] } };
    default:
      return state;
  }
}

// ── Telemetria de funil (P5 liga a persistência backend; GTM desde já) ──────────
type EventoFunil =
  | "step_view" | "step_complete" | "resultado_exibido"
  | "cta_configurar" | "lead_enviado" | "whatsapp_aberto";

// window.dataLayer já é declarado globalmente em @/lib/tracking
function emitirEventoFunil(
  evento: EventoFunil,
  lojaId: number,
  sessionId: string,
  payload?: Record<string, unknown>,
) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: `mapa_sono_${evento}`, lojaId, sessionId, ts: Date.now(), ...payload });
  } catch { /* telemetria nunca quebra o fluxo */ }
}

// ── Chamada ao motor v2 (backend) ───────────────────────────────────────────────
async function buscarCompatibilidade(
  perfil: PerfilRespostas,
  lojaId: number,
): Promise<ResultadoCompatibilidade> {
  // Timeout obrigatório: sem ele, uma conexão pendurada deixaria a Fase B sem saída.
  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch("/api/mapa-sono/compatibilidade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        incomodo: perfil.incomodo,
        ocupacao: perfil.ocupacao,
        pesoA: perfil.pesoA,
        pesoB: perfil.ocupacao === "casal" ? perfil.pesoB : undefined,
        posicao: perfil.posicao,
        dores: perfil.dores,
        calor: perfil.calor === true,
        lojaId,
      }),
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!res.ok) throw new Error("api_error");
  const json: unknown = await res.json();
  const obj = json as { success?: boolean; data?: ResultadoCompatibilidade };
  if (!obj?.success || !obj.data) throw new Error("api_error");
  return {
    ranking: Array.isArray(obj.data.ranking) ? obj.data.ranking : [],
    firmezaIndicada: obj.data.firmezaIndicada ?? "",
    perfilResumo: obj.data.perfilResumo ?? "",
  };
}

// ── Mensagem do WhatsApp ────────────────────────────────────────────────────────
function buildWAUrl(resultado: ResultadoCompatibilidade | null): string {
  const top = resultado?.ranking[0];
  const msg = top
    ? `Olá. Finalizei o Mapa do Sono e minha maior compatibilidade foi ${top.nome} (${top.score}%). Gostaria de falar com um especialista.`
    : "Olá. Finalizei o Mapa do Sono e gostaria de falar com um especialista.";
  return `https://wa.me/${WA_NUMERO}?text=${encodeURIComponent(msg)}`;
}

// ── Componentes visuais reutilizados (identidade intocada) ──────────────────────
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
      <div className="flex items-center justify-center gap-6 mb-6">
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

interface Opt<V extends string> { value: V; label: string; Icon: React.ElementType; }

function OpcoesUnicas<V extends string>({
  opcoes, selecionada, onSelect, grid2 = false,
}: {
  opcoes: Opt<V>[];
  selecionada?: V;
  onSelect: (v: V) => void;
  grid2?: boolean;
}) {
  return (
    <div className={grid2 ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
      {opcoes.map(opt => (
        <motion.button
          key={opt.value}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(opt.value)}
          className="flex items-center gap-3 p-4 rounded-xl border text-left transition-all"
          style={{
            background: selecionada === opt.value ? "#1e0000" : CARD,
            borderColor: selecionada === opt.value ? RED : BORDER,
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
  );
}

function CabecalhoPergunta({ Icon, titulo, subtitulo }: {
  Icon: React.ElementType; titulo: string; subtitulo?: string;
}) {
  return (
    <>
      <div className="flex justify-center mb-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: RED, boxShadow: `0 4px 24px ${RED}55` }}>
          <Icon className="w-8 h-8 text-white" />
        </div>
      </div>
      <h2 className="text-center text-2xl font-black text-white mb-2 leading-snug">{titulo}</h2>
      {subtitulo ? (
        <p className="text-center text-sm mb-6" style={{ color: "#888" }}>{subtitulo}</p>
      ) : (
        <div className="mb-6" />
      )}
    </>
  );
}

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 mb-5 text-sm font-semibold"
      style={{ color: "#666" }}
    >
      <ChevronLeft className="w-4 h-4" />
      Voltar
    </button>
  );
}

// ── FASE A — Diagnóstico (6 etapas, uma pergunta por tela) ──────────────────────
const OPCOES_INCOMODO: Opt<Incomodo>[] = [
  { value: "dor",       label: "Acordo com dores",       Icon: Zap },
  { value: "calor",     label: "Calor durante a noite",  Icon: Thermometer },
  { value: "afundando", label: "Colchão afundando",      Icon: BedDouble },
  { value: "sono_ruim", label: "Sono ruim ou agitado",   Icon: Moon },
  { value: "conforto",  label: "Quero mais conforto",    Icon: Heart },
];

const OPCOES_OCUPACAO: Opt<Ocupacao>[] = [
  { value: "sozinho", label: "Só para mim",   Icon: User },
  { value: "casal",   label: "Para um casal", Icon: Users },
];

const OPCOES_POSICAO: Opt<Posicao>[] = [
  { value: "lado",   label: "De lado",          Icon: Activity },
  { value: "costas", label: "De costas",        Icon: User },
  { value: "brucos", label: "De bruços",        Icon: Heart },
  { value: "varia",  label: "Varia de posição", Icon: RefreshCw },
];

const OPCOES_DORES: { value: Dor | "nenhuma"; label: string; Icon: React.ElementType }[] = [
  { value: "lombar",   label: "Lombar",   Icon: Zap },
  { value: "cervical", label: "Cervical", Icon: Activity },
  { value: "ombro",    label: "Ombro",    Icon: User },
  { value: "quadril",  label: "Quadril",  Icon: Heart },
  { value: "nenhuma",  label: "Nenhuma",  Icon: Check },
];

const OPCOES_CALOR: Opt<"sim" | "nao">[] = [
  { value: "sim", label: "Sim", Icon: Thermometer },
  { value: "nao", label: "Não", Icon: Moon },
];

function FaseA({
  state, onResponder, onVoltar,
}: {
  state: State;
  onResponder: (step: StepA, perfil: PerfilRespostas) => void;
  onVoltar: () => void;
}) {
  const { stepA, perfil } = state;
  const idx = ORDEM_A.indexOf(stepA);
  // Ao voltar para a etapa de dores, restaura a seleção anterior
  const [doresSel, setDoresSel] = useState<Array<Dor | "nenhuma">>(perfil.dores);
  const [pesoA, setPesoA] = useState(perfil.pesoA);
  const [pesoB, setPesoB] = useState(perfil.pesoB);

  useEffect(() => { setDoresSel(perfil.dores); }, [stepA]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDor(val: Dor | "nenhuma") {
    if (val === "nenhuma") { setDoresSel(["nenhuma"]); return; }
    setDoresSel(prev => {
      const sem = prev.filter(v => v !== "nenhuma");
      return sem.includes(val) ? sem.filter(v => v !== val) : [...sem, val];
    });
  }

  const fmtPeso = (v: number) => `${v} kg`;

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <ProgressHeader step={idx} total={ORDEM_A.length} />

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {idx > 0 && <BotaoVoltar onClick={onVoltar} />}

        {stepA === "incomodo" && (
          <>
            <CabecalhoPergunta Icon={Moon} titulo="O que mais incomoda o seu sono hoje?" />
            <OpcoesUnicas
              opcoes={OPCOES_INCOMODO}
              selecionada={perfil.incomodo}
              onSelect={v => onResponder("incomodo", { ...perfil, incomodo: v })}
            />
          </>
        )}

        {stepA === "ocupacao" && (
          <>
            <CabecalhoPergunta Icon={Users} titulo="Para quem é o colchão?" />
            <OpcoesUnicas
              opcoes={OPCOES_OCUPACAO}
              selecionada={perfil.ocupacao}
              onSelect={v => onResponder("ocupacao", { ...perfil, ocupacao: v })}
            />
          </>
        )}

        {stepA === "peso" && (
          <>
            <CabecalhoPergunta
              Icon={Scale}
              titulo={perfil.ocupacao === "casal" ? "Qual o peso de vocês?" : "Qual o seu peso?"}
              subtitulo={perfil.ocupacao === "casal" ? "Informe o peso das duas pessoas" : "Informe seu peso"}
            />
            {perfil.ocupacao === "casal" && (
              <p className="text-center text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#777" }}>
                Seu peso
              </p>
            )}
            <NumberPicker value={pesoA} min={40} max={180} format={fmtPeso} onChange={setPesoA} />
            {perfil.ocupacao === "casal" && (
              <>
                <p className="text-center text-xs font-bold uppercase tracking-wider mt-8 mb-3" style={{ color: "#777" }}>
                  Peso do(a) parceiro(a)
                </p>
                <NumberPicker value={pesoB} min={40} max={180} format={fmtPeso} onChange={setPesoB} />
              </>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onResponder("peso", { ...perfil, pesoA, pesoB })}
              className="mt-8 w-full py-4 rounded-2xl font-extrabold text-white text-base"
              style={{ background: RED }}
            >
              Continuar →
            </motion.button>
          </>
        )}

        {stepA === "posicao" && (
          <>
            <CabecalhoPergunta Icon={BedDouble} titulo="Qual posição você mais dorme?" />
            <OpcoesUnicas
              opcoes={OPCOES_POSICAO}
              selecionada={perfil.posicao}
              onSelect={v => onResponder("posicao", { ...perfil, posicao: v })}
            />
          </>
        )}

        {stepA === "dores" && (
          <>
            <CabecalhoPergunta Icon={Activity} titulo="Você sente alguma dor com frequência?" />
            <div className="flex flex-col gap-3 mb-5">
              {OPCOES_DORES.map(opt => {
                const sel = doresSel.includes(opt.value);
                return (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleDor(opt.value)}
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
              onClick={() => {
                if (doresSel.length === 0) return;
                const dores = doresSel.filter((d): d is Dor => d !== "nenhuma");
                onResponder("dores", { ...perfil, dores });
              }}
              className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
              style={{
                background: doresSel.length > 0 ? RED : "#2a0808",
                opacity: doresSel.length > 0 ? 1 : 0.5,
              }}
            >
              Confirmar →
            </motion.button>
          </>
        )}

        {stepA === "calor" && (
          <>
            <CabecalhoPergunta Icon={Thermometer} titulo="Você sente calor ao dormir?" />
            <OpcoesUnicas
              opcoes={OPCOES_CALOR}
              selecionada={perfil.calor === undefined ? undefined : perfil.calor ? "sim" : "nao"}
              onSelect={v => onResponder("calor", { ...perfil, calor: v === "sim" })}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── FASE B — Resultado ──────────────────────────────────────────────────────────
const CATEGORIA_LABEL: Record<Categoria, string> = {
  principal: "Principal",
  premium: "Premium",
  mais_macia: "Mais Macia",
  mais_firme: "Mais Firme",
  custo_beneficio: "Custo-Benefício",
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden mb-5 animate-pulse" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="w-full h-44" style={{ background: "#1a0505" }} />
      <div className="px-5 py-5 space-y-3">
        <div className="h-3 w-1/3 rounded" style={{ background: "#1e0808" }} />
        <div className="h-5 w-2/3 rounded" style={{ background: "#1e0808" }} />
        <div className="h-4 w-1/4 rounded" style={{ background: "#1e0808" }} />
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full" style={{ background: "#1e0808" }} />
          <div className="h-6 w-28 rounded-full" style={{ background: "#1e0808" }} />
        </div>
      </div>
    </div>
  );
}

function FaseB({
  state, onConfigurar,
}: {
  state: State;
  onConfigurar: () => void;
}) {
  const { resultado, resultadoCarregando } = state;
  // Skeleton só aparece se a geração exceder 800ms (sem spinner, sem "analisando")
  const [mostrarSkeleton, setMostrarSkeleton] = useState(false);
  useEffect(() => {
    if (!resultadoCarregando) { setMostrarSkeleton(false); return; }
    const t = window.setTimeout(() => setMostrarSkeleton(true), 800);
    return () => window.clearTimeout(t);
  }, [resultadoCarregando]);

  const ranking = resultado?.ranking ?? [];
  const top = ranking[0] ?? null;
  const outros = ranking.slice(1);
  const semProdutos = !resultadoCarregando && resultado !== null && ranking.length === 0;

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
        <div className="text-center pt-8 mb-6">
          <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: RED }}>
            Diagnóstico concluído
          </p>
          <h2 className="text-2xl font-black text-white mb-2">Sua Compatibilidade de Descanso</h2>
          {resultado && resultado.firmezaIndicada && (
            <p className="text-sm" style={{ color: "#888" }}>
              Firmeza indicada: <span className="font-bold" style={{ color: "#aaa" }}>{resultado.firmezaIndicada}</span>
            </p>
          )}
        </div>

        {/* Perfil de descanso — 1 linha, vinda do motor */}
        {resultado && resultado.perfilResumo && (
          <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
            style={{ background: "#0e0e0e", border: "1px solid #1e1e1e" }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: RED }} />
            <p className="text-xs" style={{ color: "#888" }}>{resultado.perfilResumo}</p>
          </div>
        )}

        {resultadoCarregando && mostrarSkeleton && <SkeletonCard />}

        {semProdutos && (
          <div className="rounded-2xl p-6 text-center mb-5"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="text-4xl mb-3">💬</div>
            <p className="text-white font-black text-lg mb-1">Fale com um especialista</p>
            <p className="text-sm" style={{ color: "#888" }}>
              Recebemos seu perfil de descanso. Nossa equipe vai indicar pessoalmente o colchão com maior compatibilidade para você.
            </p>
          </div>
        )}

        {top && (
          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: CARD, border: `1.5px solid ${RED}` }}>
            {top.imagem && (
              <div className="w-full h-44 overflow-hidden" style={{ background: "#0e0e0e" }}>
                <img src={top.imagem} alt={top.nome} className="w-full h-full object-contain" loading="lazy" />
              </div>
            )}
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#666" }}>
                  Maior compatibilidade
                </p>
                <span className="text-xs font-black px-3 py-1 rounded-full"
                  style={{ background: "#1e0000", color: RED, border: `1px solid ${BORDER}` }}>
                  {top.classificacao}
                </span>
              </div>
              <h3 className="text-xl font-black text-white mb-1 leading-tight">{top.nome}</h3>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-black" style={{ color: RED }}>{top.score}%</span>
                <span className="text-xs font-semibold" style={{ color: "#777" }}>de compatibilidade</span>
              </div>
              {top.precoPix && (
                <p className="text-lg font-extrabold mb-3" style={{ color: RED }}>{top.precoPix} no Pix</p>
              )}
              <div className="flex flex-col gap-2">
                {top.motivos.map(m => (
                  <div key={m} className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
                    <Check className="w-4 h-4 shrink-0" style={{ color: RED }} />
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {outros.length > 0 && (
          <>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#555" }}>
              Outras compatibilidades
            </p>
            <div className="flex flex-col gap-3 mb-5">
              {outros.map(item => (
                <div key={item.produtoId} className="rounded-xl px-4 py-4 flex items-center gap-4"
                  style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  {item.imagem && (
                    <img src={item.imagem} alt={item.nome}
                      className="w-14 h-14 rounded-lg object-contain shrink-0"
                      style={{ background: "#0e0e0e" }} loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: "#1e0000", color: RED, border: `1px solid ${BORDER}` }}>
                      {CATEGORIA_LABEL[item.categoria]}
                    </span>
                    <p className="text-white font-bold text-sm leading-tight truncate mt-1.5">{item.nome}</p>
                    {item.precoPix && (
                      <p className="text-sm font-extrabold mt-1" style={{ color: RED }}>{item.precoPix}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-black text-white">{item.score}%</p>
                    <p className="text-[10px]" style={{ color: "#666" }}>{item.classificacao}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!resultadoCarregando && resultado !== null && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onConfigurar}
            className="w-full py-4 rounded-2xl font-extrabold text-white text-base"
            style={{ background: RED, boxShadow: `0 4px 24px ${RED}55` }}
          >
            {semProdutos ? "Receber orientação personalizada →" : "Configurar minha escolha →"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ── FASE C — Conversão ──────────────────────────────────────────────────────────
const OPCOES_TAMANHO: Opt<Tamanho>[] = [
  { value: "solteiro", label: "Solteiro", Icon: User },
  { value: "casal",    label: "Casal",    Icon: Users },
  { value: "queen",    label: "Queen",    Icon: BedDouble },
  { value: "king",     label: "King",     Icon: Star },
];

const OPCOES_CONJUNTO: Opt<Conjunto>[] = [
  { value: "colchao",          label: "Só o colchão",        Icon: BedDouble },
  { value: "box_colchao",      label: "Box + colchão",       Icon: Package },
  { value: "box_bau_colchao",  label: "Box baú + colchão",   Icon: Layers },
];

function FaseC({
  state, onTamanho, onConjunto, onLead, onVoltar,
}: {
  state: State;
  onTamanho: (t: Tamanho) => void;
  onConjunto: (c: Conjunto) => void;
  onLead: (nome: string, whatsapp: string) => void;
  onVoltar: () => void;
}) {
  const { stepC, tamanho, conjunto } = state;
  const idx = ORDEM_C.indexOf(stepC);
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");

  const leadValido = nome.trim().length > 0 && zap.replace(/\D/g, "").length >= 10;

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <ProgressHeader step={idx} total={ORDEM_C.length} />

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {idx > 0 && <BotaoVoltar onClick={onVoltar} />}

        {stepC === "tamanho" && (
          <>
            <CabecalhoPergunta Icon={BedDouble} titulo="Qual o tamanho desejado?" />
            <OpcoesUnicas opcoes={OPCOES_TAMANHO} selecionada={tamanho ?? undefined} onSelect={onTamanho} grid2 />
          </>
        )}

        {stepC === "conjunto" && (
          <>
            <CabecalhoPergunta Icon={Package} titulo="Como você quer o seu conjunto?" />
            <OpcoesUnicas opcoes={OPCOES_CONJUNTO} selecionada={conjunto ?? undefined} onSelect={onConjunto} />
          </>
        )}

        {stepC === "lead" && (
          <>
            <CabecalhoPergunta
              Icon={MessageCircle}
              titulo="Quase lá!"
              subtitulo="Receba sua análise completa e orientação personalizada."
            />
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
                  placeholder="Seu WhatsApp (com DDD)"
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
              onClick={() => leadValido && onLead(nome.trim(), zap.trim())}
              className="w-full py-4 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-2"
              style={{ background: leadValido ? "#25D366" : "#2a0808", opacity: leadValido ? 1 : 0.6 }}
            >
              <MessageCircle className="w-5 h-5" />
              Falar com especialista no WhatsApp
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Finalizado ──────────────────────────────────────────────────────────────────
function Finalizado({ waUrl, onReiniciar, onReabrirWA }: {
  waUrl: string; onReiniciar: () => void; onReabrirWA: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center" style={{ background: BG }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: "#25D366", boxShadow: "0 4px 24px rgba(37,211,102,0.35)" }}>
        <Check className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-black text-white mb-2">Tudo certo!</h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: "#888" }}>
        Abrimos o WhatsApp para você falar com um especialista. Se a janela não abriu, toque no botão abaixo.
      </p>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onReabrirWA}
        className="flex items-center justify-center gap-2.5 w-full max-w-xs py-4 rounded-2xl font-extrabold text-white text-base mb-3"
        style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}
      >
        <MessageCircle className="w-5 h-5" />
        Abrir WhatsApp
      </a>
      <button onClick={onReiniciar} className="w-full max-w-xs py-3 rounded-2xl text-sm font-semibold" style={{ color: "#666" }}>
        Refazer o diagnóstico
      </button>
    </div>
  );
}

// ── Welcome (somente página, não embedded) ──────────────────────────────────────
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
        Responda {ORDEM_A.length} perguntas rápidas e descubra os colchões com maior compatibilidade com o seu corpo.
      </p>
      <div className="flex flex-col gap-2 mb-10 w-full max-w-xs text-left">
        {["100% Online · Leva menos de 60 segundos", "Personalizado · Baseado no seu perfil de descanso", "Gratuito · Sem compromisso"].map(t => (
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

// ── Main ────────────────────────────────────────────────────────────────────────
export default function MapaSono({ embedded = false }: MapaSonoProps) {
  const { lojaId } = useLoja();
  const [mostrarWelcome, setMostrarWelcome] = useState(!embedded);
  const [state, dispatch] = useReducer(reducer, ESTADO_INICIAL);
  const [leadDados, setLeadDados] = useState<{ nome: string; whatsapp: string } | null>(null);

  const sessionId = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ms-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
  );

  // First-click-wins: primeiro clique agenda o avanço, último clique define o valor.
  const autoTimer = useRef<number | null>(null);
  const pendingResposta = useRef<{ step: StepA; perfil: PerfilRespostas } | null>(null);

  useEffect(() => () => {
    if (autoTimer.current !== null) window.clearTimeout(autoTimer.current);
  }, []);

  const emitir = (evento: EventoFunil, payload?: Record<string, unknown>) =>
    emitirEventoFunil(evento, lojaId, sessionId.current, payload);

  // step_view a cada transição visível
  useEffect(() => {
    if (mostrarWelcome) return;
    if (state.fase === "A_diagnostico") emitir("step_view", { fase: "A", step: state.stepA });
    else if (state.fase === "C_conversao") emitir("step_view", { fase: "C", step: state.stepC });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fase, state.stepA, state.stepC, mostrarWelcome]);

  function gerarResultado(perfil: PerfilRespostas) {
    buscarCompatibilidade(perfil, lojaId)
      .then(resultado => {
        dispatch({ type: "RESULTADO_OK", resultado });
        emitir("resultado_exibido", {
          top: resultado.ranking[0]?.nome ?? null,
          score: resultado.ranking[0]?.score ?? null,
          itens: resultado.ranking.length,
        });
      })
      .catch(() => {
        dispatch({ type: "RESULTADO_ERRO" });
        emitir("resultado_exibido", { top: null, score: null, itens: 0, erro: true });
      });
  }

  function responderA(step: StepA, perfil: PerfilRespostas) {
    emitir("step_complete", { fase: "A", step });

    if (step === "calor") {
      // Geração dispara NO CLIQUE da etapa calor — sem tela intermediária
      if (autoTimer.current !== null) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
      pendingResposta.current = null;
      dispatch({ type: "RESPONDER_A", step, perfil });
      gerarResultado(perfil);
      return;
    }

    if (step === "peso" || step === "dores") {
      // Etapas com botão de confirmação explícito: avanço imediato
      dispatch({ type: "RESPONDER_A", step, perfil });
      return;
    }

    // Clique único: feedback visual de 240ms, first-click-wins
    pendingResposta.current = { step, perfil };
    if (autoTimer.current === null) {
      autoTimer.current = window.setTimeout(() => {
        autoTimer.current = null;
        const p = pendingResposta.current;
        pendingResposta.current = null;
        if (p) dispatch({ type: "RESPONDER_A", step: p.step, perfil: p.perfil });
      }, 240);
    }
  }

  function voltar() {
    if (autoTimer.current !== null) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    pendingResposta.current = null;
    dispatch({ type: "VOLTAR" });
  }

  function configurar() {
    emitir("cta_configurar");
    dispatch({ type: "CONFIGURAR" });
  }

  function enviarLead(nome: string, whatsapp: string) {
    setLeadDados({ nome, whatsapp });
    emitir("lead_enviado", { temRanking: (state.resultado?.ranking.length ?? 0) > 0 });

    // REGRA DE RESILIÊNCIA: a abertura do WhatsApp acontece de forma síncrona no
    // clique (preserva o gesto do usuário contra bloqueio de pop-up) e NUNCA
    // espera o backend. A persistência do lead é assíncrona (P4).
    const waUrl = buildWAUrl(state.resultado);
    try { window.open(waUrl, "_blank", "noopener,noreferrer"); } catch { /* fallback no Finalizado */ }
    trackWhatsAppClick("mapa_sono_lead", "Cabo Frio");
    emitir("whatsapp_aberto", { url: waUrl });

    dispatch({ type: "FINALIZAR" });
  }

  function reiniciar() {
    setLeadDados(null);
    dispatch({ type: "REINICIAR" });
  }

  void leadDados; // persistido no P4 (POST /api/leads/mapa-sono + retry)

  const outerClass = embedded ? "flex flex-col min-h-full" : "flex flex-col min-h-screen";
  const chaveTela =
    state.fase === "A_diagnostico" ? `A-${state.stepA}` :
    state.fase === "C_conversao"   ? `C-${state.stepC}` :
    state.fase;

  return (
    <div className={outerClass} style={{ background: BG }}>
      <AnimatePresence mode="wait">
        {mostrarWelcome && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <WelcomeScreen onStart={() => setMostrarWelcome(false)} />
          </motion.div>
        )}

        {!mostrarWelcome && (
          <motion.div
            key={chaveTela}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {state.fase === "A_diagnostico" && (
              <FaseA state={state} onResponder={responderA} onVoltar={voltar} />
            )}
            {state.fase === "B_resultado" && (
              <FaseB state={state} onConfigurar={configurar} />
            )}
            {state.fase === "C_conversao" && (
              <FaseC
                state={state}
                onTamanho={t => { emitir("step_complete", { fase: "C", step: "tamanho" }); dispatch({ type: "ESCOLHER_TAMANHO", tamanho: t }); }}
                onConjunto={c => { emitir("step_complete", { fase: "C", step: "conjunto" }); dispatch({ type: "ESCOLHER_CONJUNTO", conjunto: c }); }}
                onLead={enviarLead}
                onVoltar={voltar}
              />
            )}
            {state.fase === "finalizado" && (
              <Finalizado
                waUrl={buildWAUrl(state.resultado)}
                onReiniciar={reiniciar}
                onReabrirWA={() => emitir("whatsapp_aberto", { reaberto: true })}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
