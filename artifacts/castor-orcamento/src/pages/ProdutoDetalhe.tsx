import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle, Package, Tag, Ruler, ShoppingCart, FileText, ClipboardList, ChevronDown, Heart } from "lucide-react";
import { useWAInfo } from "@/hooks/use-wa-info";

interface Produto {
  id: number;
  nome: string;
  slug: string | null;
  sku: string | null;
  preco: string | null;
  precoPix: string | null;
  parcelamento: string | null;
  medidas: string | null;
  altura: string | null;
  categoria: string | null;
  imagem: string | null;
  disponivel: boolean;
  encomenda: boolean;
  prazoEncomenda: string | null;
  estoque: number | null;
  precoBase: number | null;
  descricao?: string | null;
  fichaTecnica?: Record<string, unknown> | null;
}

// Descrição comercial real → texto puro truncado para meta tags (fallback no chamador).
function descricaoParaMeta(html: string | null | undefined): string | null {
  if (!html) return null;
  const texto = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  if (!texto) return null;
  return texto.length > 300 ? `${texto.slice(0, 297)}...` : texto;
}

const FICHA_LABELS: Record<string, string> = {
  biotipos_por_pessoa: "Biotipos (por pessoa)",
  biotipo: "Biotipo",
  tamanho: "Tamanho",
  medida: "Medida",
  altura: "Altura",
  pillow_top: "Pillow Top",
  conforto: "Conforto",
  tecido: "Tecido",
  cor: "Cor",
  estrutura_do_colchao: "Estrutura do Colchão",
  estrutura: "Estrutura",
  garantia: "Garantia",
  densidade: "Densidade",
  mola: "Mola",
  ventilacao: "Ventilação",
  peso_suportado: "Peso Suportado",
  peso_maximo: "Peso Máximo",
  composicao: "Composição",
  material: "Material",
  enchimento: "Enchimento",
  revestimento: "Revestimento",
  acabamento: "Acabamento",
  formato: "Formato",
  espessura: "Espessura",
  largura: "Largura",
  comprimento: "Comprimento",
  profundidade: "Profundidade",
};

const FICHA_HIDDEN_KEYS = new Set(["_raw", "url_key", "meta_title", "meta_description", "short_description"]);

const CATEGORY_LABELS: Record<string, string> = {
  "colchoes": "Colchões",
  "cama-box-colchao": "Box + Colchão",
  "cama-box": "Cama Box",
  "travesseiros": "Travesseiros",
  "protetor": "Protetores",
  "roupa-de-cama": "Roupa de Cama",
};


function gerarMsgWA(p: Produto, contato: string, loja: string): string {
  return `Olá, ${contato}! 👋 Vi o site da Castor ${loja} e tenho interesse em:\n\n*${p.nome}*\n${p.medidas ? `📐 ${p.medidas}\n` : ""}${p.precoPix ? `💰 Pix: ${p.precoPix}\n` : ""}${p.encomenda ? `⏱️ Prazo: ${p.prazoEncomenda ?? "A combinar"}\n` : ""}\nGostaria de confirmar disponibilidade e condições!`;
}

function useSEO(produto: Produto | null) {
  useEffect(() => {
    if (!produto) return;

    const catLabel = CATEGORY_LABELS[produto.categoria ?? ""] ?? produto.categoria ?? "Produto";
    const title = `${produto.nome} | Castor Cabo Frio`;
    const description = descricaoParaMeta(produto.descricao)
      ?? `${catLabel} — ${produto.nome}. ${produto.medidas ? `Medidas: ${produto.medidas}. ` : ""}${produto.precoPix ? `No Pix: ${produto.precoPix}. ` : ""}${produto.parcelamento ? `Parcelado: ${produto.parcelamento}. ` : ""}Compre na Castor Cabo Frio com entrega garantida.`;
    const image = produto.imagem ?? "";
    const canonicalSlug = (produto.slug ?? "").toLowerCase();
    const url = `${window.location.origin}/produto/${canonicalSlug}`;

    // Basic meta
    document.title = title;
    setMeta("description", description);

    // OpenGraph
    setMetaProp("og:type", "product");
    setMetaProp("og:title", title);
    setMetaProp("og:description", description);
    setMetaProp("og:image", image);
    setMetaProp("og:url", url);
    setMetaProp("og:site_name", "Castor Cabo Frio");
    setMetaProp("og:locale", "pt_BR");

    // Twitter Card
    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", title);
    setMetaName("twitter:description", description);
    setMetaName("twitter:image", image);

    // Canonical
    let canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    // schema.org Product JSON-LD
    const price = produto.precoBase ?? parseFloat((produto.precoPix ?? "0").replace(/[^0-9,]/g, "").replace(",", ".")) ?? 0;
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: produto.nome,
      sku: produto.sku ?? undefined,
      image: image ? [image] : undefined,
      description,
      brand: { "@type": "Brand", name: "Castor" },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "BRL",
        price: price.toFixed(2),
        availability: produto.disponivel
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: "Castor Cabo Frio" },
      },
    };

    let ld = document.getElementById("produto-ld-json") as HTMLScriptElement | null;
    if (!ld) {
      ld = document.createElement("script");
      ld.id = "produto-ld-json";
      ld.type = "application/ld+json";
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify(schema);

    return () => {
      document.title = "Castor Cabo Frio";
      ld?.remove();
      canonical?.remove();
    };
  }, [produto]);
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}
function setMetaProp(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.content = content;
}
function setMetaName(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

export default function ProdutoDetalhe() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const waInfo = useWAInfo();

  const [produto, setProduto] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSEO(produto);

  // Fetch product by slug — with redirect guards
  useEffect(() => {
    if (!params.slug) return;

    // Numeric ID: find the product and redirect to its canonical slug URL
    if (/^\d+$/.test(params.slug)) {
      fetch(`/api/produtos/${params.slug}`)
        .then(r => r.ok ? r.json() as Promise<Produto> : null)
        .then(data => {
          if (data?.slug) navigate(`/produto/${data.slug}`, { replace: true });
          else setNotFound(true);
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
      return;
    }

    // Uppercase slug: redirect to lowercase canonical
    if (params.slug !== params.slug.toLowerCase()) {
      navigate(`/produto/${params.slug.toLowerCase()}`, { replace: true });
      return;
    }

    setLoading(true);
    setNotFound(false);
    fetch(`/api/produtos/slug/${encodeURIComponent(params.slug)}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json() as Promise<Produto>;
      })
      .then(data => { if (data) setProduto(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  // Track product view
  useEffect(() => {
    if (!produto) return;
    try {
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "view_item", {
          items: [{ item_id: produto.sku, item_name: produto.nome, item_category: produto.categoria }],
        });
      }
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "ViewContent", {
          content_ids: [produto.sku ?? produto.id],
          content_name: produto.nome,
          content_category: produto.categoria,
          currency: "BRL",
          value: produto.precoBase ?? 0,
        });
      }
    } catch {}
  }, [produto]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !produto) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <Package className="w-16 h-16 text-slate-300" />
      <h1 className="text-2xl font-bold text-slate-700">Produto não encontrado</h1>
      <p className="text-slate-500 text-center">Este produto pode ter sido removido ou o endereço está incorreto.</p>
      <button
        onClick={() => navigate("/catalogo")}
        className="mt-2 flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Ver Catálogo
      </button>
    </div>
  );

  const catLabel = CATEGORY_LABELS[produto.categoria ?? ""] ?? produto.categoria;
  const disponivel = produto.disponivel && (produto.estoque === null || produto.estoque > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/catalogo")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Catálogo
          </button>
          <span className="text-slate-300">/</span>
          {catLabel && <span className="text-slate-500 text-sm">{catLabel}</span>}
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 text-sm font-medium truncate">{produto.nome}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid md:grid-cols-2 gap-8"
        >
          {/* ── Imagem ─────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-square flex items-center justify-center p-6">
            {produto.imagem ? (
              <img
                src={produto.imagem}
                alt={produto.nome}
                className="w-full h-full object-contain"
              />
            ) : (
              <Package className="w-24 h-24 text-slate-200" />
            )}
          </div>

          {/* ── Detalhes ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {catLabel && (
                <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  {catLabel}
                </span>
              )}
              {produto.encomenda ? (
                <span className="text-xs font-semibold bg-amber-50 text-amber-600 px-3 py-1 rounded-full">
                  Encomenda
                </span>
              ) : disponivel ? (
                <span className="text-xs font-semibold bg-green-50 text-green-600 px-3 py-1 rounded-full">
                  Em estoque
                </span>
              ) : (
                <span className="text-xs font-semibold bg-red-50 text-red-500 px-3 py-1 rounded-full">
                  Indisponível
                </span>
              )}
            </div>

            {/* Nome — h1 para SEO */}
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">{produto.nome}</h1>

            {/* Especificações */}
            <div className="flex flex-wrap gap-3">
              {produto.medidas && (
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Ruler className="w-4 h-4 text-slate-400" />
                  {produto.medidas}
                </div>
              )}
              {produto.altura && (
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Tag className="w-4 h-4 text-slate-400" />
                  Altura: {produto.altura}
                </div>
              )}
              {produto.sku && (
                <div className="text-xs text-slate-400">SKU: {produto.sku}</div>
              )}
            </div>

            {/* Preços */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              {produto.precoPix && (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-green-600">{produto.precoPix}</span>
                  <span className="text-sm text-slate-500">no Pix</span>
                </div>
              )}
              {produto.preco && produto.preco !== produto.precoPix && (
                <div className="text-sm text-slate-500 mt-0.5">
                  ou <span className="font-semibold text-slate-700">{produto.preco}</span> no cartão
                </div>
              )}
              {produto.parcelamento && (
                <div className="text-xs text-slate-400 mt-1">{produto.parcelamento}</div>
              )}
              {produto.encomenda && produto.prazoEncomenda && (
                <div className="text-xs text-amber-600 mt-2 font-medium">
                  ⏱️ Prazo estimado: {produto.prazoEncomenda}
                </div>
              )}
            </div>

            {/* CTA WhatsApp */}
            <a
              href={`https://wa.me/${waInfo.numero}?text=${encodeURIComponent(gerarMsgWA(produto, waInfo.contato, waInfo.loja))}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                try {
                  if ((window as any).gtag) (window as any).gtag("event", "whatsapp_click", { item_name: produto.nome });
                  if ((window as any).fbq) (window as any).fbq("track", "Contact", { content_name: produto.nome });
                } catch {}
              }}
              className="flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg shadow-green-500/25 transition-all active:scale-95 text-lg"
            >
              <MessageCircle className="w-6 h-6" />
              Tenho interesse
            </a>

            <a
              href="/catalogo"
              className="flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 text-sm py-2 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Ver mais produtos
            </a>
          </div>
        </motion.div>

        {/* ── Por que você vai amar ─────────────────────────────── */}
        {produto.fichaTecnica && (produto.fichaTecnica as any)?._raw?.short_description_html && (
          <ShortDescriptionSection html={(produto.fichaTecnica as any)._raw.short_description_html} />
        )}

        {/* ── Descrição ───────────────────────────────────────────── */}
        {produto.descricao && (
          <DescricaoSection
            html={produto.descricao}
            shortHtml={(produto.fichaTecnica as any)?._raw?.short_description_html}
          />
        )}

        {/* ── Ficha Técnica ───────────────────────────────────────── */}
        {produto.fichaTecnica && Object.keys(produto.fichaTecnica).some(k => !FICHA_HIDDEN_KEYS.has(k)) && (
          <FichaTecnicaSection ficha={produto.fichaTecnica} />
        )}
      </main>
    </div>
  );
}

function ShortDescriptionSection({ html }: { html: string }) {
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/style="[^"]*"/gi, "")
    .replace(/class="[^"]*"/gi, "");

  const plainText = clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plainText || plainText.length < 20) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="mt-8 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-6 py-4 border-b border-blue-100">
        <Heart className="w-5 h-5 text-rose-500" />
        <h2 className="text-slate-800 font-semibold">Por que você vai amar este produto</h2>
      </div>

      <div className="px-6 py-5">
        <div
          className="prose prose-sm prose-slate max-w-none
            [&_p]:text-sm [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-3
            [&_ul]:text-sm [&_ul]:text-slate-600 [&_ul]:pl-4 [&_ul]:mb-2
            [&_li]:mb-1
            [&_strong]:text-slate-800"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      </div>
    </motion.div>
  );
}

function DescricaoSection({ html, shortHtml }: { html: string; shortHtml?: string }) {
  const [expanded, setExpanded] = useState(false);

  let filtered = html;
  if (shortHtml) {
    const shortPlain = shortHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (shortPlain && filtered.includes(shortPlain.slice(0, 40))) {
      filtered = filtered.replace(shortHtml, "");
    }
  }

  const clean = filtered
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/style="[^"]*"/gi, "")
    .replace(/class="[^"]*"/gi, "");

  const plainText = clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plainText || plainText.length < 20) return null;

  const isLong = plainText.length > 400;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <FileText className="w-5 h-5 text-blue-500" />
          Descrição
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className={`relative px-6 overflow-hidden transition-all duration-300 ${expanded ? "pb-6 max-h-[4000px]" : isLong ? "pb-0 max-h-48" : "pb-6 max-h-[4000px]"}`}>
        <div
          className="prose prose-sm prose-slate max-w-none
            [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
            [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
            [&_p]:text-sm [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-2
            [&_ul]:text-sm [&_ul]:text-slate-600 [&_ul]:pl-4 [&_ul]:mb-2
            [&_li]:mb-0.5
            [&_strong]:text-slate-800"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
        {!expanded && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>

      {isLong && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-3 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors border-t border-slate-100"
        >
          Ver descrição completa
        </button>
      )}
    </motion.div>
  );
}

function FichaTecnicaSection({ ficha }: { ficha: Record<string, unknown> }) {
  const entries = Object.entries(ficha)
    .filter(([key, val]) => !FICHA_HIDDEN_KEYS.has(key) && val !== null && val !== undefined && String(val).trim() !== "")
    .map(([key, val]) => ({
      label: FICHA_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      value: String(val).trim(),
    }));

  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <ClipboardList className="w-5 h-5 text-blue-500" />
        <h2 className="text-slate-800 font-semibold">Ficha técnica</h2>
      </div>

      <div className="divide-y divide-slate-100">
        {entries.map(({ label, value }, i) => (
          <div
            key={i}
            className={`flex items-start justify-between px-6 py-3 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
          >
            <span className="text-sm text-slate-500 min-w-[40%]">{label}</span>
            <span className="text-sm text-slate-800 font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
