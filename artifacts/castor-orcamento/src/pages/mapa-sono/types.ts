// ── Mapa do Sono — tipos do grafo de perguntas declarativo ──────────────────────
// P1 da reestruturação 3.0. Estes tipos descrevem o FLUXO como dados (grafo de nós),
// permitindo ramificação por contexto sem switch hardcoded. O comportamento (engine
// + renderização) é construído na P2 consumindo esta config.
//
// `PerfilRespostas` permanece o subconjunto que o motor v2 consome (contrato de rede
// intocado). `Respostas` é o saco genérico de respostas do questionário (superset),
// projetado para os payloads em MapaSono.tsx.

import type React from "react";

// ── Domínio (espelha os tipos atuais de MapaSono.tsx; serão centralizados aqui na P2) ──
export type Incomodo = "dor" | "calor" | "afundando" | "sono_ruim" | "conforto";
export type Ocupacao = "sozinho" | "casal";
export type Posicao  = "lado" | "costas" | "brucos" | "varia";
export type Dor      = "lombar" | "cervical" | "ombro" | "quadril";
export type Tamanho  = "solteiro" | "casal" | "queen" | "king";
export type Conjunto = "colchao" | "box_colchao" | "box_bau_colchao";

// Subconjunto consumido pelo motor v2 (POST /api/mapa-sono/compatibilidade)
export interface PerfilRespostas {
  incomodo?: Incomodo;
  ocupacao?: Ocupacao;
  pesoA: number;
  pesoB: number;
  posicao?: Posicao;
  dores: Dor[];
  calor?: boolean;
}

// Saco de respostas do questionário inteiro (Fase A + Fase C). Superset de
// PerfilRespostas; a P3 estende com os campos novos (para_quem, motivo, urgencia, …).
export interface Respostas extends PerfilRespostas {
  tamanho?: Tamanho;
  conjunto?: Conjunto;
  nome?: string;
  whatsapp?: string;
}

export type Categoria = "principal" | "premium" | "mais_macia" | "mais_firme" | "custo_beneficio";

export interface RankingItem {
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

export interface ResultadoCompatibilidade {
  ranking: RankingItem[];
  firmezaIndicada: string;
  perfilResumo: string;
}

export interface Opt<V extends string = string> {
  value: V;
  label: string;
  Icon: React.ElementType;
}

// ── Grafo de perguntas ──────────────────────────────────────────────────────────
// kind define como o nó é renderizado e como avança:
//   unica  — uma opção, first-click-wins (autoAvanca true)
//   multi  — múltipla escolha com botão Confirmar (dores; "nenhuma" limpa as demais)
//   peso   — 1 ou 2 NumberPickers (pesoB só se casal) com botão Continuar
//   lead   — nome + WhatsApp com botão de envio (encerra Fase C)
export type StepKind = "unica" | "multi" | "peso" | "lead";

type TextoDinamico = string | ((r: Respostas) => string | undefined);

export interface QuestionNode {
  id: string;
  fase: "A" | "C";
  kind: StepKind;
  titulo: TextoDinamico;
  subtitulo?: TextoDinamico;
  Icon: React.ElementType;
  // Campo de `Respostas` em que a resposta deste nó é gravada.
  campo?: keyof Respostas;
  // Opções para kind unica|multi.
  opcoes?: Opt[];
  // Converte o `value` cru da opção no valor gravado (ex.: calor "sim" → true).
  coerce?: (raw: string) => unknown;
  // Layout em grade 2 colunas (tamanho).
  grid2?: boolean;
  // Core obrigatório (true) vs secundário/skippável (false). Usado a partir da P5.
  obrigatorio: boolean;
  // O nó só entra no caminho se a condição for verdadeira (ramificação por contexto).
  // Ausente = sempre presente.
  condicao?: (r: Respostas) => boolean;
  // Próximo id no grafo conforme as respostas; null = fim da fase
  // (fim de A → gerar resultado; fim de C → finalizar).
  proximo: (r: Respostas) => string | null;
  // first-click-wins (true) vs botão explícito Confirmar/Continuar (false).
  autoAvanca: boolean;
}

export type Grafo = Record<string, QuestionNode>;
