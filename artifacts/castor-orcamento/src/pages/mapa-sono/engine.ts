// ── Mapa do Sono — engine do grafo de perguntas ─────────────────────────────────
// Caminha por FLUXO pulando os nós cuja `condicao` é falsa. Estado puro em memória;
// nenhuma transição lê/escreve storage. O componente (MapaSono.tsx) só despacha ações.

import { FLUXO } from "./flow";
import type { QuestionNode, Respostas, ResultadoCompatibilidade, Opt } from "./types";

export interface EngineState {
  fase: "questionario" | "resultado" | "finalizado";
  nodeId: string;
  respostas: Respostas;
  resultado: ResultadoCompatibilidade | null;
  resultadoCarregando: boolean;
}

export type EngineAcao =
  | { type: "RESPONDER"; patch: Partial<Respostas> }
  | { type: "VOLTAR" }
  | { type: "RESULTADO_OK"; resultado: ResultadoCompatibilidade }
  | { type: "RESULTADO_ERRO" }
  | { type: "FINALIZAR" }
  | { type: "REINICIAR" };

export const RESPOSTAS_INICIAIS: Respostas = {
  idadeA: 35, pesoA: 75, alturaA: 170,
  idadeB: 35, pesoB: 65, alturaB: 165,
  dores: [],
};

export function estadoInicial(): EngineState {
  return {
    fase: "questionario",
    nodeId: FLUXO[0]!.id,
    respostas: { ...RESPOSTAS_INICIAIS },
    resultado: null,
    resultadoCarregando: false,
  };
}

// Caminho visível: nós cuja condição é verdadeira para as respostas atuais.
export function caminho(r: Respostas): QuestionNode[] {
  return FLUXO.filter((n) => !n.condicao || n.condicao(r));
}

export function noPorId(id: string): QuestionNode | undefined {
  return FLUXO.find((n) => n.id === id);
}

// Progresso na barra: índice do nó atual e total do caminho atual.
export function progresso(state: EngineState): { step: number; total: number } {
  const path = caminho(state.respostas);
  const idx = path.findIndex((n) => n.id === state.nodeId);
  return { step: Math.max(0, idx), total: path.length };
}

export function podeVoltar(state: EngineState): boolean {
  if (state.fase === "resultado") return true;
  const path = caminho(state.respostas);
  return path.findIndex((n) => n.id === state.nodeId) > 0;
}

export function engineReducer(state: EngineState, acao: EngineAcao): EngineState {
  switch (acao.type) {
    case "RESPONDER": {
      if (state.fase !== "questionario") return state;
      const respostas = { ...state.respostas, ...acao.patch };
      const path = caminho(respostas);
      const idx = path.findIndex((n) => n.id === state.nodeId);
      const prox = path[idx + 1];
      if (!prox) {
        // Fim do questionário → calcular resultado.
        return { ...state, respostas, fase: "resultado", resultadoCarregando: true };
      }
      return { ...state, respostas, nodeId: prox.id };
    }
    case "VOLTAR": {
      if (state.fase === "resultado") {
        const path = caminho(state.respostas);
        const ultimo = path[path.length - 1];
        return ultimo
          ? { ...state, fase: "questionario", nodeId: ultimo.id, resultado: null, resultadoCarregando: false }
          : state;
      }
      if (state.fase === "questionario") {
        const path = caminho(state.respostas);
        const idx = path.findIndex((n) => n.id === state.nodeId);
        const ant = idx > 0 ? path[idx - 1] : undefined;
        return ant ? { ...state, nodeId: ant.id } : state;
      }
      return state;
    }
    case "RESULTADO_OK":
      if (state.fase !== "resultado") return state;
      return { ...state, resultado: acao.resultado, resultadoCarregando: false };
    case "RESULTADO_ERRO":
      if (state.fase !== "resultado") return state;
      return {
        ...state,
        resultado: { ranking: [], firmezaIndicada: "", perfilResumo: "" },
        resultadoCarregando: false,
      };
    case "FINALIZAR":
      if (state.fase !== "resultado") return state;
      return { ...state, fase: "finalizado" };
    case "REINICIAR":
      return estadoInicial();
    default:
      return state;
  }
}

// ── Resolução de campos dinâmicos (texto/opções dependentes das respostas) ──────
export function resolverTexto(
  t: string | ((r: Respostas) => string | undefined) | undefined,
  r: Respostas,
): string | undefined {
  return typeof t === "function" ? t(r) : t;
}

export function resolverOpcoes(node: QuestionNode, r: Respostas): Opt[] {
  if (!node.opcoes) return [];
  return typeof node.opcoes === "function" ? node.opcoes(r) : node.opcoes;
}

// ── Projeção para o contrato do motor v2 (POST /api/mapa-sono/compatibilidade) ──
// O motor v2 permanece intocado; aqui mapeamos as respostas ricas para o subconjunto
// que ele consome. Campos novos (idade, altura, contexto, patologia…) seguem para
// persistência/telemetria, não para o score.
export interface PerfilMotor {
  incomodo: "dor" | "calor" | "afundando" | "sono_ruim" | "conforto";
  ocupacao: "sozinho" | "casal";
  pesoA: number;
  pesoB?: number;
  posicao: "lado" | "costas" | "brucos" | "varia";
  dores: Array<"lombar" | "cervical" | "ombro" | "quadril">;
  calor: boolean;
}

export function projetarPerfilMotor(r: Respostas): PerfilMotor {
  const incomodo: PerfilMotor["incomodo"] =
    r.dores.length > 0 ? "dor" : r.temperatura === "quente" ? "calor" : "conforto";
  // O motor não conhece "joelho" — fica só para a sugestão de travesseiro/persistência.
  const dores = r.dores.filter(
    (d): d is "lombar" | "cervical" | "ombro" | "quadril" => d !== "joelho",
  );
  return {
    incomodo,
    ocupacao: r.quantidade === 2 ? "casal" : "sozinho",
    pesoA: r.pesoA,
    pesoB: r.quantidade === 2 ? r.pesoB : undefined,
    posicao: r.posicao ?? "varia",
    dores,
    calor: r.temperatura === "quente",
  };
}
