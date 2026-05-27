export interface FeatureFlags {
  crm: boolean;
  inbox: boolean;
  aiMemory: boolean;
  hotLeadAlerts: boolean;
  multiAttendant: boolean;
}

const DEFAULTS: FeatureFlags = {
  crm: true,
  inbox: true,
  aiMemory: true,
  hotLeadAlerts: true,
  multiAttendant: false,
};

/**
 * Extrai feature flags do configJson da loja.
 * Qualquer flag ausente usa o valor padrão — seguro para lojas sem configuração explícita.
 *
 * Exemplo de configJson: { "features": { "inbox": false, "multiAttendant": true } }
 */
export function getFeatureFlags(lojaConfigJson: unknown): FeatureFlags {
  const cfg = (lojaConfigJson as Record<string, unknown> | null)?.features as Partial<FeatureFlags> ?? {};
  return { ...DEFAULTS, ...cfg };
}
