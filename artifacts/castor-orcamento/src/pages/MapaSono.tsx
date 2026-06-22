import { useEffect, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Plus, Minus, Check, MessageCircle, BedDouble, AlertTriangle,
  Activity, ArrowRight, ShieldCheck, Wind,
} from "lucide-react";
import { trackWhatsAppClick } from "@/lib/tracking";
import { useLoja } from "@/contexts/LojaContext";
import {
  engineReducer, estadoInicial, noPorId, progresso, podeVoltar,
  resolverTexto, resolverOpcoes, montarPayloadCompat,
  type EngineState,
} from "./mapa-sono/engine";
import type {
  Respostas, ResultadoCompatibilidade, Categoria, Opt, QuestionNode, Dor,
} from "./mapa-sono/types";

export interface MapaSonoProps { embedded?: boolean; }

// ── Design system — Ciência do Sono (Dark Premium / Glassmorphism) ──────────────
// Vermelho Castor = CTAs e linhas de ação. Azul Dinâmico = dados analíticos/gráficos.
const BG     = "#0d0d0d";
const RED     = "#e63329"; // CTA / linha de ação
const BLUE    = "#0091ff"; // dado analítico / gráfico
const MUTED   = "#86868b"; // texto secundário
const GLASS    = "rgba(22, 22, 26, 0.7)";
const GLASS_BD = "rgba(255, 255, 255, 0.08)";
const GLASS_SHADOW = "0 24px 60px rgba(0,0,0,0.6)";

const WA_NUMERO_PADRAO = "5522992410112";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  principal: "Topo",
  premium: "Premium",
  mais_macia: "Mais Macia",
  mais_firme: "Mais Firme",
  custo_beneficio: "Custo-Benefício",
};

// ── Telemetria de funil — GTM + persistência em eventos_operacionais (loja_id) ──
type EventoFunil =
  | "step_view" | "step_complete" | "resultado_exibido" | "whatsapp_aberto";

function emitirEventoFunil(
  evento: EventoFunil, lojaId: number, sessionId: string, payload?: Record<string, unknown>,
) {
  const ts = Date.now();
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: `mapa_sono_${evento}`, lojaId, sessionId, ts, ...payload });
  } catch { /* telemetria nunca quebra o fluxo */ }
  try {
    fetch("/api/telemetria/funil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ evento, lojaId, sessionId, ts, payload: payload ?? {} }),
    }).catch(() => { /* fire-and-forget */ });
  } catch { /* telemetria nunca quebra o fluxo */ }
}

// ── Motor de resultado (backend) ────────────────────────────────────────────────
async function buscarCompatibilidade(
  payload: Record<string, unknown>, lojaId: number,
): Promise<ResultadoCompatibilidade> {
  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch("/api/mapa-sono/compatibilidade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ ...payload, lojaId }),
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
    origem: obj.data.origem,
  };
}

// ── Rótulos legíveis ────────────────────────────────────────────────────────────
const POS_LABEL: Record<string, string> = {
  lado: "de lado", costas: "de costas", brucos: "de bruços", varia: "variando de posição",
};
const DOR_LABEL: Record<Dor, string> = {
  lombar: "lombar", cervical: "cervical", ombro: "ombro", quadril: "quadril", joelho: "joelho",
};
const CTX_LABEL: Record<string, string> = {
  constante: "Uso constante", praia: "Casa de praia", hospede: "Hóspede / hotelaria",
};
const TEMP_LABEL: Record<string, string> = {
  quente: "sinto calor", frio: "sinto frio", indiferente: "indiferente",
};

// ── Bloco de concordância (SIM, SIM, SIM) — montado das respostas ──────────────
function frasesConcordancia(r: Respostas): string[] {
  const f: string[] = [];
  if (r.dores.length > 0) f.push(`Você acorda com dor ${r.dores.map(d => DOR_LABEL[d]).join(", ")}.`);
  if (r.temperatura === "quente") f.push("Que sente calor durante a noite.");
  else if (r.temperatura === "frio") f.push("Que sente frio durante a noite.");
  if (r.posicao) f.push(`E que dorme ${POS_LABEL[r.posicao]}.`);
  if (r.gestante) f.push("Que há gestante ou bebê na cama.");
  else if (r.patologia && r.patologia !== "nenhuma") f.push("Que há uma condição de saúde a considerar.");
  return f.slice(0, 4);
}

// ── Sugestão de travesseiro (só uso constante, conforme queixa) ─────────────────
function travesseiroSugerido(r: Respostas): { nome: string } | null {
  if (r.contexto !== "constante") return null;
  if (r.dores.includes("cervical") || r.dores.includes("ombro"))
    return { nome: "Travesseiro Viscosoft Hot & Cold" };
  if (r.dores.includes("joelho") || r.dores.includes("quadril") || r.gestante)
    return { nome: "Travesseiro de Corpo 140x40cm" };
  return null;
}

// ── Mensagem do WhatsApp — perfil completo + recomendação ───────────────────────
function buildWAUrl(r: Respostas, resultado: ResultadoCompatibilidade | null, waNumero: string): string {
  const L: string[] = ["Olá! Fiz o diagnóstico Ciência do Sono e gostaria de saber mais.", "", "📋 MEU PERFIL:"];
  L.push(`• Contexto: ${CTX_LABEL[r.contexto ?? "constante"]}`);
  if (r.contexto !== "hospede") {
    L.push(`• Pessoas: ${r.quantidade ?? 1}`);
    L.push(`• Pessoa A: ${r.pesoA}kg · ${r.alturaA}cm · ${r.idadeA} anos`);
    if (r.quantidade === 2) L.push(`• Pessoa B: ${r.pesoB}kg · ${r.alturaB}cm · ${r.idadeB} anos`);
    if (r.posicao) L.push(`• Posição: ${POS_LABEL[r.posicao]}`);
    L.push(`• Dores: ${r.dores.length ? r.dores.map(d => DOR_LABEL[d]).join(", ") : "nenhuma"}`);
    if (r.temperatura) L.push(`• Temperatura: ${TEMP_LABEL[r.temperatura]}`);
  }
  if (r.tamanho) L.push(`• Medida: ${r.tamanho}`);
  if (r.conjunto) L.push(`• Tipo: ${r.conjunto === "conjunto" ? "conjunto (cama + colchão)" : "só o colchão"}`);
  const rank = resultado?.ranking ?? [];
  if (rank.length > 0) {
    L.push("", "🛏️ RECOMENDAÇÃO DO SISTEMA:");
    rank.slice(0, 3).forEach((it, i) => L.push(`${i + 1}. ${it.nome} — ${it.score}% — ${CATEGORIA_LABEL[it.categoria]}`));
  }
  L.push("", "Gostaria de mais informações sobre esses modelos.");
  return `https://wa.me/${waNumero}?text=${encodeURIComponent(L.join("\n"))}`;
}

// ════════════════════════════════════════════════════════════════════════════════
// ANALÍTICA DERIVADA — tudo a partir das respostas reais (IMC, prioridades, eixos)
// ════════════════════════════════════════════════════════════════════════════════
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function imc(r: Respostas): number {
  const h = (r.alturaA || 170) / 100;
  return r.pesoA / (h * h);
}

// 5 eixos → pentágono do radar. Derivado de dores/posição/temperatura/IMC.
function prioridades(r: Respostas): { label: string; pct: number }[] {
  const pesado = imc(r) >= 27 || r.pesoA >= 90;
  const temLombar = r.dores.includes("lombar") || r.dores.includes("quadril");
  const temCervical = r.dores.includes("cervical") || r.dores.includes("ombro");
  const calor = r.temperatura === "quente";
  const lado = r.posicao === "lado";

  const lombar   = 24 + (temLombar ? 18 : 0) + (pesado ? 8 : 0) + (r.posicao === "costas" ? 4 : 0);
  const cervical = 16 + (temCervical ? 16 : 0) + (lado ? 7 : 0);
  const respira  = 16 + (calor ? 18 : 0);
  const alivio   = 16 + (lado ? 11 : 0) + (r.dores.length ? 8 : 0);
  const durab    = 14 + (pesado ? 11 : 0) + (r.contexto === "constante" ? 4 : 0);

  const arr: [string, number][] = [
    ["Suporte Lombar", lombar],
    ["Suporte Cervical", cervical],
    ["Respirabilidade", respira],
    ["Alívio de Pressão", alivio],
    ["Durabilidade", durab],
  ];
  const total = arr.reduce((s, [, v]) => s + v, 0) || 1;
  return arr.map(([label, v]) => ({ label, pct: Math.round((v / total) * 100) }));
}

// Ponto da matriz 2×2. x: 0 (suporte) → 1 (durabilidade); y: 0 (sustentação) → 1 (alívio).
function pontoMatriz(r: Respostas): { x: number; y: number } {
  const pesado = imc(r) >= 27;
  const x = clamp(
    0.5 + (pesado ? 0.18 : -0.08) + (r.contexto === "constante" ? 0.12 : -0.06),
    0.18, 0.82,
  );
  const y = clamp(
    0.5 - (r.dores.length ? 0.2 : 0) + (pesado ? 0.14 : 0) - (r.posicao === "lado" ? 0.12 : 0),
    0.18, 0.82,
  );
  return { x, y };
}

function diagnosticoPreliminar(r: Respostas): string {
  const i = imc(r);
  const faixa = i < 18.5 ? "leve" : i < 25 ? "equilibrado" : i < 30 ? "elevado" : "alto";
  const carga = i >= 27
    ? "exige maior sustentação na zona lombar para evitar afundamento do quadril"
    : "permite equilíbrio entre alívio de pressão e suporte ortopédico";
  const dor = r.dores.length
    ? `Com queixa ${r.dores.map(d => DOR_LABEL[d]).join(", ")}, priorizamos alívio de pressão direcionado.`
    : "Sem queixas álgicas relevantes, o foco é o alinhamento neutro da coluna.";
  return `IMC ${i.toFixed(1)} (${faixa}) — seu biotipo ${carga}. ${dor}`;
}

// ════════════════════════════════════════════════════════════════════════════════
// SVG NATIVO — gráficos técnicos (sem placeholders, sem ícones infantis)
// ════════════════════════════════════════════════════════════════════════════════

// Logo-wordmark "Ciência do Sono" (lua + pulso + onda) — vetor próprio.
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <svg viewBox="0 0 64 64" className={compact ? "w-9 h-9" : "w-11 h-11"} aria-hidden>
        <defs>
          <linearGradient id="ws-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#33b0ff" />
            <stop offset="1" stopColor={BLUE} />
          </linearGradient>
        </defs>
        {/* anel-lua aberto */}
        <path d="M50 14 A24 24 0 1 0 50 50" fill="none" stroke="url(#ws-g)" strokeWidth="4" strokeLinecap="round" />
        {/* arco pontilhado */}
        <path d="M50 14 A24 24 0 0 1 56 30" fill="none" stroke="url(#ws-g)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 5" />
        {/* pulso ECG */}
        <path d="M16 33 H26 L30 24 L35 42 L39 33 H48" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* onda inferior */}
        <path d="M16 44 C24 40 30 48 40 44 C46 41 50 44 52 43" fill="none" stroke="url(#ws-g)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className="font-bold text-white text-lg tracking-tight" style={{ letterSpacing: "-0.02em" }}>CIÊNCIA</div>
          <div className="font-bold text-lg tracking-tight" style={{ color: BLUE, letterSpacing: "-0.02em" }}>DO SONO</div>
        </div>
      )}
    </div>
  );
}

// Boneco biomecânico — silhueta reclinada, coluna em vermelho, pontos de pressão azuis.
function BiomechanicalFigure() {
  return (
    <svg viewBox="0 0 220 90" className="w-full h-auto" aria-hidden>
      <defs>
        <linearGradient id="bf-spine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={RED} stopOpacity="0.4" />
          <stop offset="0.5" stopColor={RED} />
          <stop offset="1" stopColor={RED} stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* linha de base / colchão */}
      <line x1="6" y1="78" x2="214" y2="78" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
      {/* silhueta reclinada (cabeça → tronco → pernas) */}
      <path
        d="M22 58 a9 9 0 1 1 0.1 0 M31 62 C46 56 62 60 86 58 C104 56 120 60 142 60 C168 60 188 64 204 70"
        fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* contorno inferior do corpo */}
      <path
        d="M31 70 C52 70 70 70 92 70 C116 70 138 70 160 72 C178 73 192 74 204 76"
        fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="1.6" strokeLinecap="round"
      />
      {/* coluna destacada */}
      <path
        d="M34 60 C58 53 80 56 104 55 C128 54 150 57 172 62"
        fill="none" stroke="url(#bf-spine)" strokeWidth="3.4" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${RED}aa)` }}
      />
      {/* pontos de pressão (ombro / quadril) */}
      {[[60, 56], [120, 55]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="6" fill="none" stroke={BLUE} strokeWidth="1.4" opacity="0.5" />
          <circle cx={cx} cy={cy} r="2.6" fill={BLUE} style={{ filter: `drop-shadow(0 0 4px ${BLUE})` }} />
        </g>
      ))}
    </svg>
  );
}

// Matriz 2×2 de conflitos biomecânicos com mira-laser azul posicionada pelo perfil.
function QuadrantMatrix({ r }: { r: Respostas }) {
  const { x, y } = pontoMatriz(r);
  const px = 18 + x * 164;   // viewBox 0..200 com margem
  const py = 14 + y * 150;
  const zonas: { tx: number; ty: number; t: string }[] = [
    { tx: 58, ty: 50, t: "INER D45" },
    { tx: 150, ty: 50, t: "MOLAS POCKET" },
    { tx: 58, ty: 140, t: "VISCO GEL" },
    { tx: 150, ty: 140, t: "LÁTEX NATURAL" },
  ];
  return (
    <svg viewBox="0 0 200 188" className="w-full h-auto" aria-hidden>
      <defs>
        <radialGradient id="qm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={BLUE} stopOpacity="0.55" />
          <stop offset="0.55" stopColor={BLUE} stopOpacity="0.14" />
          <stop offset="1" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* moldura */}
      <rect x="18" y="14" width="164" height="150" rx="8" fill="rgba(0,145,255,0.04)" stroke={GLASS_BD} />
      {/* zona ativa (glow que segue o perfil) */}
      <circle cx={px} cy={py} r="44" fill="url(#qm-glow)" />
      {/* linhas internas do quadrante */}
      <line x1="100" y1="14" x2="100" y2="164" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1="18" y1="89" x2="182" y2="89" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {/* zonas de tecnologia */}
      {zonas.map((z) => (
        <text key={z.t} x={z.tx} y={z.ty} textAnchor="middle" fontSize="8" fontWeight="700"
          fill="rgba(255,255,255,0.55)" letterSpacing="0.5">{z.t}</text>
      ))}
      {/* eixos */}
      <text x="100" y="9" textAnchor="middle" fontSize="8" fontWeight="700" fill={MUTED}>SUSTENTAÇÃO</text>
      <text x="100" y="178" textAnchor="middle" fontSize="8" fontWeight="700" fill={MUTED}>ALÍVIO DE PRESSÃO</text>
      <text x="14" y="92" textAnchor="middle" fontSize="8" fontWeight="700" fill={MUTED} transform="rotate(-90 14 92)">SUPORTE</text>
      <text x="190" y="92" textAnchor="middle" fontSize="8" fontWeight="700" fill={MUTED} transform="rotate(90 190 92)">DURABILIDADE</text>
      {/* mira-laser */}
      <line x1={px} y1="14" x2={px} y2="164" stroke={BLUE} strokeWidth="0.6" opacity="0.4" />
      <line x1="18" y1={py} x2="182" y2={py} stroke={BLUE} strokeWidth="0.6" opacity="0.4" />
      <circle cx={px} cy={py} r="9" fill="none" stroke={BLUE} strokeWidth="1.2" opacity="0.6" />
      <circle cx={px} cy={py} r="3.4" fill={BLUE} style={{ filter: `drop-shadow(0 0 6px ${BLUE})` }} />
    </svg>
  );
}

// Radar / pentágono com a área de prioridades do usuário preenchida em azul.
function RadarChart({ r }: { r: Respostas }) {
  const dados = prioridades(r);
  const cx = 110, cy = 104, R = 78;
  const N = dados.length;
  const ang = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const ponto = (i: number, rad: number) => [cx + Math.cos(ang(i)) * rad, cy + Math.sin(ang(i)) * rad] as const;
  const maxPct = Math.max(...dados.map(d => d.pct), 1);

  const anel = (frac: number) =>
    dados.map((_, i) => ponto(i, R * frac).join(",")).join(" ");
  const area = dados.map((d, i) => ponto(i, R * (d.pct / maxPct)).join(",")).join(" ");

  return (
    <svg viewBox="0 0 220 208" className="w-full h-auto" aria-hidden>
      {/* anéis concêntricos */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={anel(f)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {/* raios */}
      {dados.map((_, i) => {
        const [ex, ey] = ponto(i, R);
        return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}
      {/* área do usuário */}
      <polygon points={area} fill="rgba(0,145,255,0.20)" stroke={BLUE} strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 6px ${BLUE}55)` }} />
      {dados.map((d, i) => {
        const [vx, vy] = ponto(i, R * (d.pct / maxPct));
        return <circle key={d.label} cx={vx} cy={vy} r="2.6" fill={BLUE} />;
      })}
      {/* rótulos */}
      {dados.map((d, i) => {
        const [lx, ly] = ponto(i, R + 16);
        const anchor = Math.abs(Math.cos(ang(i))) < 0.3 ? "middle" : Math.cos(ang(i)) > 0 ? "start" : "end";
        return (
          <text key={d.label} x={lx} y={ly} textAnchor={anchor} fontSize="7.5" fontWeight="700"
            fill="rgba(255,255,255,0.55)" dominantBaseline="middle">{d.label}</text>
        );
      })}
    </svg>
  );
}

const PRESSURE_PATHS: Record<string, string> = {
  lado:   "M2,30 C12,30 14,9 24,9 C34,9 34,30 44,30 C54,30 54,11 64,11 C74,11 76,30 98,28",
  costas: "M2,26 C20,22 32,18 50,18 C68,18 80,22 98,26",
  brucos: "M2,30 C20,30 30,7 50,7 C70,7 80,30 98,30",
  varia:  "M2,28 C14,17 22,26 34,13 C46,24 54,11 66,22 C78,13 88,26 98,18",
};

// Mini-spline de distribuição de pressão por postura.
function PressureLine({ variant, active }: { variant: string; active: boolean }) {
  const d = PRESSURE_PATHS[variant] ?? PRESSURE_PATHS.varia;
  const cor = active ? BLUE : "rgba(255,255,255,0.35)";
  return (
    <svg viewBox="0 0 100 40" className="w-16 h-7 shrink-0" preserveAspectRatio="none" aria-hidden>
      <line x1="2" y1="34" x2="98" y2="34" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <path d={d} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={active ? { filter: `drop-shadow(0 0 4px ${BLUE}88)` } : undefined} />
    </svg>
  );
}

// Anel de progresso (validação final).
function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const R = 32, C = 2 * Math.PI * R;
  const v = clamp(value, 0, 100);
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative w-[88px] h-[88px]">
        <svg viewBox="0 0 80 80" className="w-[88px] h-[88px] -rotate-90">
          <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <motion.circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - v / 100) }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
            style={{ filter: `drop-shadow(0 0 5px ${color}88)` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white tracking-tight">{Math.round(v)}%</span>
        </div>
      </div>
      <span className="text-[11px] text-center leading-tight max-w-[96px]" style={{ color: MUTED }}>{label}</span>
    </div>
  );
}

// ── Primitivos de UI (glassmorphism) ────────────────────────────────────────────
function GlassCard({ children, className = "", accent }: {
  children: React.ReactNode; className?: string; accent?: "red" | "blue" | "amber";
}) {
  const borda = accent === "red" ? RED : accent === "blue" ? BLUE : GLASS_BD;
  const glow = accent === "red" ? `, 0 0 0 1px ${RED}55, 0 8px 30px ${RED}22`
    : accent === "blue" ? `, 0 0 0 1px ${BLUE}44, 0 8px 30px ${BLUE}1a` : "";
  return (
    <div className={`rounded-2xl ${className}`}
      style={{
        background: GLASS, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${borda}`, boxShadow: `${GLASS_SHADOW}${glow}`,
      }}>
      {children}
    </div>
  );
}

function EyebrowChip({ Icon, children, color = BLUE }: {
  Icon: React.ElementType; children: React.ReactNode; color?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GLASS_BD}` }}>
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)" }}>{children}</span>
    </div>
  );
}

function ProgressHeader({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <div className="px-5 pt-5 pb-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <Wordmark compact />
        <span className="text-xs font-bold tabular-nums" style={{ color: MUTED }}>
          <span className="text-white">{String(step + 1).padStart(2, "0")}</span> / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <motion.div className="h-1 rounded-full"
          style={{ background: `linear-gradient(90deg, ${RED}, #ff5a4d)`, boxShadow: `0 0 10px ${RED}88` }}
          initial={false} animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }} />
      </div>
    </div>
  );
}

// Slider premium: linha fina, progresso vermelho, botões circulares −/+ com borda.
function NumberPicker({
  label, value, min, max, format, onChange,
}: {
  label: string; value: number; min: number; max: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const btn = "w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-transform active:scale-90 disabled:opacity-30";
  const btnStyle = { background: "rgba(255,255,255,0.04)", border: `1px solid ${GLASS_BD}` };
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-sm font-bold text-white tracking-tight">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: BLUE }}>{format(value)}</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className={btn} style={btnStyle}>
          <Minus className="w-4 h-4" />
        </button>
        <div className="relative flex-1 h-5 flex items-center">
          <div className="absolute inset-x-0 h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.10)" }} />
          <motion.div className="absolute left-0 h-[3px] rounded-full"
            style={{ background: RED, boxShadow: `0 0 8px ${RED}99` }}
            animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          <motion.div className="absolute" animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }} style={{ transform: "translateX(-50%)" }}>
            <div className="w-4 h-4 rounded-full border-2"
              style={{ background: "#fff", borderColor: RED, boxShadow: `0 0 10px ${RED}aa` }} />
          </motion.div>
        </div>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={btn} style={btnStyle}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function OpcoesUnicas({
  opcoes, selecionada, onSelect, grid2 = false,
}: {
  opcoes: Opt[]; selecionada?: string; onSelect: (v: string) => void; grid2?: boolean;
}) {
  return (
    <div className={grid2 ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
      {opcoes.map(opt => {
        const ativo = selecionada === opt.value;
        return (
          <motion.button key={opt.value} whileTap={{ scale: 0.97 }} onClick={() => onSelect(opt.value)}
            className="flex items-center gap-3.5 p-4 rounded-xl text-left transition-all duration-300"
            style={{
              background: ativo ? "rgba(230,51,41,0.10)" : GLASS,
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${ativo ? RED : GLASS_BD}`,
              boxShadow: ativo ? `0 0 0 1px ${RED}55, 0 8px 24px ${RED}1f` : GLASS_SHADOW,
            }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${ativo ? `${RED}66` : GLASS_BD}` }}>
              <opt.Icon className="w-[18px] h-[18px]" style={{ color: ativo ? RED : "rgba(255,255,255,0.7)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-white font-semibold text-sm leading-tight block tracking-tight">{opt.label}</span>
              {opt.subtitulo && <span className="text-xs leading-tight block mt-0.5" style={{ color: MUTED }}>{opt.subtitulo}</span>}
            </div>
            {ativo && <Check className="w-4 h-4 shrink-0" style={{ color: RED }} />}
          </motion.button>
        );
      })}
    </div>
  );
}

// Postura com mini-spline de pressão (substitui ícone genérico no nó "posicao").
function OpcoesPostura({ opcoes, selecionada, onSelect }: {
  opcoes: Opt[]; selecionada?: string; onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {opcoes.map(opt => {
        const ativo = selecionada === opt.value;
        return (
          <motion.button key={opt.value} whileTap={{ scale: 0.97 }} onClick={() => onSelect(opt.value)}
            className="flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-300"
            style={{
              background: ativo ? "rgba(230,51,41,0.10)" : GLASS,
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${ativo ? RED : GLASS_BD}`,
              boxShadow: ativo ? `0 0 0 1px ${RED}55, 0 8px 24px ${RED}1f` : GLASS_SHADOW,
            }}>
            <span className="text-white font-semibold text-sm flex-1 tracking-tight">{opt.label}</span>
            <PressureLine variant={opt.value} active={ativo} />
            {ativo && <Check className="w-4 h-4 shrink-0" style={{ color: RED }} />}
          </motion.button>
        );
      })}
    </div>
  );
}

function CabecalhoPergunta({ Icon, titulo, subtitulo }: {
  Icon: React.ElementType; titulo: string; subtitulo?: string;
}) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <EyebrowChip Icon={Icon}>Diagnóstico</EyebrowChip>
      </div>
      <h2 className="text-center text-2xl font-bold text-white mb-2 leading-snug tracking-tight" style={{ letterSpacing: "-0.02em" }}>{titulo}</h2>
      {subtitulo ? <p className="text-center text-sm mb-6" style={{ color: MUTED }}>{subtitulo}</p> : <div className="mb-6" />}
    </>
  );
}

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 mb-5 text-sm font-semibold transition-colors" style={{ color: MUTED }}>
      <ChevronLeft className="w-4 h-4" /> Voltar
    </button>
  );
}

function BotaoPrincipal({ onClick, ativo = true, children }: {
  onClick: () => void; ativo?: boolean; children: React.ReactNode;
}) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} disabled={!ativo}
      className="mt-8 w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all duration-300"
      style={{
        background: ativo ? `linear-gradient(135deg, ${RED}, #c41f17)` : "rgba(255,255,255,0.06)",
        boxShadow: ativo ? `0 8px 24px rgba(230,51,41,0.4)` : "none",
        opacity: ativo ? 1 : 0.5, letterSpacing: "-0.01em",
      }}>
      {children}
    </motion.button>
  );
}

// ── Cabeçalho de painel (título técnico + badge de delta) ───────────────────────
function PanelHead({ children, badge, badgeColor = BLUE }: {
  children: React.ReactNode; badge?: string; badgeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>{children}</span>
      {badge && (
        <span className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md"
          style={{ color: badgeColor, background: `${badgeColor}1f`, border: `1px solid ${badgeColor}3a` }}>{badge}</span>
      )}
    </div>
  );
}

// Painel "Análise de conflitos biomecânicos" (matriz 2×2 com zona ativa).
function ConflitoPanel({ r }: { r: Respostas }) {
  const top = prioridades(r).slice().sort((a, b) => b.pct - a.pct)[0];
  return (
    <GlassCard className="px-5 pt-4 pb-3 mb-4" accent="blue">
      <PanelHead badge={top ? `+${top.pct}%` : undefined}>Análise de conflitos</PanelHead>
      <QuadrantMatrix r={r} />
    </GlassCard>
  );
}

// Painel "Mapa de prioridades ortopédicas" (radar + lista de índices).
function PrioridadesPanel({ r }: { r: Respostas }) {
  const dados = prioridades(r).slice().sort((a, b) => b.pct - a.pct);
  return (
    <GlassCard className="px-5 pt-4 pb-4 mb-4" accent="blue">
      <PanelHead badge="ao vivo">Mapa de prioridades</PanelHead>
      <div className="flex items-center gap-3">
        <div className="w-[46%] shrink-0"><RadarChart r={r} /></div>
        <ul className="flex-1 flex flex-col gap-2">
          {dados.map((d) => (
            <li key={d.label} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: BLUE, boxShadow: `0 0 5px ${BLUE}` }} />
              <span className="text-[11px] flex-1 leading-tight" style={{ color: "rgba(255,255,255,0.7)" }}>{d.label}</span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: "#fff" }}>{d.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </GlassCard>
  );
}

// Painel "Diagnóstico preliminar" (texto técnico por IMC).
function DiagnosticoPanel({ r }: { r: Respostas }) {
  return (
    <GlassCard className="px-5 py-4 mb-4">
      <PanelHead>Diagnóstico preliminar</PanelHead>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>{diagnosticoPreliminar(r)}</p>
    </GlassCard>
  );
}

// ── Biometria — DASHBOARD analítico (mockup: análise + prioridades + sliders) ───
// Os painéis recalculam ao vivo conforme os sliders mudam (merge respostas + estado local).
function Biometria({ pessoa, respostas, onContinuar }: {
  pessoa: "A" | "B"; respostas: Respostas; onContinuar: (patch: Partial<Respostas>) => void;
}) {
  const [idade, setIdade]   = useState(pessoa === "A" ? respostas.idadeA : respostas.idadeB);
  const [peso, setPeso]     = useState(pessoa === "A" ? respostas.pesoA : respostas.pesoB);
  const [altura, setAltura] = useState(pessoa === "A" ? respostas.alturaA : respostas.alturaB);
  const imcVal = peso / Math.pow((altura || 170) / 100, 2);

  // Perfil "ao vivo" para os gráficos refletirem o que está sendo arrastado agora.
  const liveR: Respostas = pessoa === "A"
    ? { ...respostas, idadeA: idade, pesoA: peso, alturaA: altura }
    : { ...respostas, idadeB: idade, pesoB: peso, alturaB: altura };

  return (
    <>
      {/* boneco biomecânico + leitura de IMC */}
      <GlassCard className="px-5 py-4 mb-4" accent="blue">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>Mapa biomecânico</span>
          <span className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md"
            style={{ color: BLUE, background: `${BLUE}1f`, border: `1px solid ${BLUE}3a` }}>IMC {imcVal.toFixed(1)}</span>
        </div>
        <BiomechanicalFigure />
      </GlassCard>

      {/* painéis analíticos ao vivo */}
      <ConflitoPanel r={liveR} />
      <PrioridadesPanel r={liveR} />
      <DiagnosticoPanel r={liveR} />

      {/* inputs biométricos */}
      <GlassCard className="px-5 py-5 mb-1">
        <PanelHead>Biometria</PanelHead>
        <NumberPicker label="Idade"  value={idade}  min={15}  max={90}  format={v => `${v} anos`} onChange={setIdade} />
        <NumberPicker label="Peso"   value={peso}   min={40}  max={180} format={v => `${v} kg`}   onChange={setPeso} />
        <NumberPicker label="Altura" value={altura} min={140} max={210} format={v => `${v} cm`}   onChange={setAltura} />
      </GlassCard>

      <BotaoPrincipal onClick={() =>
        onContinuar(pessoa === "A"
          ? { idadeA: idade, pesoA: peso, alturaA: altura }
          : { idadeB: idade, pesoB: peso, alturaB: altura })
      }>
        Continuar <ArrowRight className="w-4 h-4" />
      </BotaoPrincipal>
    </>
  );
}

// ── Multi (dores) — "nenhuma" exclusiva ─────────────────────────────────────────
function MultiEscolha({ opcoes, respostas, campo, onConfirmar }: {
  opcoes: Opt[]; respostas: Respostas; campo: keyof Respostas;
  onConfirmar: (patch: Partial<Respostas>) => void;
}) {
  const atual = (respostas[campo] as string[] | undefined) ?? [];
  const [sel, setSel] = useState<string[]>(atual);

  function toggle(val: string) {
    if (val === "nenhuma") { setSel(["nenhuma"]); return; }
    setSel(prev => {
      const sem = prev.filter(v => v !== "nenhuma");
      return sem.includes(val) ? sem.filter(v => v !== val) : [...sem, val];
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 mb-5">
        {opcoes.map(opt => {
          const ativo = sel.includes(opt.value);
          return (
            <motion.button key={opt.value} whileTap={{ scale: 0.97 }} onClick={() => toggle(opt.value)}
              className="flex items-center gap-3.5 p-4 rounded-xl text-left transition-all duration-300"
              style={{
                background: ativo ? "rgba(230,51,41,0.10)" : GLASS,
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                border: `1px solid ${ativo ? RED : GLASS_BD}`,
                boxShadow: ativo ? `0 0 0 1px ${RED}55, 0 8px 24px ${RED}1f` : GLASS_SHADOW,
              }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${ativo ? `${RED}66` : GLASS_BD}` }}>
                <opt.Icon className="w-[18px] h-[18px]" style={{ color: ativo ? RED : "rgba(255,255,255,0.55)" }} />
              </div>
              <span className="text-white font-semibold text-sm flex-1 tracking-tight">{opt.label}</span>
              {ativo && <Check className="w-4 h-4 shrink-0" style={{ color: RED }} />}
            </motion.button>
          );
        })}
      </div>
      <BotaoPrincipal ativo={sel.length > 0} onClick={() => {
        if (sel.length === 0) return;
        const valor = sel.filter(v => v !== "nenhuma");
        onConfirmar({ [campo]: valor } as Partial<Respostas>);
      }}>
        Confirmar <ArrowRight className="w-4 h-4" />
      </BotaoPrincipal>
    </>
  );
}

// ── Renderizador de um nó do grafo ──────────────────────────────────────────────
function RenderNo({ node, respostas, onResponder }: {
  node: QuestionNode; respostas: Respostas; onResponder: (patch: Partial<Respostas>) => void;
}) {
  const titulo = resolverTexto(node.titulo, respostas) ?? "";
  const subtitulo = resolverTexto(node.subtitulo, respostas);

  if (node.kind === "biometria") {
    return (
      <>
        <CabecalhoPergunta Icon={node.Icon} titulo={titulo} subtitulo={subtitulo} />
        <Biometria pessoa={node.pessoa ?? "A"} respostas={respostas} onContinuar={onResponder} />
      </>
    );
  }

  if (node.kind === "multi") {
    return (
      <>
        <CabecalhoPergunta Icon={node.Icon} titulo={titulo} subtitulo={subtitulo} />
        <MultiEscolha opcoes={resolverOpcoes(node, respostas)} respostas={respostas}
          campo={node.campo!} onConfirmar={onResponder} />
      </>
    );
  }

  // unica
  const selecionada = node.campo ? respostas[node.campo] : undefined;
  const onSelect = (v: string) => {
    const valor = node.coerce ? node.coerce(v) : v;
    onResponder({ [node.campo!]: valor } as Partial<Respostas>);
  };

  // Nó de postura ganha a matriz de conflitos + splines de pressão.
  if (node.id === "posicao") {
    return (
      <>
        <CabecalhoPergunta Icon={node.Icon} titulo={titulo} subtitulo={subtitulo} />
        <GlassCard className="px-5 pt-4 pb-3 mb-5" accent="blue">
          <span className="text-[11px] font-bold uppercase tracking-widest block mb-1" style={{ color: MUTED }}>
            Análise de conflitos biomecânicos
          </span>
          <QuadrantMatrix r={respostas} />
        </GlassCard>
        <OpcoesPostura opcoes={resolverOpcoes(node, respostas)}
          selecionada={selecionada === undefined ? undefined : String(selecionada)} onSelect={onSelect} />
      </>
    );
  }

  return (
    <>
      <CabecalhoPergunta Icon={node.Icon} titulo={titulo} subtitulo={subtitulo} />
      <OpcoesUnicas
        opcoes={resolverOpcoes(node, respostas)}
        selecionada={selecionada === undefined ? undefined : String(selecionada)}
        grid2={node.grid2}
        onSelect={onSelect}
      />
    </>
  );
}

// ── Resultado ───────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <GlassCard className="overflow-hidden mb-5 animate-pulse">
      <div className="w-full h-44" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="px-5 py-5 space-y-3">
        <div className="h-3 w-1/3 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="h-5 w-2/3 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="h-4 w-1/4 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    </GlassCard>
  );
}

function FaseResultado({ state, waUrl, onWhatsApp, onVoltar }: {
  state: EngineState; waUrl: string; onWhatsApp: () => void; onVoltar: () => void;
}) {
  const { resultado, resultadoCarregando, respostas } = state;
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
  const travesseiro = travesseiroSugerido(respostas);

  return (
    <div className="flex flex-col">
      <div className="px-6 pb-8 pt-5">
        <BotaoVoltar onClick={onVoltar} />

        <div className="flex flex-col items-center text-center mb-6">
          <EyebrowChip Icon={ShieldCheck} color={RED}>Diagnóstico concluído</EyebrowChip>
          <h2 className="text-2xl font-bold text-white mt-3 mb-1 tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            Engenharia do seu sono
          </h2>
          {resultado && resultado.firmezaIndicada && (
            <p className="text-sm" style={{ color: MUTED }}>
              Firmeza indicada: <span className="font-bold text-white">{resultado.firmezaIndicada}</span>
            </p>
          )}
        </div>

        {resultadoCarregando && mostrarSkeleton && <SkeletonCard />}

        {semProdutos && (
          <GlassCard className="p-6 text-center mb-5">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,145,255,0.10)", border: `1px solid ${BLUE}44` }}>
                <MessageCircle className="w-6 h-6" style={{ color: BLUE }} />
              </div>
            </div>
            <p className="text-white font-bold text-lg mb-1 tracking-tight">Fale com um especialista</p>
            <p className="text-sm" style={{ color: MUTED }}>
              Recebemos seu perfil de descanso. Nossa equipe vai indicar pessoalmente o colchão ideal para você.
            </p>
          </GlassCard>
        )}

        {resultado?.origem === "emergencia" && ranking.length > 0 && (
          <GlassCard className="px-4 py-3 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
              Estes produtos têm compatibilidade moderada com seu perfil.
              Recomendamos conversar com um especialista para refinar a escolha.
            </p>
          </GlassCard>
        )}

        {top && (
          <>
            <GlassCard className="overflow-hidden mb-4" accent="red">
              {top.imagem && (
                <div className="w-full h-44 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <img src={top.imagem} alt={top.nome} className="w-full h-full object-contain" loading="lazy" />
                </div>
              )}
              <div className="px-5 py-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Recomendação principal</span>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full"
                    style={{ background: "rgba(230,51,41,0.12)", color: RED, border: `1px solid ${RED}55` }}>{top.classificacao}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1 leading-tight tracking-tight">{top.nome}</h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold tracking-tight" style={{ color: RED }}>{top.score}%</span>
                  <span className="text-xs font-semibold" style={{ color: MUTED }}>de compatibilidade</span>
                </div>
                {top.precoPix && <p className="text-lg font-bold mb-3" style={{ color: RED }}>{top.precoPix} no Pix</p>}
                {/* grade de specs de engenharia */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    ["Firmeza", resultado?.firmezaIndicada || "—"],
                    ["Compatib.", `${top.score}%`],
                    ["Medida", respostas.tamanho ? respostas.tamanho[0].toUpperCase() + respostas.tamanho.slice(1) : (top.size || "—")],
                    ["Perfil", `${respostas.pesoA}kg · ${respostas.alturaA}cm`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GLASS_BD}` }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>{k}</p>
                      <p className="text-xs font-bold text-white truncate tracking-tight">{v}</p>
                    </div>
                  ))}
                </div>
                {top.justificativa && (
                  <p className="text-sm mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{top.justificativa}</p>
                )}
                <div className="flex flex-col gap-2">
                  {top.motivos.map(m => (
                    <div key={m} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                      <Check className="w-4 h-4 shrink-0" style={{ color: RED }} />{m}
                    </div>
                  ))}
                </div>
                {top.avisos && top.avisos.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {top.avisos.map(a => (
                      <div key={a} className="flex items-start gap-2 rounded-lg px-3 py-2"
                        style={{ background: "rgba(212,162,0,0.08)", border: "1px solid rgba(212,162,0,0.25)" }}>
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#d4a200" }} />
                        <p className="text-xs leading-snug" style={{ color: "#d8b94a" }}>{a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </>
        )}

        {outros.length > 0 && (
          <>
            <span className="text-[11px] font-bold uppercase tracking-widest block mb-3" style={{ color: MUTED }}>Alternativas de engenharia</span>
            <div className="flex flex-col gap-3 mb-5">
              {outros.map(item => (
                <GlassCard key={item.produtoId} className="px-4 py-4 flex items-center gap-4">
                  {item.imagem && (
                    <img src={item.imagem} alt={item.nome} className="w-14 h-14 rounded-lg object-contain shrink-0"
                      style={{ background: "rgba(255,255,255,0.03)" }} loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(0,145,255,0.10)", color: BLUE, border: `1px solid ${BLUE}44` }}>
                      {CATEGORIA_LABEL[item.categoria]}
                    </span>
                    <p className="text-white font-semibold text-sm leading-tight truncate mt-1.5 tracking-tight">{item.nome}</p>
                    {item.precoPix && <p className="text-sm font-bold mt-1" style={{ color: RED }}>{item.precoPix}</p>}
                    {item.avisos && item.avisos.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "#d4a200" }} />
                        <p className="text-[10px] leading-tight" style={{ color: "#d8b94a" }}>{item.avisos[0]}</p>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-bold text-white tracking-tight">{item.score}%</p>
                    <p className="text-[10px]" style={{ color: MUTED }}>{item.classificacao}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}

        {travesseiro && (
          <div className="block mb-5">
            <GlassCard className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GLASS_BD}` }}>
                <BedDouble className="w-5 h-5" style={{ color: BLUE }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Complemento sugerido</p>
                <p className="text-white font-semibold text-sm leading-tight truncate tracking-tight">{travesseiro.nome}</p>
              </div>
            </GlassCard>
          </div>
        )}

        {!resultadoCarregando && resultado !== null && (
          <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp}
            className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-transform active:scale-95"
            style={{ background: "#25D366", boxShadow: "0 8px 24px rgba(37,211,102,0.35)", letterSpacing: "-0.01em" }}>
            <MessageCircle className="w-5 h-5" /> Falar com especialista no WhatsApp
          </a>
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
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "#25D366", boxShadow: "0 8px 28px rgba(37,211,102,0.4)" }}>
        <Check className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight" style={{ letterSpacing: "-0.02em" }}>Tudo certo!</h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: MUTED }}>
        Abrimos o WhatsApp para você falar com um especialista. Se a janela não abriu, toque no botão abaixo.
      </p>
      <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={onReabrirWA}
        className="flex items-center justify-center gap-2.5 w-full max-w-xs py-4 rounded-xl font-bold text-white text-base mb-3 transition-transform active:scale-95"
        style={{ background: "#25D366", boxShadow: "0 8px 24px rgba(37,211,102,0.35)" }}>
        <MessageCircle className="w-5 h-5" /> Abrir WhatsApp
      </a>
      <button onClick={onReiniciar} className="w-full max-w-xs py-3 rounded-xl text-sm font-semibold" style={{ color: MUTED }}>
        Refazer o diagnóstico
      </button>
    </div>
  );
}

// ── Welcome (somente página, não embedded) ──────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-8"><Wordmark /></div>
      <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: BLUE }}>Diagnóstico inteligente</p>
      <h1 className="text-4xl font-bold text-white mb-3 leading-[1.1] tracking-tight" style={{ letterSpacing: "-0.03em" }}>
        Entenda seu sono.<br /><span style={{ color: MUTED }}>Transforme seus dias.</span>
      </h1>
      <p className="text-base mb-8 max-w-sm" style={{ color: MUTED }}>
        Recomendações personalizadas com base na sua biomecânica — engenharia do sono para o seu corpo descansar de verdade.
      </p>
      <div className="flex flex-col gap-2.5 mb-10 w-full max-w-xs text-left">
        {[
          { Icon: Activity, t: "Análise biomecânica · Perfil do seu corpo" },
          { Icon: ShieldCheck, t: "Baseado em dados · Recomendação técnica" },
          { Icon: Wind, t: "100% online · Leva menos de 2 minutos" },
        ].map(({ Icon, t }) => (
          <div key={t} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GLASS_BD}` }}>
              <Icon className="w-3.5 h-3.5" style={{ color: BLUE }} />
            </div>
            {t}
          </div>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }} onClick={onStart}
        className="w-full max-w-xs py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2"
        style={{ background: `linear-gradient(135deg, ${RED}, #c41f17)`, boxShadow: `0 8px 24px rgba(230,51,41,0.4)`, letterSpacing: "-0.01em" }}>
        Fazer meu diagnóstico <ArrowRight className="w-4 h-4" />
      </motion.button>
      <p className="text-[11px] mt-5 tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>PORQUE AMANHÃ COMEÇA HOJE.</p>
    </div>
  );
}

// ── Fundo técnico (gradiente radial azul + grid de linhas) ──────────────────────
function BackdropFX() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 28%, rgba(0,145,255,0.15) 0%, transparent 60%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 120%, rgba(0,145,255,0.10) 0%, transparent 55%)" }} />
      <div className="absolute inset-0 opacity-[0.4]" style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "radial-gradient(circle at 50% 40%, #000 0%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 40%, #000 0%, transparent 75%)",
      }} />
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function MapaSono({ embedded = false }: MapaSonoProps) {
  const { lojaId, lojaInfo } = useLoja();
  const waNumero = lojaInfo?.whatsappNumero?.replace(/\D/g, "") || WA_NUMERO_PADRAO;
  const [mostrarWelcome, setMostrarWelcome] = useState(!embedded);
  const [state, dispatch] = useReducer(engineReducer, undefined, estadoInicial);

  const sessionId = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ms-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
  );

  // first-click-wins nas etapas de clique único (autoAvanca)
  const autoTimer = useRef<number | null>(null);
  const pendingPatch = useRef<Partial<Respostas> | null>(null);
  const buscou = useRef(false);

  useEffect(() => () => { if (autoTimer.current !== null) window.clearTimeout(autoTimer.current); }, []);

  const emitir = (evento: EventoFunil, payload?: Record<string, unknown>) =>
    emitirEventoFunil(evento, lojaId, sessionId.current, payload);

  // step_view a cada transição visível
  useEffect(() => {
    if (mostrarWelcome) return;
    if (state.fase === "questionario") emitir("step_view", { node: state.nodeId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nodeId, state.fase, mostrarWelcome]);

  // Calcular resultado ao entrar na fase de resultado
  function gerarResultado(respostas: Respostas) {
    buscarCompatibilidade(montarPayloadCompat(respostas), lojaId)
      .then(resultado => {
        dispatch({ type: "RESULTADO_OK", resultado });
        emitir("resultado_exibido", {
          top: resultado.ranking[0]?.nome ?? null,
          score: resultado.ranking[0]?.score ?? null,
          itens: resultado.ranking.length,
          respostas,
        });
      })
      .catch(() => {
        dispatch({ type: "RESULTADO_ERRO" });
        emitir("resultado_exibido", { top: null, score: null, itens: 0, erro: true, respostas });
      });
  }

  useEffect(() => {
    if (state.fase === "resultado") {
      if (!buscou.current && state.resultadoCarregando) { buscou.current = true; gerarResultado(state.respostas); }
    } else {
      buscou.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fase, state.resultadoCarregando]);

  function aoResponder(patch: Partial<Respostas>) {
    const node = noPorId(state.nodeId);
    emitir("step_complete", { node: state.nodeId });
    if (node?.autoAvanca) {
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (autoTimer.current === null) {
        autoTimer.current = window.setTimeout(() => {
          autoTimer.current = null;
          const p = pendingPatch.current; pendingPatch.current = null;
          if (p) dispatch({ type: "RESPONDER", patch: p });
        }, 240);
      }
    } else {
      dispatch({ type: "RESPONDER", patch });
    }
  }

  function voltar() {
    if (autoTimer.current !== null) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    pendingPatch.current = null;
    dispatch({ type: "VOLTAR" });
  }

  function aoWhatsApp() {
    trackWhatsAppClick("mapa_sono_lead", "Cabo Frio");
    emitir("whatsapp_aberto", { respostas: state.respostas, top: state.resultado?.ranking[0]?.nome ?? null });
    dispatch({ type: "FINALIZAR" });
  }

  function reiniciar() {
    pendingPatch.current = null;
    if (autoTimer.current !== null) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    dispatch({ type: "REINICIAR" });
  }

  const node = noPorId(state.nodeId);
  const { step, total } = progresso(state);
  const waUrl = buildWAUrl(state.respostas, state.resultado, waNumero);

  const chaveTela =
    state.fase === "questionario" ? `q-${state.nodeId}` : state.fase;

  const outerClass = embedded ? "relative flex flex-col overflow-hidden" : "relative flex flex-col min-h-screen overflow-hidden";

  return (
    <div className={outerClass} style={{ background: BG }}>
      <BackdropFX />
      <div className="relative z-10 flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {mostrarWelcome && (
            <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <WelcomeScreen onStart={() => setMostrarWelcome(false)} />
            </motion.div>
          )}

          {!mostrarWelcome && (
            <motion.div key={chaveTela}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }} className="flex-1 flex flex-col">

              {state.fase === "questionario" && node && (
                <div className="flex flex-col">
                  <ProgressHeader step={step} total={total} />
                  <div className="px-5 pb-6">
                    {podeVoltar(state) && <BotaoVoltar onClick={voltar} />}
                    <RenderNo node={node} respostas={state.respostas} onResponder={aoResponder} />
                  </div>
                </div>
              )}

              {state.fase === "resultado" && (
                <FaseResultado state={state} waUrl={waUrl} onWhatsApp={aoWhatsApp} onVoltar={voltar} />
              )}

              {state.fase === "finalizado" && (
                <Finalizado waUrl={waUrl} onReiniciar={reiniciar}
                  onReabrirWA={() => emitir("whatsapp_aberto", { reaberto: true })} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
