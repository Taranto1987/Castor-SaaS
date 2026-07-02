// Motor de Compatibilidade v2 — Mapa do Sono 2.0
//
// Puro e 100% determinístico: nenhum IO, nenhuma chamada a LLM, nenhum default
// silencioso. Opera SOMENTE com as variáveis coletadas no fluxo novo
// (incomodo, ocupacao, pesoA/pesoB, posicao, dores, calor) — altura, movimento,
// preferência e uso foram removidos da assinatura, não preenchidos por trás.
//
// O vetor de atributos de cada produto é derivado deterministicamente de
// colunas do banco (nome/familyName) — nunca de valor inventado.

// ── Contrato de entrada ─────────────────────────────────────────────────────────

export type Incomodo = "dor" | "calor" | "afundando" | "sono_ruim" | "conforto";
export type Ocupacao = "sozinho" | "casal";
export type Posicao = "lado" | "costas" | "brucos" | "varia";
export type Dor = "lombar" | "cervical" | "ombro" | "quadril";

export interface PerfilDiagnostico {
  incomodo: Incomodo;
  ocupacao: Ocupacao;
  pesoA: number; // kg, 30–300
  pesoB?: number; // obrigatório se ocupacao === "casal"
  posicao: Posicao;
  dores: Dor[]; // [] = nenhuma
  calor: boolean;
  lojaId: number; // OBRIGATÓRIO — invariante multi-tenant (validado na rota, sem fallback)
}

// ── Contrato de saída ───────────────────────────────────────────────────────────

export type Classificacao = "Excelente" | "Alta" | "Boa" | "Moderada";
export type Categoria = "principal" | "premium" | "mais_macia" | "mais_firme" | "custo_beneficio";
export type FirmezaIndicada = "Macio" | "Intermediário" | "Firme" | "Extra Firme";

export interface RankingItem {
  produtoId: string;
  nome: string;
  score: number; // 0–100, nunca 100, nunca <65 dentro do ranking
  classificacao: Classificacao;
  categoria: Categoria;
  motivos: string[]; // 2–4, template determinístico
  // Campos adicionais para a UI — sempre do banco, nunca inventados
  precoPix: string | null;
  imagem: string | null;
  size: string | null;
}

export interface ResultadoCompatibilidade {
  ranking: RankingItem[]; // length 0–3 (0 = fallback "fale com especialista")
  firmezaIndicada: FirmezaIndicada;
  perfilResumo: string; // 1 linha p/ mensagem do WhatsApp e CRM
}

// ── Entrada de produto (colunas do banco, desacoplado do Drizzle) ───────────────

export interface ProdutoCatalogoInput {
  id: number;
  nome: string;
  familyName: string | null;
  familySlug: string | null;
  size: string | null;
  // Categoria de tamanho do Dicionário Mestre de Medidas (SSOT), derivada da MEDIDA.
  // Preferida sobre `size` (palavra) para casar tamanho no motor de regras.
  categoriaInterna?: string | null;
  precoPix: string | null;
  custoBRL: string | null;
  imagem: string | null;
  // Ficha técnica real do fabricante (persistida pelo crawler). Quando presente, tem
  // prioridade sobre a inferência por nome/familyName em extrairFeatures.
  fichaTecnica?: Record<string, unknown> | null;
}

// ── ScoreVector ─────────────────────────────────────────────────────────────────

export interface ScoreVector {
  suporte: number;
  conforto: number;
  resfriamento: number;
  isolamentoMovimento: number;
  alivioPressao: number;
  estabilidade: number;
}

const DIMENSOES = [
  "suporte",
  "conforto",
  "resfriamento",
  "isolamentoMovimento",
  "alivioPressao",
  "estabilidade",
] as const;

// Pesos do scoreTotal v1: suporte×3, conforto×2, alivioPressao×2,
// estabilidade×2, isolamentoMovimento×2, resfriamento×1
const PESOS: ScoreVector = {
  suporte: 3,
  conforto: 2,
  resfriamento: 1,
  isolamentoMovimento: 2,
  alivioPressao: 2,
  estabilidade: 2,
};

function vetorZero(): ScoreVector {
  return { suporte: 0, conforto: 0, resfriamento: 0, isolamentoMovimento: 0, alivioPressao: 0, estabilidade: 0 };
}

// ── Validação (sem defaults silenciosos) ────────────────────────────────────────

const INCOMODOS: readonly string[] = ["dor", "calor", "afundando", "sono_ruim", "conforto"];
const OCUPACOES: readonly string[] = ["sozinho", "casal"];
const POSICOES: readonly string[] = ["lado", "costas", "brucos", "varia"];
const DORES_VALIDAS: readonly string[] = ["lombar", "cervical", "ombro", "quadril"];

export function validarPerfil(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return "Payload inválido";
  const b = body as Record<string, unknown>;

  if (typeof b.incomodo !== "string" || !INCOMODOS.includes(b.incomodo)) {
    return "incomodo inválido";
  }
  if (typeof b.ocupacao !== "string" || !OCUPACOES.includes(b.ocupacao)) {
    return "ocupacao inválida";
  }
  if (typeof b.pesoA !== "number" || !Number.isFinite(b.pesoA) || b.pesoA < 30 || b.pesoA > 300) {
    return "pesoA deve estar entre 30 e 300 kg";
  }
  if (b.ocupacao === "casal") {
    if (typeof b.pesoB !== "number" || !Number.isFinite(b.pesoB)) {
      return "pesoB é obrigatório para casal";
    }
  }
  if (b.pesoB !== undefined && b.pesoB !== null) {
    if (typeof b.pesoB !== "number" || !Number.isFinite(b.pesoB) || b.pesoB < 30 || b.pesoB > 300) {
      return "pesoB deve estar entre 30 e 300 kg";
    }
  }
  if (typeof b.posicao !== "string" || !POSICOES.includes(b.posicao)) {
    return "posicao inválida";
  }
  if (!Array.isArray(b.dores) || b.dores.some((d) => typeof d !== "string" || !DORES_VALIDAS.includes(d))) {
    return "dores inválidas";
  }
  if (typeof b.calor !== "boolean") {
    return "calor deve ser booleano";
  }
  return null;
}

// ── Perfil → ScoreVector (regras v2 do blueprint) ───────────────────────────────

export function perfilToVector(p: PerfilDiagnostico): ScoreVector {
  const v = vetorZero();
  const pesoBase = Math.max(p.pesoA, p.pesoB ?? 0);

  // POSIÇÃO
  switch (p.posicao) {
    case "lado":
      v.alivioPressao += 2;
      v.conforto += 1;
      break;
    case "costas":
      v.suporte += 2;
      v.estabilidade += 1;
      break;
    case "brucos":
      v.suporte += 3;
      break;
    case "varia":
      v.isolamentoMovimento += 2;
      v.estabilidade += 1;
      break;
  }

  // DORES — somar com TETO: cada dimensão limitada a 6 pontos vindos de dores
  const deDores = vetorZero();
  if (p.dores.length === 0) {
    deDores.estabilidade += 1;
  } else {
    for (const dor of p.dores) {
      switch (dor) {
        case "lombar":
          deDores.suporte += 3;
          deDores.estabilidade += 1;
          break;
        case "cervical":
          deDores.conforto += 2;
          deDores.suporte += 1;
          break;
        case "ombro":
          deDores.alivioPressao += 2;
          deDores.conforto += 1;
          break;
        case "quadril":
          deDores.alivioPressao += 2;
          deDores.suporte += 1;
          break;
      }
    }
  }
  for (const dim of DIMENSOES) {
    v[dim] += Math.min(6, deDores[dim]);
  }

  // PESO
  if (pesoBase <= 60) {
    v.conforto += 2;
  } else if (pesoBase > 90) {
    v.suporte += 3;
    v.estabilidade += 2;
  }

  // CASAL com diferença de peso > 20kg
  if (p.ocupacao === "casal" && p.pesoB !== undefined && Math.abs(p.pesoA - p.pesoB) > 20) {
    v.isolamentoMovimento += 3;
  }

  // CALOR
  if (p.calor) {
    v.resfriamento += 3;
  }

  // INCÔMODO — peso 1, desempate (dor/calor já cobertos, não duplicar)
  switch (p.incomodo) {
    case "afundando":
      v.suporte += 1;
      v.estabilidade += 1;
      break;
    case "sono_ruim":
      v.isolamentoMovimento += 1;
      break;
    case "conforto":
      v.conforto += 1;
      break;
    case "dor":
    case "calor":
      break;
  }

  return v;
}

// ── Firmeza indicada ────────────────────────────────────────────────────────────
// O v1 calculava firmeza por IMC (peso+altura). O v2 não coleta altura, então a
// firmeza é função apenas de pesoBase + dorPrincipal, com os mesmos limiares de
// peso do v1 (≤60 leve, >90 pesado). Dor lombar/quadril sobe um nível.

const FIRMEZAS: FirmezaIndicada[] = ["Macio", "Intermediário", "Firme", "Extra Firme"];

export function dorPrincipal(dores: Dor[]): Dor | "nenhuma" {
  if (dores.includes("lombar")) return "lombar";
  return dores[0] ?? "nenhuma";
}

export function definirFirmeza(pesoBase: number, dor: Dor | "nenhuma"): FirmezaIndicada {
  let nivel: number;
  if (pesoBase <= 60) nivel = 0;
  else if (pesoBase <= 90) nivel = 1;
  else if (pesoBase <= 120) nivel = 2;
  else nivel = 3;

  if (dor === "lombar" || dor === "quadril") nivel = Math.min(3, nivel + 1);

  return FIRMEZAS[nivel] ?? "Intermediário";
}

// ── Produto → ScoreVector (derivado de colunas do banco, escala 0–6) ────────────

interface FeaturesProduto {
  dens: number | null;
  pillow: boolean;
  spring: boolean;
  pocket: boolean;
  orto: boolean;
  fresh: boolean;
}

// Achata os valores string da ficha técnica num corpus de busca (ignora a chave `_raw`,
// que guarda HTML bruto e poluiria o matching de keywords).
function fichaCorpus(ficha: Record<string, unknown> | null | undefined): string {
  if (!ficha) return "";
  const partes: string[] = [];
  for (const [chave, valor] of Object.entries(ficha)) {
    if (chave === "_raw") continue;
    if (typeof valor === "string") partes.push(valor);
    else if (typeof valor === "number") partes.push(String(valor));
  }
  return partes.join(" ");
}

function extrairFeatures(p: ProdutoCatalogoInput): FeaturesProduto {
  // Dado real do fabricante (quando o crawler o persistiu) entra no corpus junto com o nome.
  // Mantém o comportamento legado intacto para produtos sem ficha técnica.
  const corpusFicha = fichaCorpus(p.fichaTecnica).toLowerCase();
  const txt = `${p.nome} ${p.familyName ?? ""} ${corpusFicha}`.toLowerCase();

  // Densidade: prioriza a chave explícita da ficha ("densidade": "D33" | "33"), com
  // fallback para o padrão "D33" no nome (comportamento original).
  let dens: number | null = null;
  const densField = p.fichaTecnica?.["densidade"];
  if (typeof densField === "string" || typeof densField === "number") {
    const dm = String(densField).match(/(\d{2,3})/);
    if (dm) dens = parseInt(dm[1] ?? "", 10);
  }
  if (dens === null) {
    const densM = txt.match(/\bd(\d{2,3})\b/);
    dens = densM ? parseInt(densM[1] ?? "", 10) : null;
  }

  return {
    dens,
    pillow: txt.includes("pillow"),
    spring: txt.includes("molas") || txt.includes("spring") || txt.includes("pocket") || txt.includes("ensacad"),
    pocket: txt.includes("pocket") || txt.includes("ensacad"),
    orto: txt.includes("ortoped") || txt.includes("anatomic"),
    fresh: txt.includes("gel") || txt.includes("fresh"),
  };
}

const clamp06 = (n: number): number => Math.max(0, Math.min(6, n));

export function produtoToVector(p: ProdutoCatalogoInput): ScoreVector {
  const f = extrairFeatures(p);

  let suporte: number;
  if (f.dens !== null) {
    if (f.dens >= 53) suporte = 6;
    else if (f.dens >= 45) suporte = 5;
    else if (f.dens >= 40) suporte = 4;
    else if (f.dens >= 33) suporte = 3;
    else suporte = 2;
  } else {
    suporte = f.spring ? 4 : 3;
  }
  if (f.orto) suporte += 1;

  const conforto = 3 + (f.pillow ? 2 : 0) + (f.dens !== null && f.dens <= 33 ? 1 : 0);
  const resfriamento = 2 + (f.spring ? 2 : 0) + (f.fresh ? 2 : 0) - (f.pillow ? 1 : 0);
  const isolamentoMovimento = f.pocket ? 6 : f.spring ? 4 : 2;
  const alivioPressao = 3 + (f.pillow ? 1 : 0) + (f.spring ? 1 : 0) + (f.orto ? 1 : 0);
  const estabilidade = (f.dens !== null && f.dens >= 45 ? 5 : 3) + (f.pillow ? 0 : 1);

  return {
    suporte: clamp06(suporte),
    conforto: clamp06(conforto),
    resfriamento: clamp06(resfriamento),
    isolamentoMovimento: clamp06(isolamentoMovimento),
    alivioPressao: clamp06(alivioPressao),
    estabilidade: clamp06(estabilidade),
  };
}

// ── Compatibilidade: cosseno ponderado, normalizado 0–100 ───────────────────────
// Calibração: score = round((BASE + GANHO × cosseno) × 100), com teto.
// Para perfis típicos o 1º lugar cai em 88–97; 100 nunca é exibido.
const CALIBRACAO_BASE = 0.55;  // piso da escala exibida (cosseno 0 → 55)
const CALIBRACAO_GANHO = 0.45; // amplitude (cosseno 1 → 100, antes do teto)
const SCORE_TETO = 97;         // nunca exibir 100 — zera credibilidade

export function compatibilidade(perfil: ScoreVector, produto: ScoreVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const dim of DIMENSOES) {
    const w = PESOS[dim];
    dot += w * perfil[dim] * produto[dim];
    normA += w * perfil[dim] * perfil[dim];
    normB += w * produto[dim] * produto[dim];
  }
  if (normA === 0 || normB === 0) return 0;
  const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.min(SCORE_TETO, Math.round((CALIBRACAO_BASE + CALIBRACAO_GANHO * cos) * 100));
}

// ── Classificação ───────────────────────────────────────────────────────────────

export function classificar(score: number): Classificacao {
  if (score >= 95) return "Excelente";
  if (score >= 85) return "Alta";
  if (score >= 75) return "Boa";
  return "Moderada";
}

// ── Margem (desempate) — sempre do banco; sem dados, desempata por preço asc ────

export function parsePrecoBRL(raw: string | null): number | null {
  if (!raw) return null;
  const limpo = raw.replace(/[^\d.,]/g, "");
  if (!limpo) return null;
  // "2.999,00" → 2999.00 | "2999.00" → 2999.00 | "2999" → 2999
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

function margemProduto(p: ProdutoCatalogoInput): number | null {
  const preco = parsePrecoBRL(p.precoPix);
  const custo = parsePrecoBRL(p.custoBRL);
  if (preco === null || custo === null) return null;
  return preco - custo;
}

// ── Motivos por TEMPLATE determinístico (proibido LLM neste fluxo) ──────────────

export function gerarMotivos(p: PerfilDiagnostico, v: ScoreVector, firmeza: FirmezaIndicada): string[] {
  const motivos: string[] = [];
  const pesoBase = Math.max(p.pesoA, p.pesoB ?? 0);

  if (p.dores.includes("lombar") && v.suporte >= 5) {
    motivos.push("Suporte reforçado para dor lombar");
  }
  if (p.dores.includes("cervical") && v.conforto >= 4) {
    motivos.push("Acolhimento que alivia a região cervical");
  }
  if ((p.dores.includes("ombro") || p.dores.includes("quadril")) && v.alivioPressao >= 4) {
    motivos.push("Alívio de pressão nos pontos de contato");
  }
  if (p.calor && v.resfriamento >= 4) {
    motivos.push("Melhor dissipação de calor para noites quentes");
  }
  if (p.ocupacao === "casal" && v.isolamentoMovimento >= 4) {
    motivos.push("Isolamento de movimento para o casal");
  }
  if (p.posicao === "lado" && v.alivioPressao >= 4) {
    motivos.push("Conforto para quem dorme de lado");
  }
  if ((p.posicao === "costas" || p.posicao === "brucos") && v.suporte >= 4) {
    motivos.push("Sustentação alinhada para sua posição de dormir");
  }
  if (pesoBase > 90 && v.estabilidade >= 4) {
    motivos.push("Estrutura estável para o seu biotipo");
  }

  // Garantia de 2 motivos mínimos — fillers determinísticos
  if (motivos.length < 2) {
    motivos.push(`Firmeza ${firmeza.toLowerCase()} compatível com seu perfil`);
  }
  if (motivos.length < 2) {
    motivos.push("Compatível com o seu perfil de descanso");
  }

  return motivos.slice(0, 4);
}

// ── Resumo de 1 linha (WhatsApp + CRM) ──────────────────────────────────────────

const POSICAO_LABEL: Record<Posicao, string> = {
  lado: "de lado",
  costas: "de costas",
  brucos: "de bruços",
  varia: "variando de posição",
};

export function gerarResumo(p: PerfilDiagnostico, firmeza: FirmezaIndicada): string {
  const quem = p.ocupacao === "casal" ? `Casal (${p.pesoA}kg e ${p.pesoB}kg)` : `Individual (${p.pesoA}kg)`;
  const dores = p.dores.length > 0 ? `dores: ${p.dores.join(", ")}` : "sem dores";
  const calor = p.calor ? " · sente calor" : "";
  return `${quem} · dorme ${POSICAO_LABEL[p.posicao]} · ${dores}${calor} · firmeza indicada: ${firmeza}`;
}

// ── Ranking Top 3 ───────────────────────────────────────────────────────────────

interface Candidato {
  produto: ProdutoCatalogoInput;
  vetor: ScoreVector;
  score: number;
  margem: number | null;
  preco: number | null;
}

function categorizar(c: Candidato, top: Candidato): Categoria {
  if (c.preco !== null && top.preco !== null && c.preco > top.preco) return "premium";
  if (c.vetor.suporte < top.vetor.suporte) return "mais_macia";
  if (c.vetor.suporte > top.vetor.suporte) return "mais_firme";
  return "custo_beneficio";
}

export function montarRanking(
  perfil: PerfilDiagnostico,
  produtos: ProdutoCatalogoInput[],
): ResultadoCompatibilidade {
  const vetorPerfil = perfilToVector(perfil);
  const pesoBase = Math.max(perfil.pesoA, perfil.pesoB ?? 0);
  const firmezaIndicada = definirFirmeza(pesoBase, dorPrincipal(perfil.dores));
  const perfilResumo = gerarResumo(perfil, firmezaIndicada);

  const candidatos: Candidato[] = produtos.map((produto) => {
    const vetor = produtoToVector(produto);
    return {
      produto,
      vetor,
      score: compatibilidade(vetorPerfil, vetor),
      margem: margemProduto(produto),
      preco: parsePrecoBRL(produto.precoPix),
    };
  });

  // Ordenação determinística: score desc → margem desc (do banco) → preço asc → id asc
  candidatos.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ma = a.margem ?? -Infinity;
    const mb = b.margem ?? -Infinity;
    if (mb !== ma) return mb - ma;
    const pa = a.preco ?? Infinity;
    const pb = b.preco ?? Infinity;
    if (pa !== pb) return pa - pb;
    return a.produto.id - b.produto.id;
  });

  // Dedup por família (1 produto por linha de modelo) + corte score < 65 + máx. 3
  const vistos = new Set<string>();
  const selecionados: Candidato[] = [];
  for (const c of candidatos) {
    if (c.score < 65) continue;
    const chave = c.produto.familySlug ?? c.produto.nome;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    selecionados.push(c);
    if (selecionados.length >= 3) break;
  }

  // Nunca dois produtos com score idêntico: decrementa o de menor prioridade.
  // Se cair abaixo de 65, sai do ranking.
  const distintos: Candidato[] = [];
  for (const c of selecionados) {
    const anterior = distintos[distintos.length - 1];
    let score = c.score;
    if (anterior && score >= anterior.score) {
      score = anterior.score - 1;
    }
    if (score < 65) continue;
    distintos.push({ ...c, score });
  }

  const top = distintos[0];
  const ranking: RankingItem[] = distintos.map((c, i) => ({
    produtoId: String(c.produto.id),
    nome: c.produto.familyName ?? c.produto.nome,
    score: c.score,
    classificacao: classificar(c.score),
    categoria: i === 0 || !top ? "principal" : categorizar(c, top),
    motivos: gerarMotivos(perfil, c.vetor, firmezaIndicada),
    precoPix: c.produto.precoPix,
    imagem: c.produto.imagem,
    size: c.produto.size,
  }));

  return { ranking, firmezaIndicada, perfilResumo };
}
