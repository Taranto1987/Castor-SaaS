// Motor de Resultado por Regras — Mapa do Sono 3.0
//
// Seleciona os 3 cards por REGRA de perfil (tabela do dono), resolvendo cada nome
// contra o catálogo REAL da loja. O percentual exibido é o SCORE REAL do motor v2
// (decisão do dono). Gates clínicos filtram produtos contraindicados; avisos
// anexam alertas por card.
//
// Princípio de segurança: nada é inventado. A seleção é por nome; os gates usam
// só o que é detectável com confiança no nome do produto (tipo mola/espuma,
// Tecnopedic, Niponpedic, sinais de maciez/firmeza). Quando os produtos da regra
// NÃO existem no catálogo da loja, cai no motor v2 determinístico (comportamento
// atual) — nunca um card apontando produto inexistente.

import {
  type PerfilDiagnostico,
  type ProdutoCatalogoInput,
  type ResultadoCompatibilidade,
  type RankingItem,
  type Categoria,
  montarRanking,
  perfilToVector,
  produtoToVector,
  compatibilidade,
  classificar,
  definirFirmeza,
  dorPrincipal,
  gerarMotivos,
  gerarResumo,
} from "./motor-v2";
import { resolverTermoBusca } from "../medidas";

// ── Perfil estendido (motor v2 + sinais do fluxo 3.0) ───────────────────────────
export interface PerfilRegras extends PerfilDiagnostico {
  contexto?: "constante" | "praia" | "hospede";
  hospedePrioridade?: "custo" | "performance";
  idosoSemMola?: boolean; // 65+ que nunca testou / não gostou de mola
  gestante?: boolean;
  patologia?: "nenhuma" | "reabilitacao" | "pos_op" | "outra";
  tamanho?: "solteiro" | "casal" | "queen" | "king";
}

export interface RankingItemRegras extends RankingItem {
  avisos?: string[];
  justificativa?: string;
}

export interface ResultadoRegras extends Omit<ResultadoCompatibilidade, "ranking"> {
  ranking: RankingItemRegras[];
  origem: "regras" | "motor" | "emergencia";
}

// ── Tabela de regras (a tabela do dono) — fragmentos de nome normalizados ───────
type Bucket = "idoso_sem_mola" | "gestante" | "reabilitacao_posop" | "custo_beneficio" | "padrao";

const REGRAS: Record<Bucket, string[]> = {
  idoso_sem_mola:     ["sleep ortoped", "carmel", "sleep max"],
  gestante:           ["amazon premium gel", "silver star", "fontana"],
  reabilitacao_posop: ["fontana", "silver star", "amazon premium gel"],
  custo_beneficio:    ["expressive pocket", "silver star", "innovation new plus"],
  padrao:             ["kingdom aloe vera", "fontana", "amazon premium gel"],
};

// ── Detecção por nome (confiável, sem inventar metadado) ────────────────────────
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const nomeCompleto = (p: ProdutoCatalogoInput) => norm(`${p.nome} ${p.familyName ?? ""}`);

const ehMola       = (n: string) => /(pocket|mola|ensacad|hibrid|spring)/.test(n);
const ehTecnopedic = (n: string) => n.includes("tecnopedic");
const ehNiponpedic = (n: string) => n.includes("niponpedic") || n.includes("massage");
const ehMacio      = (n: string) => /(pillow|visco|macio|soft|euro)/.test(n);
const ehExtraFirme = (n: string) => /(super resistente|extra firme|ortoped|\bd(4[5-9]|[5-9]\d)\b)/.test(n);

function definirBucket(p: PerfilRegras): Bucket {
  if (p.idosoSemMola) return "idoso_sem_mola";
  if (p.gestante) return "gestante";
  if (p.patologia === "pos_op" || p.patologia === "reabilitacao") return "reabilitacao_posop";
  if (p.contexto === "hospede" || p.contexto === "praia") return "custo_beneficio";
  return "padrao";
}

// ── Gates clínicos (bloqueio antes de exibir) ───────────────────────────────────
function bloqueado(p: ProdutoCatalogoInput, perfil: PerfilRegras): boolean {
  const n = nomeCompleto(p);
  // Idoso 65+ sem experiência de mola → bloqueia toda a linha de molas
  if (perfil.idosoSemMola && ehMola(n)) return true;
  // Pós-operatório coluna/fêmur → bloqueia macios (suporte insuficiente)
  if (perfil.patologia === "pos_op" && ehMacio(n)) return true;
  // Gestante → bloqueia extra-firme e Tecnopedic
  if (perfil.gestante && (ehExtraFirme(n) || ehTecnopedic(n))) return true;
  return false;
}

// ── Avisos automáticos por card ─────────────────────────────────────────────────
function avisosDe(p: ProdutoCatalogoInput, perfil: PerfilRegras): string[] {
  const n = nomeCompleto(p);
  const out: string[] = [];
  if (ehTecnopedic(n) && perfil.ocupacao === "casal") {
    out.push("Este modelo transfere movimento entre os lados. Ideal para uso individual ou casal que já dorme junto há anos.");
  }
  if (ehNiponpedic(n)) {
    out.push("Contraindicado para portadores de marca-passo.");
  }
  if (Math.max(perfil.pesoA, perfil.pesoB ?? 0) > 100) {
    out.push("Confirme a grade de peso para este modelo.");
  }
  return out;
}

// Penalidade (não bloqueio): Tecnopedic para casal com diferença > 20kg.
function penalidade(p: ProdutoCatalogoInput, perfil: PerfilRegras, score: number): number {
  const n = nomeCompleto(p);
  if (
    ehTecnopedic(n) && perfil.ocupacao === "casal" &&
    perfil.pesoB !== undefined && Math.abs(perfil.pesoA - perfil.pesoB) > 20
  ) {
    return Math.max(60, score - 8);
  }
  return score;
}

// Resolve um fragmento da regra contra o catálogo, preferindo a variante da medida.
function casar(
  produtos: ProdutoCatalogoInput[],
  fragmento: string,
  tamanho: string | undefined,
  usados: Set<number>,
): ProdutoCatalogoInput | undefined {
  const f = norm(fragmento);
  const cands = produtos.filter((p) => !usados.has(p.id) && nomeCompleto(p).includes(f));
  if (cands.length === 0) return undefined;
  if (tamanho) {
    // SSOT: casa por categoria de tamanho derivada da MEDIDA (categoria_interna),
    // nunca pelo nome. Ex: "solteiro" → SOLTEIRO só casa 88x188.
    const catAlvo = resolverTermoBusca(tamanho);
    if (catAlvo) {
      const naCategoria = cands.find((p) => p.categoriaInterna === catAlvo);
      if (naCategoria) return naCategoria;
    }
    // Fallback legado (produtos ainda sem backfill de categoria_interna): palavra em `size`.
    const t = norm(tamanho);
    const naMedida = cands.find((p) => p.size && norm(p.size).includes(t));
    if (naMedida) return naMedida;
  }
  return cands[0];
}

const FAIXA: Categoria[] = ["principal", "premium", "custo_beneficio"];

// ── Entrada principal ───────────────────────────────────────────────────────────
export function montarRankingRegras(
  perfil: PerfilRegras,
  produtos: ProdutoCatalogoInput[],
): ResultadoRegras {
  const elegiveis = produtos.filter((p) => !bloqueado(p, perfil));
  const vetorPerfil = perfilToVector(perfil);
  const pesoBase = Math.max(perfil.pesoA, perfil.pesoB ?? 0);
  const firmezaIndicada = definirFirmeza(pesoBase, dorPrincipal(perfil.dores));

  // 1) Tenta resolver os produtos da regra do bucket no catálogo da loja.
  const bucket = definirBucket(perfil);
  const usados = new Set<number>();
  const escolhidos: ProdutoCatalogoInput[] = [];
  for (const frag of REGRAS[bucket]) {
    const prod = casar(elegiveis, frag, perfil.tamanho, usados);
    if (prod) { usados.add(prod.id); escolhidos.push(prod); }
  }

  // 2) Fallback: nenhum produto da regra existe no catálogo → motor v2 (sobre os
  //    elegíveis, já filtrados pelos gates). Comportamento seguro atual.
  if (escolhidos.length === 0) {
    const base = montarRanking(perfil, elegiveis);
    const porId = new Map(elegiveis.map((p) => [String(p.id), p]));

    if (base.ranking.length > 0) {
      return {
        ...base,
        origem: "motor",
        ranking: base.ranking.map((item) => {
          const prod = porId.get(item.produtoId);
          return {
            ...item,
            avisos: prod ? avisosDe(prod, perfil) : [],
            justificativa: item.motivos.join(". ") + ".",
          };
        }),
      };
    }

    // 2b) Emergency fallback: motor-v2 returned empty (all products scored < 65).
    // Show top 3 eligible products anyway so the user always sees options.
    if (elegiveis.length > 0) {
      const emergencyCands = elegiveis
        .map((prod) => {
          const vetor = produtoToVector(prod);
          const score = compatibilidade(vetorPerfil, vetor);
          return { prod, vetor, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const emergencyRanking: RankingItemRegras[] = emergencyCands.map((c, i) => {
        const motivos = gerarMotivos(perfil, c.vetor, firmezaIndicada);
        return {
          produtoId: String(c.prod.id),
          nome: c.prod.familyName ?? c.prod.nome,
          score: c.score,
          classificacao: classificar(c.score),
          categoria: FAIXA[i] ?? "custo_beneficio",
          motivos,
          precoPix: c.prod.precoPix,
          imagem: c.prod.imagem,
          size: c.prod.size,
          avisos: [
            "Compatibilidade abaixo do ideal para seu perfil. Consulte um especialista.",
            ...avisosDe(c.prod, perfil),
          ],
          justificativa: motivos.join(". ") + ".",
        };
      });

      return { ranking: emergencyRanking, firmezaIndicada, perfilResumo: gerarResumo(perfil, firmezaIndicada), origem: "emergencia" };
    }

    return { ...base, origem: "motor", ranking: [] };
  }

  // 3) Caminho de regras: score REAL do motor por produto, ordenado por score.
  const scored = escolhidos
    .map((prod) => {
      const vetor = produtoToVector(prod);
      const score = penalidade(prod, perfil, compatibilidade(vetorPerfil, vetor));
      return { prod, vetor, score };
    })
    .sort((a, b) => b.score - a.score);

  const ranking: RankingItemRegras[] = scored.map((c, i) => {
    const motivos = gerarMotivos(perfil, c.vetor, firmezaIndicada);
    return {
      produtoId: String(c.prod.id),
      nome: c.prod.familyName ?? c.prod.nome,
      score: c.score,
      classificacao: classificar(c.score),
      categoria: FAIXA[i] ?? "custo_beneficio",
      motivos,
      precoPix: c.prod.precoPix,
      imagem: c.prod.imagem,
      size: c.prod.size,
      avisos: avisosDe(c.prod, perfil),
      justificativa: motivos.join(". ") + ".",
    };
  });

  return { ranking, firmezaIndicada, perfilResumo: gerarResumo(perfil, firmezaIndicada), origem: "regras" };
}
