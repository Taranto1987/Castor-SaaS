// ── Mapa do Sono — config declarativa do fluxo (grafo de perguntas) ─────────────
// P1 da reestruturação 3.0. Esta é a ÚNICA fonte de verdade do fluxo. Hoje reproduz
// fielmente o fluxo linear atual (Fase A: incomodo→ocupacao→peso→posicao→dores→calor;
// Fase C: tamanho→conjunto→lead). A P3 adiciona perguntas novas e a ramificação por
// contexto editando apenas este arquivo — sem tocar no engine.

import {
  Moon, Users, Scale, BedDouble, Activity, Thermometer,
  User, Heart, RefreshCw, Zap, Check, Star, Package, Layers, MessageCircle,
} from "lucide-react";
import type { Opt, QuestionNode, Grafo } from "./types";

// ── Opções (espelham as constantes atuais de MapaSono.tsx) ──────────────────────
export const OPCOES_INCOMODO: Opt[] = [
  { value: "dor",       label: "Acordo com dores",      Icon: Zap },
  { value: "calor",     label: "Calor durante a noite", Icon: Thermometer },
  { value: "afundando", label: "Colchão afundando",     Icon: BedDouble },
  { value: "sono_ruim", label: "Sono ruim ou agitado",  Icon: Moon },
  { value: "conforto",  label: "Quero mais conforto",   Icon: Heart },
];

export const OPCOES_OCUPACAO: Opt[] = [
  { value: "sozinho", label: "Só para mim",   Icon: User },
  { value: "casal",   label: "Para um casal", Icon: Users },
];

export const OPCOES_POSICAO: Opt[] = [
  { value: "lado",   label: "De lado",          Icon: Activity },
  { value: "costas", label: "De costas",        Icon: User },
  { value: "brucos", label: "De bruços",        Icon: Heart },
  { value: "varia",  label: "Varia de posição", Icon: RefreshCw },
];

// "nenhuma" é tratada como exclusiva pelo renderer de multi (limpa as demais).
export const OPCOES_DORES: Opt[] = [
  { value: "lombar",   label: "Lombar",   Icon: Zap },
  { value: "cervical", label: "Cervical", Icon: Activity },
  { value: "ombro",    label: "Ombro",    Icon: User },
  { value: "quadril",  label: "Quadril",  Icon: Heart },
  { value: "nenhuma",  label: "Nenhuma",  Icon: Check },
];

export const OPCOES_CALOR: Opt[] = [
  { value: "sim", label: "Sim", Icon: Thermometer },
  { value: "nao", label: "Não", Icon: Moon },
];

export const OPCOES_TAMANHO: Opt[] = [
  { value: "solteiro", label: "Solteiro", Icon: User },
  { value: "casal",    label: "Casal",    Icon: Users },
  { value: "queen",    label: "Queen",    Icon: BedDouble },
  { value: "king",     label: "King",     Icon: Star },
];

export const OPCOES_CONJUNTO: Opt[] = [
  { value: "colchao",         label: "Só o colchão",      Icon: BedDouble },
  { value: "box_colchao",     label: "Box + colchão",     Icon: Package },
  { value: "box_bau_colchao", label: "Box baú + colchão", Icon: Layers },
];

// ── Grafo do fluxo atual ────────────────────────────────────────────────────────
const nodes: QuestionNode[] = [
  // ── Fase A — diagnóstico ──
  {
    id: "incomodo", fase: "A", kind: "unica", Icon: Moon,
    titulo: "O que mais incomoda o seu sono hoje?",
    campo: "incomodo", opcoes: OPCOES_INCOMODO,
    obrigatorio: true, autoAvanca: true,
    proximo: () => "ocupacao",
  },
  {
    id: "ocupacao", fase: "A", kind: "unica", Icon: Users,
    titulo: "Para quem é o colchão?",
    campo: "ocupacao", opcoes: OPCOES_OCUPACAO,
    obrigatorio: true, autoAvanca: true,
    proximo: () => "peso",
  },
  {
    id: "peso", fase: "A", kind: "peso", Icon: Scale,
    titulo: (r) => (r.ocupacao === "casal" ? "Qual o peso de vocês?" : "Qual o seu peso?"),
    subtitulo: (r) =>
      r.ocupacao === "casal" ? "Informe o peso das duas pessoas" : "Informe seu peso",
    obrigatorio: true, autoAvanca: false,
    proximo: () => "posicao",
  },
  {
    id: "posicao", fase: "A", kind: "unica", Icon: BedDouble,
    titulo: "Qual a sua posição preferida para dormir?",
    campo: "posicao", opcoes: OPCOES_POSICAO,
    obrigatorio: true, autoAvanca: true,
    proximo: () => "dores",
  },
  {
    id: "dores", fase: "A", kind: "multi", Icon: Activity,
    titulo: "Você sente alguma dor com frequência?",
    campo: "dores", opcoes: OPCOES_DORES,
    obrigatorio: true, autoAvanca: false,
    proximo: () => "calor",
  },
  {
    id: "calor", fase: "A", kind: "unica", Icon: Thermometer,
    titulo: "Você costuma sentir calor durante a noite?",
    campo: "calor", opcoes: OPCOES_CALOR, coerce: (v) => v === "sim",
    obrigatorio: true, autoAvanca: true,
    proximo: () => null, // fim da Fase A → gera resultado
  },

  // ── Fase C — conversão ──
  {
    id: "tamanho", fase: "C", kind: "unica", Icon: BedDouble,
    titulo: "Qual o tamanho desejado?",
    campo: "tamanho", opcoes: OPCOES_TAMANHO, grid2: true,
    obrigatorio: true, autoAvanca: true,
    proximo: () => "conjunto",
  },
  {
    id: "conjunto", fase: "C", kind: "unica", Icon: Package,
    titulo: "Como você quer o seu conjunto?",
    campo: "conjunto", opcoes: OPCOES_CONJUNTO,
    obrigatorio: true, autoAvanca: true,
    proximo: () => "lead",
  },
  {
    id: "lead", fase: "C", kind: "lead", Icon: MessageCircle,
    titulo: "Quase lá!",
    subtitulo: "Receba sua análise completa e orientação personalizada.",
    obrigatorio: true, autoAvanca: false,
    proximo: () => null, // fim da Fase C → finalizar
  },
];

export const GRAFO: Grafo = Object.fromEntries(nodes.map((n) => [n.id, n]));

// Primeiro nó de cada fase (entrada do grafo).
export const INICIO_A = "incomodo";
export const INICIO_C = "tamanho";
