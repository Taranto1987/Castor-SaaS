export interface ProdutoCatalogo {
  id: string;
  nome: string;
  tecnologias: string[];
  firmezas: string[];
  tamanhos: string[];
}

export const catalogo: ProdutoCatalogo[] = [
  {
    id: "silver_star_hibrido",
    nome: "Colchão Castor Silver Star Pocket Híbrido",
    tecnologias: ["pocket", "hibrido", "gel"],
    firmezas: ["intermediario", "intermediario_firme"],
    tamanhos: ["solteiro", "casal", "queen", "king"],
  },
  {
    id: "silver_star_pocket",
    nome: "Colchão Castor Silver Star Pocket",
    tecnologias: ["pocket"],
    firmezas: ["intermediario", "intermediario_macio"],
    tamanhos: ["solteiro", "casal", "queen", "king"],
  },
  {
    id: "class_tecnopedic",
    nome: "Colchão Castor Class Tecnopedic",
    tecnologias: ["espuma"],
    firmezas: ["firme", "intermediario"],
    tamanhos: ["solteiro", "casal"],
  },
  {
    id: "super_resistente",
    nome: "Colchão Castor Super Resistente",
    tecnologias: ["espuma"],
    firmezas: ["firme"],
    tamanhos: ["solteiro", "casal", "queen"],
  },
  {
    id: "black_gold_hibrido",
    nome: "Colchão Castor Black Gold Pocket Híbrido",
    tecnologias: ["pocket", "hibrido", "gel"],
    firmezas: ["intermediario", "intermediario_firme", "intermediario_macio"],
    tamanhos: ["casal", "queen", "king"],
  },
  {
    id: "pillow_top_pocket",
    nome: "Colchão Castor Pillow Top Pocket",
    tecnologias: ["pocket"],
    firmezas: ["intermediario_macio", "macio"],
    tamanhos: ["solteiro", "casal", "queen", "king"],
  },
  {
    id: "visco_gel",
    nome: "Colchão Castor Visco Gel",
    tecnologias: ["espuma", "gel"],
    firmezas: ["intermediario_macio", "intermediario"],
    tamanhos: ["solteiro", "casal", "queen"],
  },
];

export function fallback(): ProdutoCatalogo {
  return catalogo[0];
}
