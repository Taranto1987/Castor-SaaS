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
  prioridade?: string;
  nome?: string;
  whatsapp?: string;
}

export interface DiagnosticoAnalise {
  suporte: "alto" | "medio" | "baixo";
  firmeza_final: string;
  tecnologia: string;
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
  produtoObj: ProdutoCatalogo;
}

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
  if (d.dor === "lombar") firmeza_final = "intermediario_firme";
  if (d.posicao === "lado" && suporte !== "alto") firmeza_final = "intermediario_macio";

  return { suporte, firmeza_final, tecnologia };
}

export function selecionarProduto(
  d: DiagnosticoInput,
  analise: DiagnosticoAnalise
): ProdutoCatalogo {
  const tamanho = d.tamanho ?? "casal";
  const candidatos = catalogo.filter(
    (p) =>
      p.tecnologias.includes(analise.tecnologia) &&
      p.firmezas.includes(analise.firmeza_final) &&
      p.tamanhos.includes(tamanho)
  );
  return candidatos[0] ?? fallback();
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
    confianca: 0.9,
    produtoObj: produto,
  };
}
