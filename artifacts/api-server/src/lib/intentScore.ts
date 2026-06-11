// Score de intenção de compra — determinístico, sem ML.
// Calculado no momento da captura do lead, a partir de sinais declarados
// pelo usuário no Mapa do Sono. Sinais comportamentais (resposta ao WA,
// visita à loja) podem incrementar o score via /api/leads/:id PATCH futuro.

export interface IntentSignals {
  motivoTroca?: string;  // afundou | dor_coluna | velho | mudanca | presente | pesquisando
  prazoCompra?: string;  // hoje | essa_semana | esse_mes | sem_pressa
}

export function calcularScoreIntencao(signals: IntentSignals): number {
  let score = 0;

  // Urgência do problema — 0–45 pts
  const urgencia: Record<string, number> = {
    afundou:     45,
    dor_coluna:  40,
    velho:       28,
    mudanca:     32,
    presente:    20,
    pesquisando:  5,
  };
  score += urgencia[signals.motivoTroca ?? ""] ?? 10;

  // Prazo declarado — 0–35 pts
  const prazo: Record<string, number> = {
    hoje:        35,
    essa_semana: 25,
    esse_mes:    14,
    sem_pressa:   3,
  };
  score += prazo[signals.prazoCompra ?? ""] ?? 5;

  return Math.max(0, Math.min(100, score));
}

export interface LeadClassificacao {
  prioridade: "critico" | "alto" | "medio" | "baixo";
  label: string;
  corHex: string;
  slaMinutos: number;
}

export function classificarLead(score: number): LeadClassificacao {
  if (score >= 70) return { prioridade: "critico", label: "🔥 Compra imediata",  corHex: "#ef4444", slaMinutos: 5   };
  if (score >= 45) return { prioridade: "alto",    label: "⚡ Alta intenção",    corHex: "#f97316", slaMinutos: 30  };
  if (score >= 20) return { prioridade: "medio",   label: "🟡 Em consideração", corHex: "#eab308", slaMinutos: 240 };
  return               { prioridade: "baixo",   label: "⚪ Pesquisando",     corHex: "#6b7280", slaMinutos: 1440 };
}
