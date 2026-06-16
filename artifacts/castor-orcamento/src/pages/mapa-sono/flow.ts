// ── Mapa do Sono — config declarativa do fluxo (grafo de perguntas) ─────────────
// Reestruturação 3.0. Esta é a ÚNICA fonte de verdade do fluxo. O engine caminha
// por FLUXO (lista ordenada) pulando os nós cuja `condicao` é falsa para as respostas
// atuais — é assim que a árvore ramifica por contexto/idade/gestação.

import {
  Home, Sun, Hotel, Users, User, BedDouble, Activity, Heart, RefreshCw,
  Zap, Check, Star, Package, Layers, Thermometer, Snowflake, Minus,
  Baby, Stethoscope, Hammer, Layers3, Briefcase, Moon,
} from "lucide-react";
import type { Opt, QuestionNode, Respostas } from "./types";

// ── Predicados de ramificação ───────────────────────────────────────────────────
export const ehHospede   = (r: Respostas) => r.contexto === "hospede";
export const ehPraia     = (r: Respostas) => r.contexto === "praia";
export const ehConstante = (r: Respostas) => r.contexto === "constante";
export const duasPessoas = (r: Respostas) => r.quantidade === 2;
// Idoso = qualquer pessoa que vai dormir na cama com 65+.
export const temIdoso = (r: Respostas) =>
  !ehHospede(r) && (r.idadeA >= 65 || (r.quantidade === 2 && r.idadeB >= 65));
// Idoso que nunca testou/não gostou de mola → bloqueia mola e vai direto à config.
export const idosoSemMola = (r: Respostas) => temIdoso(r) && r.idosoTestouMola === false;
// Etapas de diagnóstico aprofundado (constante, e não o atalho do idoso sem mola).
const diagnosticoCompleto = (r: Respostas) => ehConstante(r) && !idosoSemMola(r);

// ── Opções ──────────────────────────────────────────────────────────────────────
export const OPCOES_CONTEXTO: Opt[] = [
  { value: "constante", label: "Uso constante",      Icon: Home,  subtitulo: "Uso diário, residência principal" },
  { value: "praia",     label: "Casa de praia",      Icon: Sun,   subtitulo: "Uso esporádico, fim de semana" },
  { value: "hospede",   label: "Hóspede / hotelaria", Icon: Hotel, subtitulo: "Airbnb, pousada, hotel, quarto de visita" },
];

export const OPCOES_HOSPEDE_TIPO: Opt[] = [
  { value: "comercial", label: "Airbnb / Pousada / Hotel", Icon: Hotel, subtitulo: "Avaliação do hóspede vale dinheiro" },
  { value: "visita",    label: "Quarto de hóspede",        Icon: Users, subtitulo: "Conforto para quem visita você" },
];

export const OPCOES_QUANTIDADE: Opt[] = [
  { value: "1", label: "1 dorminhoco",  Icon: User },
  { value: "2", label: "2 dorminhocos", Icon: Users },
];

export const OPCOES_IDOSO_COLCHAO: Opt[] = [
  { value: "madeira", label: "Base / caixa de madeira", Icon: Layers3 },
  { value: "espuma",  label: "Espuma",                  Icon: Layers },
  { value: "mola",    label: "Molas",                   Icon: Activity },
];

export const OPCOES_SIM_NAO: Opt[] = [
  { value: "sim", label: "Sim, gostei",        Icon: Check },
  { value: "nao", label: "Não / nunca testei", Icon: Minus },
];

export const OPCOES_POSICAO: Opt[] = [
  { value: "lado",   label: "De lado",          Icon: Activity },
  { value: "costas", label: "De costas",        Icon: User },
  { value: "brucos", label: "De bruços",        Icon: Heart },
  { value: "varia",  label: "Varia de posição", Icon: RefreshCw },
];

// "nenhuma" é exclusiva (limpa as demais).
export const OPCOES_DORES: Opt[] = [
  { value: "nenhuma",  label: "Nenhuma",            Icon: Check },
  { value: "lombar",   label: "Lombar",             Icon: Zap },
  { value: "cervical", label: "Cervical / pescoço", Icon: Activity },
  { value: "ombro",    label: "Ombro",              Icon: User },
  { value: "quadril",  label: "Quadril",            Icon: Heart },
  { value: "joelho",   label: "Joelho",             Icon: Activity },
];

export const OPCOES_PATOLOGIA: Opt[] = [
  { value: "nenhuma",      label: "Nenhuma",                       Icon: Check },
  { value: "reabilitacao", label: "Em reabilitação",               Icon: Stethoscope },
  { value: "pos_op",       label: "Pós-operatório (coluna/fêmur)", Icon: Hammer },
  { value: "outra",        label: "Outra",                         Icon: Stethoscope },
];

export const OPCOES_GESTANTE: Opt[] = [
  { value: "nao", label: "Não", Icon: Minus },
  { value: "sim", label: "Sim", Icon: Baby },
];

export const OPCOES_GESTANTE_MESES: Opt[] = [
  { value: "1tri",    label: "1º trimestre",            Icon: Baby },
  { value: "2tri",    label: "2º trimestre",            Icon: Baby },
  { value: "3tri",    label: "3º trimestre",            Icon: Baby },
  { value: "nascido", label: "Bebê já nasceu (co-sleeping)", Icon: Baby },
];

export const OPCOES_TEMPERATURA: Opt[] = [
  { value: "quente",      label: "Sinto calor / transpiro", Icon: Thermometer },
  { value: "frio",        label: "Sinto frio",              Icon: Snowflake },
  { value: "indiferente", label: "Indiferente",             Icon: Minus },
];

// Título do movimento depende de 1 ou 2 pessoas.
export const OPCOES_MOVIMENTO: Opt[] = [
  { value: "alto",  label: "Sim, bastante", Icon: Activity },
  { value: "baixo", label: "Não / pouco",   Icon: Minus },
];

export const OPCOES_TAMANHO: Opt[] = [
  { value: "solteiro", label: "Solteiro", Icon: User },
  { value: "casal",    label: "Casal",    Icon: Users },
  { value: "queen",    label: "Queen",    Icon: BedDouble },
  { value: "king",     label: "King",     Icon: Star },
];

export const OPCOES_TIPO: Opt[] = [
  { value: "colchao",  label: "Só o colchão",          Icon: BedDouble },
  { value: "conjunto", label: "Conjunto (cama + colchão)", Icon: Package },
];

// ── FLUXO — lista ordenada (mestra). O engine filtra por `condicao`. ────────────
export const FLUXO: QuestionNode[] = [
  {
    id: "contexto", kind: "unica", Icon: BedDouble,
    titulo: "Para que vai ser usado?",
    campo: "contexto", opcoes: OPCOES_CONTEXTO,
    obrigatorio: true, autoAvanca: true,
  },
  {
    id: "hospede_tipo", kind: "unica", Icon: Hotel,
    titulo: "Qual o tipo de hospedagem?",
    campo: "hospedeTipo", opcoes: OPCOES_HOSPEDE_TIPO,
    condicao: ehHospede, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "hospede_prioridade", kind: "unica", Icon: Star,
    titulo: (r) =>
      r.hospedeTipo === "comercial" ? "O que importa mais para o seu negócio?" : "O que importa mais para você?",
    campo: "hospedePrioridade",
    opcoes: (r) =>
      r.hospedeTipo === "comercial"
        ? [
            { value: "custo",       label: "Custo-benefício",     Icon: Layers,   subtitulo: "Melhor entrega pelo melhor preço" },
            { value: "performance", label: "Alta performance",    Icon: Star,     subtitulo: "Hóspede dorme bem → avalia bem" },
          ]
        : [
            { value: "custo",       label: "Custo-benefício",     Icon: Layers,   subtitulo: "Qualidade sem exagero" },
            { value: "performance", label: "Conforto premium",    Icon: Star,     subtitulo: "Conforto premium para a visita" },
          ],
    condicao: ehHospede, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "quantidade", kind: "unica", Icon: Users,
    titulo: "Quantas pessoas vão dormir?",
    campo: "quantidade", opcoes: OPCOES_QUANTIDADE, coerce: (v) => (v === "2" ? 2 : 1),
    condicao: (r) => !ehHospede(r), obrigatorio: true, autoAvanca: true,
  },
  {
    id: "biometria_A", kind: "biometria", Icon: User, pessoa: "A",
    titulo: (r) => (r.quantidade === 2 ? "Dados da pessoa A" : "Seus dados"),
    condicao: (r) => !ehHospede(r), obrigatorio: true, autoAvanca: false,
  },
  {
    id: "biometria_B", kind: "biometria", Icon: Users, pessoa: "B",
    titulo: "Dados da pessoa B",
    condicao: (r) => !ehHospede(r) && duasPessoas(r), obrigatorio: true, autoAvanca: false,
  },
  {
    id: "idoso_colchao", kind: "unica", Icon: BedDouble,
    titulo: "Em que tipo de colchão dorme atualmente?",
    campo: "idosoColchaoAtual", opcoes: OPCOES_IDOSO_COLCHAO,
    condicao: temIdoso, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "idoso_mola", kind: "unica", Icon: Activity,
    titulo: "Já deitou num colchão de mola ou espuma e se sentiu bem?",
    campo: "idosoTestouMola", opcoes: OPCOES_SIM_NAO, coerce: (v) => v === "sim",
    condicao: temIdoso, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "posicao", kind: "unica", Icon: BedDouble,
    titulo: "Qual posição você mais dorme?",
    campo: "posicao", opcoes: OPCOES_POSICAO,
    condicao: (r) => !ehHospede(r) && !idosoSemMola(r), obrigatorio: true, autoAvanca: true,
  },
  {
    id: "dores", kind: "multi", Icon: Activity,
    titulo: "Sente dores ao acordar?",
    subtitulo: "Selecione todas que se aplicam",
    campo: "dores", opcoes: OPCOES_DORES,
    condicao: diagnosticoCompleto, obrigatorio: true, autoAvanca: false,
  },
  {
    id: "patologia", kind: "unica", Icon: Stethoscope,
    titulo: "Tem alguma condição de saúde a considerar?",
    campo: "patologia", opcoes: OPCOES_PATOLOGIA,
    condicao: diagnosticoCompleto, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "gestante", kind: "unica", Icon: Baby,
    titulo: "Há gestante ou bebê que vai dormir na cama?",
    campo: "gestante", opcoes: OPCOES_GESTANTE, coerce: (v) => v === "sim",
    condicao: diagnosticoCompleto, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "gestante_meses", kind: "unica", Icon: Baby,
    titulo: "Quantos meses?",
    campo: "gestanteMeses", opcoes: OPCOES_GESTANTE_MESES,
    condicao: (r) => diagnosticoCompleto(r) && r.gestante === true, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "temperatura", kind: "unica", Icon: Thermometer,
    titulo: "Como é sua sensação de temperatura à noite?",
    campo: "temperatura", opcoes: OPCOES_TEMPERATURA,
    condicao: diagnosticoCompleto, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "movimento", kind: "unica", Icon: Activity,
    titulo: (r) => (r.quantidade === 2 ? "Acorda quando o parceiro se mexe?" : "Você se mexe muito à noite?"),
    campo: "movimento", opcoes: OPCOES_MOVIMENTO,
    condicao: diagnosticoCompleto, obrigatorio: true, autoAvanca: true,
  },
  {
    id: "tamanho", kind: "unica", Icon: BedDouble,
    titulo: "Qual o tamanho?",
    campo: "tamanho", opcoes: OPCOES_TAMANHO, grid2: true,
    obrigatorio: true, autoAvanca: true,
  },
  {
    id: "tipo", kind: "unica", Icon: Package,
    titulo: "Só o colchão ou o conjunto?",
    campo: "conjunto", opcoes: OPCOES_TIPO,
    obrigatorio: true, autoAvanca: true,
  },
];

// Ícones reexportados para o renderer (cabeçalho de cada etapa usa o do nó).
export { Briefcase, Moon };
