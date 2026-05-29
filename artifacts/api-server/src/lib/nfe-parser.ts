import * as cheerio from "cheerio";

export interface NFeItem {
  nome: string;
  sku: string | null;
  quantidade: number;
  custoUnitario: number;
  precoCusto: string | null;
  unidade: string;
}

export interface NFeParsed {
  fornecedor: string | null;
  cnpjFornecedor: string | null;
  numeroNF: string | null;
  itens: NFeItem[];
}

function parseBrDecimal(s: string): number {
  return parseFloat(s.replace(",", ".")) || 0;
}

export function parseNFe(xmlContent: string): NFeParsed {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const $ = (cheerio as any).load(xmlContent, { xmlMode: true });

  const fornecedor = $("emit xNome").first().text().trim() || null;
  const cnpjFornecedor = $("emit CNPJ").first().text().trim() || null;
  const numeroNF = $("ide nNF").first().text().trim() || null;

  const itens: NFeItem[] = [];

  $("det").each((_: number, el: unknown) => {
    const det = $(el);
    const nome = det.find("xProd").text().trim();
    if (!nome) return;

    const sku = det.find("cProd").text().trim() || null;
    const quantidade = Math.max(1, Math.round(parseBrDecimal(det.find("qCom").text())));
    const custoUnitario = parseBrDecimal(det.find("vUnCom").text());
    const unidade = det.find("uCom").text().trim() || "UN";

    const precoCusto =
      custoUnitario > 0
        ? `R$ ${custoUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null;

    itens.push({ nome, sku, quantidade, custoUnitario, precoCusto, unidade });
  });

  return { fornecedor, cnpjFornecedor, numeroNF, itens };
}
