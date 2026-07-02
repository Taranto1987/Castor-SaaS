/**
 * MÓDULO MEDIDAS — Single Source of Truth de tamanhos de colchão.
 *
 * Ponto de entrada único. Todo módulo consumidor (crawler, catálogo, filtro,
 * busca, mapa do sono, Talib, SEO) importa daqui:
 *
 *   import { classificarPorMedida, classificarDeTextoLivre, resolverTermoBusca } from "../medidas";
 *
 * Fluxo obrigatório: entrada bruta → normalizarMedida() → TABELA_MESTRE → categoria.
 * Nunca: nome → categoria.
 */

export {
  CATEGORIAS,
  TABELA_MESTRE,
  SINONIMOS_BUSCA,
  type Categoria,
  type StatusMedida,
  type EntradaTabelaMestre,
} from "./tabela-mestre";

export { normalizarMedida, type MedidaNormalizada } from "./normalizador";

export {
  classificarPorMedida,
  classificarDeTextoLivre,
  resolverTermoBusca,
  type ResultadoClassificacao,
} from "./classificador";
