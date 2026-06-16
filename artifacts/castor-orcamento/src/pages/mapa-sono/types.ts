// ── Mapa do Sono — tipos do grafo de perguntas declarativo ──────────────────────
// Reestruturação 3.0: fluxo adaptativo por contexto. O fluxo é descrito como uma
// LISTA ORDENADA de nós (FLUXO em flow.ts) + um predicado `condicao` por nó. O engine
// (engine.ts) caminha apenas pelos nós cuja `condicao` é verdadeira para as respostas
// atuais — é isso que dá a ramificação (hóspede/praia/constante, idoso, gestante…)
// sem switch hardcoded.

import type React from "react";

// ── Domínio ─────────────────────────────────────────────────────────────────────
export type Contexto    = "constante" | "praia" | "hospede";
export type HospedeTipo  = "comercial" | "visita";
export type HospedePrio  = "custo" | "performance";
export type Posicao      = "lado" | "costas" | "brucos" | "varia";
export type Dor          = "lombar" | "cervical" | "ombro" | "quadril" | "joelho";
export type IdosoColchao = "madeira" | "espuma" | "mola";
export type Patologia    = "nenhuma" | "reabilitacao" | "pos_op" | "outra";
export type GestanteMes  = "1tri" | "2tri" | "3tri" | "nascido";
export type Temperatura  = "quente" | "frio" | "indiferente";
export type Movimento    = "alto" | "baixo";
export type Tamanho      = "solteiro" | "casal" | "queen" | "king";
export type Conjunto     = "colchao" | "conjunto";

// Saco de respostas do questionário inteiro. Campos numéricos da biometria têm
// default no estado inicial (sliders); os demais são preenchidos ao longo do fluxo.
export interface Respostas {
  // Contexto
  contexto?: Contexto;
  hospedeTipo?: HospedeTipo;
  hospedePrioridade?: HospedePrio;
  quantidade?: 1 | 2;
  // Biometria por pessoa
  idadeA: number; pesoA: number; alturaA: number;
  idadeB: number; pesoB: number; alturaB: number;
  // Histórico do idoso
  idosoColchaoAtual?: IdosoColchao;
  idosoTestouMola?: boolean;
  // Diagnóstico
  posicao?: Posicao;
  dores: Dor[];
  patologia?: Patologia;
  gestante?: boolean;
  gestanteMeses?: GestanteMes;
  temperatura?: Temperatura;
  movimento?: Movimento;
  // Configuração
  tamanho?: Tamanho;
  conjunto?: Conjunto;
}

// ── Resultado (contrato do motor v2, intocado) ──────────────────────────────────
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
  subtitulo?: string;
}

// ── Grafo de perguntas ──────────────────────────────────────────────────────────
// kind define renderização e avanço:
//   unica     — uma opção, first-click-wins (autoAvanca true)
//   multi     — múltipla escolha com botão Confirmar (dores; "nenhuma" exclusiva)
//   biometria — sliders de idade/peso/altura (1 pessoa) com botão Continuar
export type StepKind = "unica" | "multi" | "biometria";

type TextoDinamico = string | ((r: Respostas) => string);
type OpcoesDinamicas = Opt[] | ((r: Respostas) => Opt[]);

export interface QuestionNode {
  id: string;
  kind: StepKind;
  titulo: TextoDinamico;
  subtitulo?: string | ((r: Respostas) => string | undefined);
  Icon: React.ElementType;
  // Campo de `Respostas` gravado por este nó (unica/multi).
  campo?: keyof Respostas;
  opcoes?: OpcoesDinamicas;
  // Converte o value cru da opção no valor gravado (ex.: "sim" → true).
  coerce?: (raw: string) => unknown;
  grid2?: boolean;
  // Qual pessoa a biometria coleta.
  pessoa?: "A" | "B";
  // O nó só entra no caminho se a condição for verdadeira. Ausente = sempre presente.
  condicao?: (r: Respostas) => boolean;
  // first-click-wins (true) vs botão explícito Confirmar/Continuar (false).
  autoAvanca: boolean;
  // Core obrigatório (true) vs secundário/skippável (false).
  obrigatorio: boolean;
}
