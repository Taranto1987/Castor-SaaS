/**
 * MOTOR DE CLASSIFICAÇÃO — Camada 3
 *
 * Fluxo único obrigatório para TODOS os módulos:
 *
 *   entrada bruta → normalizarMedida() → TABELA_MESTRE → categoria
 *
 * Nunca: nome → categoria.
 * Sempre: medida → categoria.
 *
 * Medida válida mas fora da tabela → NAO_MAPEADA + log estruturado.
 * O sistema NUNCA inventa categoria. Módulos consumidores tratam
 * NAO_MAPEADA com fallback explícito (Talib: "vou verificar";
 * Catálogo: não exibe; Crawler: grava e alerta).
 */

import { normalizarMedida } from "./normalizador";
import {
  TABELA_MESTRE,
  SINONIMOS_BUSCA,
  type Categoria,
  type EntradaTabelaMestre,
  type StatusMedida,
} from "./tabela-mestre";

export interface ResultadoClassificacao {
  ok: boolean;
  medida: string | null;
  largura: number | null;
  comprimento: number | null;
  categoria: Categoria;
  nomeExibido: string | null;
  status: StatusMedida | null;
  slug: string | null;
  motivo?: "medida_invalida" | "medida_nao_mapeada";
}

const NAO_CLASSIFICADO: Omit<ResultadoClassificacao, "motivo"> = {
  ok: false,
  medida: null,
  largura: null,
  comprimento: null,
  categoria: "NAO_MAPEADA",
  nomeExibido: null,
  status: null,
  slug: null,
};

export function classificarPorMedida(entrada: unknown): ResultadoClassificacao {
  const norm = normalizarMedida(entrada);

  if (!norm) {
    return { ...NAO_CLASSIFICADO, motivo: "medida_invalida" };
  }

  const registro: EntradaTabelaMestre | undefined = TABELA_MESTRE[norm.medida];

  if (!registro) {
    // Medida real, mas fora da linha Castor mapeada.
    // Log estruturado — se aparecer com frequência no crawler, é sinal de
    // que a Castor lançou medida nova e a tabela precisa de PR.
    console.error(
      JSON.stringify({
        modulo: "classificador-medidas",
        evento: "medida_nao_mapeada",
        medida: norm.medida,
        entrada: String(entrada).slice(0, 120),
      }),
    );
    return {
      ...NAO_CLASSIFICADO,
      medida: norm.medida,
      largura: norm.largura,
      comprimento: norm.comprimento,
      motivo: "medida_nao_mapeada",
    };
  }

  return {
    ok: true,
    medida: registro.medida,
    largura: registro.largura,
    comprimento: registro.comprimento,
    categoria: registro.categoria,
    nomeExibido: registro.nomeExibido,
    status: registro.status,
    slug: registro.slug,
  };
}

/**
 * Extrai a PRIMEIRA medida válida de um texto livre (título do crawler,
 * mensagem de WhatsApp). Varre padrões "NxN" no texto inteiro.
 *
 * Ex: "Colchão Castor Gold Star Solteiro 88x188x30 Molas"
 *     → classifica por "88x188", ignora o "Solteiro" do título.
 */
export function classificarDeTextoLivre(texto: unknown): ResultadoClassificacao {
  if (typeof texto !== "string") {
    return { ...NAO_CLASSIFICADO, motivo: "medida_invalida" };
  }

  // Captura padrões dimensão-separador-dimensão(-altura opcional)
  const padrao =
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*[x×/]\s*(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*[x×/]\s*\d{1,3})?/gi;
  const matches = texto.matchAll(padrao);

  for (const m of matches) {
    const resultado = classificarPorMedida(`${m[1]}x${m[2]}`);
    if (resultado.ok || resultado.motivo === "medida_nao_mapeada") {
      return resultado;
    }
  }

  return { ...NAO_CLASSIFICADO, motivo: "medida_invalida" };
}

/**
 * BUSCA (único módulo autorizado a usar nome): resolve termo digitado
 * pelo usuário em categoria. Tenta medida primeiro; sinônimo depois.
 * "96x203", "solteirão" e "solteiro king" retornam a MESMA categoria.
 */
export function resolverTermoBusca(termo: unknown): Categoria | null {
  const porMedida = classificarPorMedida(termo);
  if (porMedida.ok) return porMedida.categoria;

  if (typeof termo !== "string") return null;
  const chave = termo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos: "solteirão" → "solteirao"
    .trim();

  return SINONIMOS_BUSCA[chave] ?? null;
}
