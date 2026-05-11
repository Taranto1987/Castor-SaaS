export const TENANTS = {
  "cabo-frio": {
    nome: "Castor Cabo Frio",
    whatsapp: "5522992410112",
    cidade: "Cabo Frio",
  },
  araruama: {
    nome: "Castor Araruama",
    whatsapp: "5522988447240",
    cidade: "Araruama",
  },
  default: {
    nome: "Castor",
    whatsapp: "",
    cidade: "",
  },
} as const;

export type TenantKey = keyof typeof TENANTS;
