import { catalogo, fallback, type ProdutoCatalogo } from "./catalogoCastor";

export interface DiagnosticoInput {
  objetivo?: string;
  usuario_tipo?: string;
  frequencia?: string;
  altura_cm?: number;
  peso_kg?: number;
  conforto?: string;
  posicao?: string;
  dor?: string;
  calor?: string;
  tamanho?: string;
  historico?: string;
  tempo_uso_historico?: string;
  prioridade?: string;
  nome?: string;
  whatsapp?: string;
}

export interface DiagnosticoAnalise {
  suporte: "alto" | "medio" | "baixo";
  firmeza_final: string;
  tecnologia: string;
  flag_calibracao: "adaptacao_leve" | "adaptacao_moderada" | "adaptacao_intensa" | null;
  texto_calibracao: string | null;
}

export interface DiagnosticoSaida {
  perfil: string;
  suporte: string;
  firmeza: string;
  tecnologia: string;
  produto: string;
  justificativa: string;
  gatilho: string;
  confianca: number;
  flag_calibracao: string | null;
  texto_calibracao: string | null;
  produtoObj: ProdutoCatalogo;
}

const RANK_MOTOR: Record<string, number> = {
  firme: 4, intermediario_firme: 3, intermediario: 2, intermediario_macio: 1, macio: 0,
};
const HIST_FIRMEZA_MOTOR: Record<string, string> = {
  espuma:  "intermediario",
  mola:    "intermediario_firme",
  pocket:  "intermediario",
  madeira: "firme",
};
const HIST_TEMPO_MULT_MOTOR: Record<string, number> = {
  menos_2: 0, "2_5": 0.3, mais_5: 0.6, mais_10: 1.0,
};

export function processarDiagnostico(d: DiagnosticoInput): DiagnosticoAnalise {
  const peso = d.peso_kg ?? 70;
  const altura = d.altura_cm ?? 170;
  const imc = peso / (altura / 100) ** 2;

  let suporte: "alto" | "medio" | "baixo" = "medio";
  if (peso >= 90 || imc >= 28) suporte = "alto";
  if (peso <= 60 || imc <= 21) suporte = "baixo";

  let firmeza = "intermediario";
  if (d.conforto === "firme" || suporte === "alto") firmeza = "firme";
  if (d.conforto === "macio" && suporte !== "alto") firmeza = "macio";

  const score: Record<string, number> = { pocket: 0, hibrido: 0, espuma: 0, gel: 0 };

  if (d.usuario_tipo === "casal") score.pocket += 3;
  if (d.posicao === "lado") score.pocket += 2;
  if (d.posicao === "costas") score.hibrido += 2;
  if (d.posicao === "barriga") score.espuma += 2;

  if (suporte === "alto") { score.hibrido += 3; score.pocket += 2; }
  if (suporte === "medio") score.pocket += 2;
  if (suporte === "baixo") score.espuma += 2;

  if (d.dor && d.dor !== "nenhuma") { score.pocket += 2; score.hibrido += 2; }
  if (d.calor === "sim") score.gel += 3;

  if (d.prioridade === "max_durabilidade") score.hibrido += 2;
  if (d.prioridade === "custo_beneficio") score.espuma += 2;
  if (d.prioridade === "conforto") score.pocket += 2;

  if (d.historico === "mola") score.pocket += 2;
  if (d.historico === "espuma") score.espuma += 1;
  if (d.historico === "madeira") score.espuma += 3;

  const tecnologia = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];

  let firmeza_final = firmeza;
  if (d.dor === "lombar" || d.dor === "quadril") firmeza_final = "intermediario_firme";
  if (d.posicao === "lado" && suporte !== "alto") firmeza_final = "intermediario_macio";

  // Módulo 5 — Conforto Percebido vs Ideal (adaptation drift)
  let flag_calibracao: DiagnosticoAnalise["flag_calibracao"] = null;
  let texto_calibracao: string | null = null;

  if (d.historico && d.tempo_uso_historico) {
    const histF = HIST_FIRMEZA_MOTOR[d.historico] ?? "intermediario";
    const mult  = HIST_TEMPO_MULT_MOTOR[d.tempo_uso_historico] ?? 0;
    const histR = RANK_MOTOR[histF] ?? 2;
    const bioR  = RANK_MOTOR[firmeza_final] ?? 2;
    const delta = Math.abs(histR - bioR);

    if (delta > 0 && mult > 0) {
      const drift = Math.round(delta * mult);
      if (drift >= 2) {
        flag_calibracao  = "adaptacao_intensa";
        texto_calibracao = `Seu corpo se adaptou a ${d.historico} por muitos anos. O colchão ideal pode parecer diferente nos primeiros dias — isso é normal.`;
      } else if (drift === 1) {
        flag_calibracao  = "adaptacao_moderada";
        texto_calibracao = `Há uma pequena diferença entre o que seu corpo prefere e o que você está acostumado. O período de adaptação é de 7 a 15 dias.`;
      }
    }
  }

  return { suporte, firmeza_final, tecnologia, flag_calibracao, texto_calibracao };
}

export function selecionarProduto(
  d: DiagnosticoInput,
  analise: DiagnosticoAnalise
): ProdutoCatalogo {
  const tamanho = d.tamanho ?? "casal";

  // Exact match: tecnologia + firmeza + tamanho
  const exact = catalogo.filter(
    (p) =>
      p.tecnologias.includes(analise.tecnologia) &&
      p.firmezas.includes(analise.firmeza_final) &&
      p.tamanhos.includes(tamanho)
  );
  if (exact.length > 0) return exact[0];

  // Relax tamanho constraint — keep tecnologia + firmeza
  const byTecFirmeza = catalogo.filter(
    (p) =>
      p.tecnologias.includes(analise.tecnologia) &&
      p.firmezas.includes(analise.firmeza_final)
  );
  if (byTecFirmeza.length > 0) return byTecFirmeza[0];

  // Relax firmeza — keep tecnologia only
  const byTec = catalogo.filter((p) =>
    p.tecnologias.includes(analise.tecnologia)
  );
  if (byTec.length > 0) return byTec[0];

  return fallback();
}

export function gerarSaida(
  d: DiagnosticoInput,
  analise: DiagnosticoAnalise,
  produto: ProdutoCatalogo
): DiagnosticoSaida {
  const calor = d.calor === "sim" ? "calor" : "temperatura neutra";
  const perfil = `${d.usuario_tipo ?? "solo"} com ${d.dor ?? "nenhuma"} dor e ${calor}`;

  const justificativas: Record<string, string> = {
    pocket: "As molas ensacadas garantem isolamento de movimento e suporte independente para cada ponto do corpo.",
    hibrido: "O sistema híbrido combina o suporte das molas com o alívio de pressão da espuma, ideal para seu perfil.",
    espuma: "A espuma de alta densidade oferece conforto uniforme, excelente custo-benefício e durabilidade.",
    gel: "As partículas de gel dissipam o calor corporal durante a noite, garantindo sono mais fresco e reparador.",
  };

  const gatilhos: Record<string, string> = {
    pocket: "alívio de pressão + isolamento de movimento + suporte personalizado",
    hibrido: "alívio de dor + conforto + adaptação corporal",
    espuma: "custo-benefício + durabilidade + conforto",
    gel: "regulação térmica + conforto + sono reparador",
  };

  // Real confidence: penalise if fallback was used (no exact match) and if flag_calibracao is set
  let confianca = 0.9;
  if (analise.flag_calibracao === "adaptacao_intensa")  confianca -= 0.12;
  if (analise.flag_calibracao === "adaptacao_moderada") confianca -= 0.06;
  confianca = Math.round(Math.max(0.55, Math.min(0.95, confianca)) * 100) / 100;

  return {
    perfil,
    suporte: analise.suporte,
    firmeza: analise.firmeza_final,
    tecnologia: analise.tecnologia,
    produto: produto.nome,
    justificativa:
      justificativas[analise.tecnologia] ??
      "Compatível com seu peso, postura e necessidade de alívio de pressão.",
    gatilho:
      gatilhos[analise.tecnologia] ??
      "alívio de dor + conforto + adaptação corporal",
    confianca,
    flag_calibracao:  analise.flag_calibracao,
    texto_calibracao: analise.texto_calibracao,
    produtoObj: produto,
  };
}
