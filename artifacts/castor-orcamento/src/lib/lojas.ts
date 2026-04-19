export const LOJAS = {
  "cabo-frio": {
    nome: "Thalles",
    whatsapp: "5522992410112",
    cidade: "Cabo Frio",
    tel: "(22) 99241-0112",
    endereco: "Av. Júlia Kubitschek, 64 - Jardim Flamboyant, Cabo Frio - RJ, 28913-100",
    maps: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  },
  araruama: {
    nome: "Marcela",
    whatsapp: "5522988447240",
    cidade: "Araruama",
    tel: "(22) 98844-7240",
    endereco: "Araruama - RJ",
    maps: "https://maps.app.goo.gl/cGmvFgeubawLRNGy8",
  },
} as const;

export type LojaKey = keyof typeof LOJAS;

export const CIDADES_ARARUAMA = [
  "araruama",
  "saquarema",
  "iguaba grande",
  "maricá",
  "silva jardim",
  "rio bonito",
] as const;
