import { useEffect, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, MessageCircle, BedDouble } from "lucide-react";
import { trackWhatsAppClick } from "@/lib/tracking";
import { useLoja } from "@/contexts/LojaContext";
import {
  engineReducer, estadoInicial, noPorId, progresso, podeVoltar,
  resolverTexto, resolverOpcoes, projetarPerfilMotor,
  type EngineState, type PerfilMotor,
} from "./mapa-sono/engine";
import type {
  Respostas, ResultadoCompatibilidade, Categoria, Opt, QuestionNode, Dor,
} from "./mapa-sono/types";

export interface MapaSonoProps { embedded?: boolean; }

// ── Design tokens (identidade visual intocada) ─────────────────────────────────
const BG     = "#0c0c0c";
const CARD   = "#140000";
const BORDER = "#2a0808";
const RED    = "#C41230";

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

// ── Motor v2 (backend) ──────────────────────────────────────────────────────────
async function buscarCompatibilidade(
  perfil: PerfilMotor, lojaId: number,
): Promise<ResultadoCompatibilidade> {
  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch("/api/mapa-sono/compatibilidade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ ...perfil, lojaId }),
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
function travesseiroSugerido(r: Respostas): { nome: string; url: string } | null {
  if (r.contexto !== "constante") return null;
  if (r.dores.includes("cervical") || r.dores.includes("ombro"))
    return {
      nome: "Travesseiro Viscosoft Hot & Cold",
      url: "https://lojacastor.com.br/travesseiros-castor/travesseiros-castor-viscosoft",
    };
  if (r.dores.includes("joelho") || r.dores.includes("quadril") || r.gestante)
    return {
      nome: "Travesseiro de Corpo 140x40cm",
      url: "https://lojacastor.com.br/travesseiro-castor-de-corpo-140x40x22cm",
    };
  return null;
}

// ── Mensagem do WhatsApp — perfil completo + recomendação ───────────────────────
function buildWAUrl(r: Respostas, resultado: ResultadoCompatibilidade | null, waNumero: string): string {
  const L: string[] = ["Olá! Fiz o Mapa do Sono e gostaria de saber mais.", "", "📋 MEU PERFIL:"];
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

// ── Componentes visuais (identidade intocada) ───────────────────────────────────
function ProgressHeader({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <div className="px-5 pt-5 pb-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "#777" }}>{step + 1} / {total}</span>
        <span className="text-xs font-semibold" style={{ color: "#777" }}>{pct}%</span>
      </div>
      <div className="h-1 rounded-full" style={{ background: "#1e0000" }}>
        <motion.div className="h-1 rounded-full" style={{ background: RED }}
          initial={false} animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }} />
      </div>
    </div>
  );
}

function NumberPicker({
  value, min, max, format, onChange,
}: {
  value: number; min: number; max: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const ticks = Array.from({ length: 11 }, (_, i) => ({
    i, left: i * 10, major: i % 2 === 0, v: Math.round(min + (i / 10) * (max - min)),
  }));
  return (
    <div className="px-6">
      <div className="flex items-center justify-center gap-6 mb-6">
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min} className="w-12 h-12 rounded-full flex items-center justify-center text-white"
          style={{ background: CARD, border: `1.5px solid ${BORDER}` }}>
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
        <AnimatePresence mode="wait">
          <motion.div key={value} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.12 }}
            className="text-5xl font-black text-white tracking-tight min-w-[170px] text-center">
            {format(value)}
          </motion.div>
        </AnimatePresence>
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max} className="w-12 h-12 rounded-full flex items-center justify-center text-white"
          style={{ background: CARD, border: `1.5px solid ${BORDER}` }}>
          <ChevronRight className="w-6 h-6" />
        </motion.button>
      </div>
      <div className="relative h-9">
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: "#2a2a2a" }} />
        <motion.div className="absolute top-0 left-0 h-px" style={{ background: RED }}
          animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
        <motion.div className="absolute -top-1.5" animate={{ left: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }} style={{ transform: "translateX(-50%)" }}>
          <div className="w-3.5 h-3.5 rounded-full" style={{ background: RED, boxShadow: `0 0 10px ${RED}99` }} />
        </motion.div>
        {ticks.map(({ left, major, v, i }) => (
          <div key={i} className="absolute flex flex-col items-center" style={{ left: `${left}%`, transform: "translateX(-50%)" }}>
            <div style={{ width: 1, height: major ? 14 : 7, background: left <= pct ? RED : "#3a3a3a" }} />
            {major && <span className="text-[9px] mt-0.5 whitespace-nowrap" style={{ color: "#555" }}>{v}</span>}
          </div>
        ))}
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
      {opcoes.map(opt => (
        <motion.button key={opt.value} whileTap={{ scale: 0.97 }} onClick={() => onSelect(opt.value)}
          className="flex items-center gap-3 p-4 rounded-xl border text-left transition-all"
          style={{
            background: selecionada === opt.value ? "#1e0000" : CARD,
            borderColor: selecionada === opt.value ? RED : BORDER,
          }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#0a0000", border: `1px solid ${BORDER}` }}>
            <opt.Icon className="w-4 h-4" style={{ color: RED }} />
          </div>
          <div className="min-w-0">
            <span className="text-white font-semibold text-sm leading-tight block">{opt.label}</span>
            {opt.subtitulo && <span className="text-xs leading-tight block mt-0.5" style={{ color: "#777" }}>{opt.subtitulo}</span>}
          </div>
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
      {subtitulo ? <p className="text-center text-sm mb-6" style={{ color: "#888" }}>{subtitulo}</p> : <div className="mb-6" />}
    </>
  );
}

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 mb-5 text-sm font-semibold" style={{ color: "#666" }}>
      <ChevronLeft className="w-4 h-4" /> Voltar
    </button>
  );
}

function BotaoPrincipal({ onClick, ativo = true, children }: {
  onClick: () => void; ativo?: boolean; children: React.ReactNode;
}) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      className="mt-8 w-full py-4 rounded-2xl font-extrabold text-white text-base"
      style={{ background: ativo ? RED : "#2a0808", opacity: ativo ? 1 : 0.5 }}>
      {children}
    </motion.button>
  );
}

// ── Biometria — idade / peso / altura (1 pessoa) ────────────────────────────────
function Biometria({ pessoa, respostas, onContinuar }: {
  pessoa: "A" | "B"; respostas: Respostas; onContinuar: (patch: Partial<Respostas>) => void;
}) {
  const [idade, setIdade]   = useState(pessoa === "A" ? respostas.idadeA : respostas.idadeB);
  const [peso, setPeso]     = useState(pessoa === "A" ? respostas.pesoA : respostas.pesoB);
  const [altura, setAltura] = useState(pessoa === "A" ? respostas.alturaA : respostas.alturaB);

  const rotulo = (t: string) => (
    <p className="text-center text-xs font-bold uppercase tracking-wider mb-3 mt-6 first:mt-0" style={{ color: "#777" }}>{t}</p>
  );

  return (
    <>
      {rotulo("Idade")}
      <NumberPicker value={idade} min={15} max={90} format={v => `${v} anos`} onChange={setIdade} />
      {rotulo("Peso")}
      <NumberPicker value={peso} min={40} max={180} format={v => `${v} kg`} onChange={setPeso} />
      {rotulo("Altura")}
      <NumberPicker value={altura} min={140} max={210} format={v => `${v} cm`} onChange={setAltura} />
      <BotaoPrincipal onClick={() =>
        onContinuar(pessoa === "A"
          ? { idadeA: idade, pesoA: peso, alturaA: altura }
          : { idadeB: idade, pesoB: peso, alturaB: altura })
      }>
        Continuar →
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
              className="flex items-center gap-3 p-4 rounded-xl border text-left"
              style={{ background: ativo ? "#1e0000" : CARD, borderColor: ativo ? RED : BORDER }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "#0a0000", border: `1px solid ${BORDER}` }}>
                <opt.Icon className="w-4 h-4" style={{ color: ativo ? RED : "#555" }} />
              </div>
              <span className="text-white font-semibold text-sm flex-1">{opt.label}</span>
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
        Confirmar →
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
  return (
    <>
      <CabecalhoPergunta Icon={node.Icon} titulo={titulo} subtitulo={subtitulo} />
      <OpcoesUnicas
        opcoes={resolverOpcoes(node, respostas)}
        selecionada={selecionada === undefined ? undefined : String(selecionada)}
        grid2={node.grid2}
        onSelect={(v) => {
          const valor = node.coerce ? node.coerce(v) : v;
          onResponder({ [node.campo!]: valor } as Partial<Respostas>);
        }}
      />
    </>
  );
}

// ── Resultado ───────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden mb-5 animate-pulse" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="w-full h-44" style={{ background: "#1a0505" }} />
      <div className="px-5 py-5 space-y-3">
        <div className="h-3 w-1/3 rounded" style={{ background: "#1e0808" }} />
        <div className="h-5 w-2/3 rounded" style={{ background: "#1e0808" }} />
        <div className="h-4 w-1/4 rounded" style={{ background: "#1e0808" }} />
      </div>
    </div>
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
  const frases = frasesConcordancia(respostas);
  const travesseiro = travesseiroSugerido(respostas);

  return (
    <div className="flex flex-col" style={{ background: BG }}>
      <div className="px-6 pb-8 pt-5">
        <BotaoVoltar onClick={onVoltar} />

        <div className="text-center mb-6">
          <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: RED }}>Diagnóstico concluído</p>
          <h2 className="text-2xl font-black text-white mb-2">Sua recomendação de descanso</h2>
          {resultado && resultado.firmezaIndicada && (
            <p className="text-sm" style={{ color: "#888" }}>
              Firmeza indicada: <span className="font-bold" style={{ color: "#aaa" }}>{resultado.firmezaIndicada}</span>
            </p>
          )}
        </div>

        {/* Bloco de concordância (SIM, SIM, SIM) */}
        {frases.length > 0 && (
          <div className="rounded-xl px-4 py-4 mb-5" style={{ background: "#0e0e0e", border: "1px solid #1e1e1e" }}>
            {frases.map(f => (
              <div key={f} className="flex items-start gap-2 mb-2 last:mb-0">
                <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: RED }} />
                <p className="text-xs" style={{ color: "#aaa" }}>{f}</p>
              </div>
            ))}
            <p className="text-xs mt-3 pt-3" style={{ color: "#666", borderTop: "1px solid #1e1e1e" }}>
              Cruzamos seu perfil com todo o catálogo. Esta é a recomendação para o seu corpo.
            </p>
          </div>
        )}

        {resultadoCarregando && mostrarSkeleton && <SkeletonCard />}

        {semProdutos && (
          <div className="rounded-2xl p-6 text-center mb-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="text-4xl mb-3">💬</div>
            <p className="text-white font-black text-lg mb-1">Fale com um especialista</p>
            <p className="text-sm" style={{ color: "#888" }}>
              Recebemos seu perfil de descanso. Nossa equipe vai indicar pessoalmente o colchão ideal para você.
            </p>
          </div>
        )}

        {top && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: CARD, border: `1.5px solid ${RED}` }}>
            {top.imagem && (
              <div className="w-full h-44 overflow-hidden" style={{ background: "#0e0e0e" }}>
                <img src={top.imagem} alt={top.nome} className="w-full h-full object-contain" loading="lazy" />
              </div>
            )}
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#666" }}>Recomendação principal</p>
                <span className="text-xs font-black px-3 py-1 rounded-full"
                  style={{ background: "#1e0000", color: RED, border: `1px solid ${BORDER}` }}>{top.classificacao}</span>
              </div>
              <h3 className="text-xl font-black text-white mb-1 leading-tight">{top.nome}</h3>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-black" style={{ color: RED }}>{top.score}%</span>
                <span className="text-xs font-semibold" style={{ color: "#777" }}>de compatibilidade</span>
              </div>
              {top.precoPix && <p className="text-lg font-extrabold mb-3" style={{ color: RED }}>{top.precoPix} no Pix</p>}
              <div className="flex flex-col gap-2">
                {top.motivos.map(m => (
                  <div key={m} className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
                    <Check className="w-4 h-4 shrink-0" style={{ color: RED }} />{m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {outros.length > 0 && (
          <>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#555" }}>Alternativas</p>
            <div className="flex flex-col gap-3 mb-5">
              {outros.map(item => (
                <div key={item.produtoId} className="rounded-xl px-4 py-4 flex items-center gap-4"
                  style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  {item.imagem && (
                    <img src={item.imagem} alt={item.nome} className="w-14 h-14 rounded-lg object-contain shrink-0"
                      style={{ background: "#0e0e0e" }} loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: "#1e0000", color: RED, border: `1px solid ${BORDER}` }}>
                      {CATEGORIA_LABEL[item.categoria]}
                    </span>
                    <p className="text-white font-bold text-sm leading-tight truncate mt-1.5">{item.nome}</p>
                    {item.precoPix && <p className="text-sm font-extrabold mt-1" style={{ color: RED }}>{item.precoPix}</p>}
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

        {travesseiro && (
          <a href={travesseiro.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5" style={{ background: "#0e0e0e", border: "1px solid #1e1e1e" }}>
            <div className="text-2xl">🛌</div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Complemento sugerido</p>
              <p className="text-white font-bold text-sm leading-tight truncate">{travesseiro.nome}</p>
            </div>
          </a>
        )}

        {!resultadoCarregando && resultado !== null && (
          <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={onWhatsApp}
            className="w-full py-4 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-2"
            style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}>
            <MessageCircle className="w-5 h-5" /> Falar com especialista no WhatsApp →
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
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center" style={{ background: BG }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: "#25D366", boxShadow: "0 4px 24px rgba(37,211,102,0.35)" }}>
        <Check className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-black text-white mb-2">Tudo certo!</h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: "#888" }}>
        Abrimos o WhatsApp para você falar com um especialista. Se a janela não abriu, toque no botão abaixo.
      </p>
      <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={onReabrirWA}
        className="flex items-center justify-center gap-2.5 w-full max-w-xs py-4 rounded-2xl font-extrabold text-white text-base mb-3"
        style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}>
        <MessageCircle className="w-5 h-5" /> Abrir WhatsApp
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
      <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: RED }}>Diagnóstico Gratuito</p>
      <h1 className="text-4xl font-black text-white mb-3 leading-tight">
        Mapa do Sono<br /><span style={{ color: "#aaa" }}>Castor</span>
      </h1>
      <p className="text-base mb-8 max-w-sm" style={{ color: "#888" }}>
        Responda algumas perguntas rápidas e descubra os colchões com maior compatibilidade com o seu corpo.
      </p>
      <div className="flex flex-col gap-2 mb-10 w-full max-w-xs text-left">
        {["100% Online · Leva menos de 2 minutos", "Personalizado · Baseado no seu perfil de descanso", "Gratuito · Sem compromisso"].map(t => (
          <div key={t} className="flex items-center gap-3 text-sm" style={{ color: "#666" }}>
            <Check className="w-4 h-4 shrink-0" style={{ color: RED }} /> {t}
          </div>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }} onClick={onStart}
        className="w-full max-w-xs py-4 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-2"
        style={{ background: RED, boxShadow: `0 4px 24px ${RED}55` }}>
        Começar diagnóstico →
      </motion.button>
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
    buscarCompatibilidade(projetarPerfilMotor(respostas), lojaId)
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

  const outerClass = embedded ? "flex flex-col" : "flex flex-col min-h-screen";

  return (
    <div className={outerClass} style={{ background: BG }}>
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
              <div className="flex flex-col" style={{ background: BG }}>
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
  );
}
