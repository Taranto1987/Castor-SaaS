import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, RotateCcw, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  estrategia: { continuidade: boolean; migracao: boolean; upgrade: boolean };
}

interface Step {
  id: keyof UserProfile;
  pergunta: string;
  tipo: "single" | "multi";
  opcoes: { label: string; value: string; emoji?: string }[];
}

// ─── FLUXO ──────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "finalidade",
    pergunta: "Para qual uso é o colchão?",
    tipo: "single",
    opcoes: [
      { label: "Uso diário (casa principal)", value: "diario", emoji: "🏠" },
      { label: "Casa de praia / temporada", value: "praia", emoji: "🏖️" },
      { label: "Uso ocasional (quarto extra)", value: "ocasional", emoji: "🛏️" },
    ],
  },
  {
    id: "biotipo",
    pergunta: "Qual é o seu biotipo?",
    tipo: "single",
    opcoes: [
      { label: "Leve (até 60 kg)", value: "leve", emoji: "🪶" },
      { label: "Médio (60–90 kg)", value: "medio", emoji: "⚖️" },
      { label: "Pesado (acima de 90 kg)", value: "pesado", emoji: "💪" },
    ],
  },
  {
    id: "posicao",
    pergunta: "Como você costuma dormir?",
    tipo: "single",
    opcoes: [
      { label: "De lado", value: "lado", emoji: "↔️" },
      { label: "De barriga para cima", value: "costas", emoji: "⬆️" },
      { label: "De bruços", value: "brucos", emoji: "⬇️" },
      { label: "Mudo muito durante a noite", value: "variado", emoji: "🔄" },
    ],
  },
  {
    id: "dores",
    pergunta: "Você sente dores ao acordar? (pode marcar mais de uma)",
    tipo: "multi",
    opcoes: [
      { label: "Não sinto dores", value: "nenhuma", emoji: "✅" },
      { label: "Dor nas costas / coluna", value: "coluna", emoji: "🦴" },
      { label: "Dor no quadril", value: "quadril", emoji: "🦵" },
      { label: "Dor nos ombros / pescoço", value: "ombros", emoji: "💆" },
      { label: "Pressão nos pontos de contato", value: "pressao", emoji: "⚠️" },
    ],
  },
  {
    id: "temperatura",
    pergunta: "Como você se sente durante a noite?",
    tipo: "single",
    opcoes: [
      { label: "Esquento muito (sudo fácil)", value: "quente", emoji: "🔥" },
      { label: "Fico na temperatura certa", value: "normal", emoji: "😊" },
      { label: "Tenho frio à noite", value: "frio", emoji: "🥶" },
    ],
  },
  {
    id: "casal",
    pergunta: "Você vai dormir sozinho ou acompanhado?",
    tipo: "single",
    opcoes: [
      { label: "Sozinho(a)", value: "sozinho", emoji: "🧍" },
      { label: "Casal — pesos similares", value: "casal_similar", emoji: "👫" },
      { label: "Casal — pesos bem diferentes", value: "casal_diferente", emoji: "⚖️" },
      { label: "Com filho(s) pequeno(s)", value: "familia", emoji: "👨‍👩‍👧" },
    ],
  },
  {
    id: "firmeza",
    pergunta: "Qual firmeza você prefere?",
    tipo: "single",
    opcoes: [
      { label: "Muito firme — gosto de sentir resistência", value: "muito_firme", emoji: "🪨" },
      { label: "Firme — suporte bom sem ser duro", value: "firme", emoji: "👍" },
      { label: "Médio — equilíbrio entre firme e macio", value: "medio", emoji: "🎯" },
      { label: "Macio — afundo um pouco e abraço o corpo", value: "macio", emoji: "☁️" },
    ],
  },
  {
    id: "peso",
    pergunta: "Qual é o seu peso aproximado?",
    tipo: "single",
    opcoes: [
      { label: "Até 50 kg", value: "ate50", emoji: "" },
      { label: "50–70 kg", value: "50a70", emoji: "" },
      { label: "70–90 kg", value: "70a90", emoji: "" },
      { label: "90–110 kg", value: "90a110", emoji: "" },
      { label: "Acima de 110 kg", value: "acima110", emoji: "" },
    ],
  },
  {
    id: "altura",
    pergunta: "Qual é a sua altura?",
    tipo: "single",
    opcoes: [
      { label: "Até 1,60 m", value: "ate160", emoji: "" },
      { label: "1,60 – 1,75 m", value: "160a175", emoji: "" },
      { label: "1,75 – 1,90 m", value: "175a190", emoji: "" },
      { label: "Acima de 1,90 m", value: "acima190", emoji: "" },
    ],
  },
  {
    id: "idade",
    pergunta: "Qual é a sua faixa de idade?",
    tipo: "single",
    opcoes: [
      { label: "Até 18 anos", value: "menor18", emoji: "🎒" },
      { label: "18 – 35 anos", value: "18a35", emoji: "🏃" },
      { label: "35 – 55 anos", value: "35a55", emoji: "🧑" },
      { label: "Acima de 55 anos", value: "acima55", emoji: "🧓" },
    ],
  },
  {
    id: "alergia",
    pergunta: "Você tem alguma sensibilidade ou alergia?",
    tipo: "single",
    opcoes: [
      { label: "Não tenho alergias", value: "nenhuma", emoji: "✅" },
      { label: "Rinite / Asma (pó, ácaro)", value: "rinite", emoji: "🤧" },
      { label: "Pele sensível", value: "pele", emoji: "🧴" },
      { label: "Não sei ao certo", value: "nao_sei", emoji: "❓" },
    ],
  },
  {
    id: "durabilidade",
    pergunta: "Quanto tempo você quer que dure?",
    tipo: "single",
    opcoes: [
      { label: "Curto prazo (1–3 anos)", value: "curto", emoji: "📅" },
      { label: "Médio prazo (3–7 anos)", value: "medio", emoji: "📆" },
      { label: "Longo prazo (7–10+ anos)", value: "longo", emoji: "♾️" },
    ],
  },
  {
    id: "historico",
    pergunta: "Qual é o seu colchão atual / anterior?",
    tipo: "single",
    opcoes: [
      { label: "Colchão de mola", value: "mola", emoji: "🌀" },
      { label: "Colchão de espuma / viscoelástico", value: "espuma", emoji: "🧽" },
      { label: "Dormia em cama de madeira / estrado", value: "madeira", emoji: "🪵" },
      { label: "Nunca tive colchão bom / não lembro", value: "nenhum", emoji: "❓" },
    ],
  },
];

// ─── MOTOR DE DECISÃO ────────────────────────────────────────────────────────

function calcularResultado(p: UserProfile): Resultado {
  let scoreMola = 0;
  let scoreEspuma = 0;

  // Biotipo
  if (p.biotipo === "pesado") scoreMola += 3;
  else if (p.biotipo === "medio") scoreMola += 1;
  else scoreEspuma += 1;

  // Finalidade
  if (p.finalidade === "praia") scoreMola += 2;
  if (p.finalidade === "diario") scoreMola += 1;

  // Temperatura
  if (p.temperatura === "quente") scoreMola += 2;
  else if (p.temperatura === "frio") scoreEspuma += 1;

  // Casal
  if (p.casal === "casal_diferente" || p.casal === "casal_similar") scoreMola += 2;
  if (p.casal === "familia") scoreMola += 1;

  // Durabilidade
  if (p.durabilidade === "longo") scoreMola += 2;
  else if (p.durabilidade === "medio") scoreMola += 1;

  // Dores
  const dores = Array.isArray(p.dores) ? p.dores : [];
  if (dores.includes("coluna") || dores.includes("quadril") || dores.includes("pressao")) scoreEspuma += 2;
  if (dores.includes("ombros")) scoreEspuma += 1;

  // Firmeza
  if (p.firmeza === "muito_firme" || p.firmeza === "firme") scoreMola += 1;
  if (p.firmeza === "macio") scoreEspuma += 2;

  // Idade
  if (p.idade === "acima55") scoreEspuma += 2;
  if (p.idade === "menor18" || p.idade === "18a35") scoreMola += 1;

  // Alergia
  if (p.alergia === "rinite") scoreEspuma += 2;
  if (p.alergia === "pele") scoreEspuma += 1;

  // Posição
  if (p.posicao === "lado" || p.posicao === "brucos") scoreEspuma += 1;

  // Histórico (mais peso)
  let estrategia = { continuidade: false, migracao: false, upgrade: false };
  if (p.historico === "mola") { scoreMola += 2; estrategia.continuidade = true; }
  if (p.historico === "espuma") { scoreEspuma += 1; estrategia.continuidade = true; }
  if (p.historico === "madeira") { scoreEspuma += 3; estrategia.migracao = true; }
  if (p.historico === "nenhum") { scoreMola += 1; estrategia.upgrade = true; }

  // Desempate → mola (híbrido implícito)
  const estrutura: "MOLA" | "ESPUMA" = scoreMola >= scoreEspuma ? "MOLA" : "ESPUMA";

  // Firmeza
  let firmeza = "Médio";
  if (p.firmeza === "muito_firme") firmeza = "Extra Firme";
  else if (p.firmeza === "firme") firmeza = "Firme";
  else if (p.firmeza === "macio") firmeza = "Macio";

  // Perfil
  const finalidadeLabel: Record<string, string> = {
    diario: "uso diário", praia: "casa de praia", ocasional: "uso ocasional"
  };
  const perfil = `${p.biotipo === "pesado" ? "Pessoa pesada" : p.biotipo === "medio" ? "Biotipo médio" : "Pessoa leve"}, ${finalidadeLabel[p.finalidade ?? ""] ?? ""}`;

  // Justificativa
  const justificativas: string[] = [];
  if (estrutura === "MOLA") {
    if (p.temperatura === "quente") justificativas.push("colchão de mola tem ventilação superior");
    if (p.biotipo === "pesado") justificativas.push("suporte estrutural ideal para o seu biotipo");
    if (p.durabilidade === "longo") justificativas.push("durabilidade excepcional a longo prazo");
    if (p.casal?.includes("casal")) justificativas.push("excelente independência de movimento para casais");
  } else {
    if (dores.length > 0 && !dores.includes("nenhuma")) justificativas.push("alívio de pressão para suas dores");
    if (p.alergia === "rinite") justificativas.push("material hipoalergênico ideal para rinite");
    if (p.idade === "acima55") justificativas.push("conforto e maciez adequados para sua faixa etária");
    if (p.posicao === "lado") justificativas.push("excelente absorção de pressão para quem dorme de lado");
  }
  const justificativa = justificativas.length > 0
    ? justificativas.join(", ") + "."
    : "perfil equilibrado com boa relação custo-benefício.";

  return { estrutura, firmeza, perfil, justificativa, estrategia };
}

// ─── MENSAGEM WHATSAPP ───────────────────────────────────────────────────────

function gerarMensagemWA(p: UserProfile, r: Resultado): string {
  const labels: Record<string, Record<string, string>> = {
    finalidade: { diario: "Uso diário", praia: "Casa de praia", ocasional: "Uso ocasional" },
    biotipo: { leve: "Leve (até 60kg)", medio: "Médio (60–90kg)", pesado: "Pesado (+90kg)" },
    posicao: { lado: "De lado", costas: "De costas", brucos: "De bruços", variado: "Varia" },
    temperatura: { quente: "Esquento muito", normal: "Normal", frio: "Tenho frio" },
    casal: { sozinho: "Sozinho(a)", casal_similar: "Casal (pesos similares)", casal_diferente: "Casal (pesos diferentes)", familia: "Com filhos" },
    firmeza: { muito_firme: "Muito firme", firme: "Firme", medio: "Médio", macio: "Macio" },
    alergia: { nenhuma: "Nenhuma", rinite: "Rinite/Asma", pele: "Pele sensível", nao_sei: "Não sei" },
    durabilidade: { curto: "1–3 anos", medio: "3–7 anos", longo: "7–10+ anos" },
    historico: { mola: "Mola", espuma: "Espuma", madeira: "Madeira/estrado", nenhum: "Não tive" },
  };

  const get = (key: keyof UserProfile, val?: string) => val ? (labels[key]?.[val] ?? val) : "—";

  const doresLabel = Array.isArray(p.dores) && !p.dores.includes("nenhuma")
    ? p.dores.map(d => ({ coluna: "Costas/coluna", quadril: "Quadril", ombros: "Ombros/pescoço", pressao: "Pressão" }[d] ?? d)).join(", ")
    : "Nenhuma";

  return `Olá! Acabei de preencher o *Mapa do Sono* 🛏️

📋 *Meu perfil:*
• Finalidade: ${get("finalidade", p.finalidade)}
• Biotipo: ${get("biotipo", p.biotipo)}
• Posição ao dormir: ${get("posicao", p.posicao)}
• Dores: ${doresLabel}
• Temperatura: ${get("temperatura", p.temperatura)}
• Uso: ${get("casal", p.casal)}
• Firmeza preferida: ${get("firmeza", p.firmeza)}
• Peso: ${p.peso ?? "—"} / Altura: ${p.altura ?? "—"}
• Idade: ${p.idade ?? "—"}
• Alergia: ${get("alergia", p.alergia)}
• Durabilidade esperada: ${get("durabilidade", p.durabilidade)}
• Histórico: ${get("historico", p.historico)}

🎯 *Resultado do Mapa:*
Estrutura recomendada: *${r.estrutura}*
Firmeza: *${r.firmeza}*

Quero atendimento e recomendação personalizada! 😊`;
}

// ─── CHAT BUBBLE ─────────────────────────────────────────────────────────────

function BubbleThalles({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2 mb-4">
      <img
        src="/thalles-avatar.jpg"
        alt="ThallesZzz"
        className="w-10 h-10 rounded-full object-cover object-top border-2 border-red-200 shrink-0 shadow"
      />
      <motion.div
        initial={{ opacity: 0, x: -12, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs shadow-sm text-sm text-slate-800 leading-relaxed"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function MapaSono() {
  const [stepIndex, setStepIndex] = useState(-1); // -1 = welcome
  const [profile, setProfile] = useState<UserProfile>({});
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [showResult, setShowResult] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stepIndex, showResult]);

  const currentStep = STEPS[stepIndex];
  const progress = stepIndex < 0 ? 0 : Math.round(((stepIndex + 1) / STEPS.length) * 100);

  function handleSingle(value: string) {
    const key = currentStep.id;
    const updated = { ...profile, [key]: value };
    setProfile(updated);

    if (stepIndex + 1 >= STEPS.length) {
      const r = calcularResultado(updated);
      setResultado(r);
      setShowResult(true);
    } else {
      setStepIndex(i => i + 1);
    }
  }

  function handleMultiConfirm() {
    const key = currentStep.id;
    const updated = { ...profile, [key]: multiSelect.length > 0 ? multiSelect : ["nenhuma"] };
    setProfile(updated);
    setMultiSelect([]);

    if (stepIndex + 1 >= STEPS.length) {
      const r = calcularResultado(updated);
      setResultado(r);
      setShowResult(true);
    } else {
      setStepIndex(i => i + 1);
    }
  }

  function toggleMulti(value: string) {
    if (value === "nenhuma") {
      setMultiSelect(["nenhuma"]);
      return;
    }
    setMultiSelect(prev => {
      const sem = prev.filter(v => v !== "nenhuma");
      return prev.includes(value) ? sem.filter(v => v !== value) : [...sem, value];
    });
  }

  function reiniciar() {
    setStepIndex(-1);
    setProfile({});
    setMultiSelect([]);
    setResultado(null);
    setShowResult(false);
  }

  function abrirWhatsApp() {
    if (!resultado) return;
    const msg = gerarMensagemWA(profile, resultado);
    const url = `https://wa.me/5522992410112?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="max-w-md mx-auto flex flex-col min-h-[calc(100vh-8rem)] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <img src="/thalles-avatar.jpg" alt="ThallesZzz" className="w-12 h-12 rounded-full object-cover object-top border-2 border-red-400 shadow" />
        <div>
          <p className="font-extrabold text-slate-900 text-base leading-tight">Especialista ThallesZzz</p>
          <p className="text-xs text-green-500 font-semibold">● Online agora</p>
        </div>
      </div>

      {/* Progress */}
      {stepIndex >= 0 && !showResult && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Etapa {stepIndex + 1} de {STEPS.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 space-y-1">

        {/* Welcome */}
        <AnimatePresence>
          {stepIndex === -1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BubbleThalles>
                Olá! Eu sou o <strong>Especialista ThallesZzz</strong> 👋<br /><br />
                Vou te ajudar a descobrir qual é o colchão <strong>ideal para o seu corpo</strong>, com base no seu perfil de sono.<br /><br />
                São só 13 perguntinhas rápidas — sem texto, só cliques!
              </BubbleThalles>

              <div className="flex justify-end mb-4">
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={() => setStepIndex(0)}
                  className="flex items-center gap-2 bg-red-600 text-white font-bold px-5 py-3 rounded-2xl rounded-br-sm shadow-md hover:bg-red-700 active:scale-95 transition-all text-sm"
                >
                  Quero descobrir meu colchão ideal <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {stepIndex >= 0 && !showResult && currentStep && (
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <BubbleThalles>
                {currentStep.pergunta}
              </BubbleThalles>

              <div className={cn("flex flex-col gap-2 pl-12", currentStep.tipo === "multi" && "mb-2")}>
                {currentStep.opcoes.map((op) => {
                  const isSelected = currentStep.tipo === "multi" && multiSelect.includes(op.value);
                  return (
                    <motion.button
                      key={op.value}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => currentStep.tipo === "multi" ? toggleMulti(op.value) : handleSingle(op.value)}
                      className={cn(
                        "text-left px-4 py-3 rounded-2xl rounded-br-sm border text-sm font-semibold transition-all shadow-sm",
                        isSelected
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-red-300 hover:bg-red-50"
                      )}
                    >
                      {op.emoji && <span className="mr-2">{op.emoji}</span>}
                      {op.label}
                      {isSelected && <CheckCircle2 className="w-4 h-4 inline ml-2 shrink-0" />}
                    </motion.button>
                  );
                })}
              </div>

              {currentStep.tipo === "multi" && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleMultiConfirm}
                    disabled={multiSelect.length === 0}
                    className="flex items-center gap-2 bg-red-600 text-white font-bold px-5 py-2.5 rounded-2xl text-sm shadow disabled:opacity-40 hover:bg-red-700 active:scale-95 transition-all"
                  >
                    Confirmar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resultado */}
        <AnimatePresence>
          {showResult && resultado && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <BubbleThalles>
                Análise concluída! 🎯 Com base no seu perfil, o colchão ideal para você é:
              </BubbleThalles>

              {/* Card resultado */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="ml-12 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-5 text-white shadow-xl mb-4"
              >
                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Estrutura recomendada</p>
                <p className="text-3xl font-black tracking-tight">{resultado.estrutura === "MOLA" ? "🌀 Mola" : "🧽 Espuma"}</p>
                <p className="text-sm font-bold opacity-90 mt-1">Firmeza: {resultado.firmeza}</p>
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-xs opacity-80 leading-relaxed">
                    <strong>Por quê?</strong> {resultado.justificativa}
                  </p>
                </div>
                {resultado.estrategia.upgrade && (
                  <div className="mt-2 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold">
                    🚀 Essa será uma grande evolução no seu sono!
                  </div>
                )}
                {resultado.estrategia.migracao && (
                  <div className="mt-2 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold">
                    🔄 Migração para maior conforto e saúde.
                  </div>
                )}
                {resultado.estrategia.continuidade && (
                  <div className="mt-2 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold">
                    ✅ Vamos encontrar a versão ideal para você!
                  </div>
                )}
              </motion.div>

              <BubbleThalles>
                Posso te mostrar agora as opções que temos em estoque com o seu perfil — e <strong>entrega mais barata que o site</strong>! 😉<br /><br />
                Chama eu no WhatsApp que te atendo na hora!
              </BubbleThalles>

              {/* CTAs */}
              <div className="pl-12 flex flex-col gap-2 mt-2">
                <button
                  onClick={abrirWhatsApp}
                  className="flex items-center justify-center gap-2 bg-green-500 text-white font-extrabold px-5 py-4 rounded-2xl shadow-lg hover:bg-green-600 active:scale-95 transition-all text-base"
                >
                  <MessageCircle className="w-5 h-5" />
                  Falar com ThallesZzz no WhatsApp
                </button>
                <button
                  onClick={reiniciar}
                  className="flex items-center justify-center gap-2 bg-white text-slate-600 font-semibold border border-slate-200 px-5 py-3 rounded-2xl text-sm hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Refazer o mapa
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
