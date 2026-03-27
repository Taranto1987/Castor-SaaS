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

export function trackOrcamentoGerado(totalPix: string, numItens: number) {
  push("orcamento_gerado", { total_pix: totalPix, num_itens: numItens });
}

export function trackOrcamentoSalvo(totalPix: string) {
  push("orcamento_salvo", { total_pix: totalPix });
}

export function trackMapaSonoCompleto(estrutura: string, firmeza: string, confianca: number) {
  push("mapa_sono_completo", { estrutura, firmeza, confianca });
}

export function trackOutletPedido(produto: string) {
  push("outlet_pedido", { produto });
}

export function trackCatalogoView() {
  push("catalogo_view");
}

export function trackPageView(pageName: string) {
  push("page_view", { page_name: pageName });
}

export function trackCatalogoWhatsApp(produto: string, loja: string) {
  push("whatsapp_click", { origem: "catalogo", loja, produto });
  push("catalogo_whatsapp", { produto, loja });
}
