export interface TenantContext {
  lojaId: number;
  lojaSlug: string;
  operacao: string;
  cidade: string;
  contato: string;
  whatsappNumero: string;
  whatsappDisplay: string;
  vendedor?: string;
  papel?: string;
}

export interface ServiceResult<T> {
  data?: T;
  error?: string;
  status?: number;
}

export function ok<T>(data: T): ServiceResult<T> {
  return { data };
}

export function fail(error: string, status = 400): ServiceResult<never> {
  return { error, status };
}
