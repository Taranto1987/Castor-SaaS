declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

function push(event: string, data?: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
}

export function trackWhatsAppClick(origem: string, loja: string) {
  push("whatsapp_click", { origem, loja });
}

export function trackOrcamentoGerado(valor: string, qtdProdutos: number) {
  push("orcamento_gerado", { valor, qtd_produtos: qtdProdutos });
}

export function trackOrcamentoSalvo(valor: string) {
  push("orcamento_salvo", { valor });
}

export function trackMapaSonoCompleto(estrutura: string, firmeza: string, confianca: number) {
  push("mapa_sono_completo", { estrutura, firmeza, confianca });
}

export function trackOutletPedido(produtoNome: string) {
  push("outlet_pedido", { produto_nome: produtoNome });
}

export function trackPageView(pageName: string) {
  push("page_view", { page_name: pageName });
}

export function trackCatalogoWhatsApp(produtoNome: string, loja: string) {
  push("whatsapp_click", { origem: "catalogo_produto", loja, produto_nome: produtoNome });
}
