import type { AuthUser } from "@/contexts/AuthContext";

export const API_URL = "";

export function getAuthHeaders(): Record<string, string> {
  const raw = sessionStorage.getItem("castor_auth_user");
  if (!raw) return {};
  const user = JSON.parse(raw);
  if (user?.sessionToken) return { "x-session-token": user.sessionToken };
  return {};
}

export function userIsDono(user: AuthUser | null): boolean {
  return user?.papel === "dono" || user?.papel === "ADMIN" || user?.papel === "GERENTE";
}

export interface Lead {
  id: number;
  nome: string;
  whatsapp?: string | null;
  email?: string | null;
  estagio: string;
  origem: string;
  tags: string[];
  observacoes?: string | null;
  vendedorAtribuido?: string | null;
  pontuacao: number;
  ultimoContato?: string | null;
  criadoEm: string;
  atualizadoEm?: string | null;
  valorNumerico?: number | null;
  valorBrl?: string | null;
  closingProbability?: number | null;
  proximaAcao?: string | null;
  oppDiasSemResposta?: number | null;
}

export const ESTAGIOS = [
  { key: "novo",       label: "Novo",       color: "bg-slate-100 text-slate-700 border-slate-200"       },
  { key: "contato",    label: "Contato",    color: "bg-blue-100 text-blue-700 border-blue-200"          },
  { key: "proposta",   label: "Proposta",   color: "bg-violet-100 text-violet-700 border-violet-200"    },
  { key: "negociacao", label: "Negociação", color: "bg-amber-100 text-amber-700 border-amber-200"       },
  { key: "ganho",      label: "Ganho",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "perdido",    label: "Perdido",    color: "bg-red-100 text-red-600 border-red-200"              },
  { key: "arquivado",  label: "Arquivado",  color: "bg-slate-100 text-slate-500 border-slate-300"       },
  { key: "cancelado",  label: "Cancelado",  color: "bg-orange-100 text-orange-600 border-orange-200"    },
] as const;

export const PIPELINE_STAGES = ["novo", "contato", "proposta", "negociacao", "ganho"];
export const ACTIVE_STAGES   = ["novo", "contato", "proposta", "negociacao"];
export const ARCHIVED_STAGES = ["arquivado", "cancelado", "perdido"];
