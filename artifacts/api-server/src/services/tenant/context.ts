import type { Session } from "../../lib/sessions";
import type { TenantContext } from "../shared/types";

const TENANT_BY_OPERACAO: Record<string, Omit<TenantContext, "vendedor" | "papel">> = {
  cabo_frio: {
    lojaId: 1,
    lojaSlug: "cabo-frio",
    operacao: "cabo_frio",
    cidade: "Cabo Frio",
    whatsappNumero: "5522992410112",
    whatsappDisplay: "(22) 99241-0112",
  },
  araruama: {
    lojaId: 2,
    lojaSlug: "araruama",
    operacao: "araruama",
    cidade: "Araruama",
    whatsappNumero: "5522988447240",
    whatsappDisplay: "(22) 98844-7240",
  },
};

const DEFAULT_TENANT = TENANT_BY_OPERACAO.cabo_frio;

export function resolveTenantContext(session?: Session): TenantContext {
  const base = TENANT_BY_OPERACAO[session?.operacao ?? ""] ?? DEFAULT_TENANT;
  return {
    ...base,
    vendedor: session?.nome,
    papel: session?.papel,
  };
}

export function resolveTenantByOperacao(operacao: string): Omit<TenantContext, "vendedor" | "papel"> {
  return TENANT_BY_OPERACAO[operacao] ?? DEFAULT_TENANT;
}

export { TENANT_BY_OPERACAO };
