import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { MessageCircle, Star, MapPin, ChevronRight, Shield, Zap, Wind, RotateCcw, Award, Tag, Brain, CheckCircle2, Sparkles, X, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import MapaSonoModal from "@/components/MapaSonoModal";
import { trackWhatsAppClick, trackPageView } from "@/lib/tracking";
import { useLoja } from "@/contexts/LojaContext";
import { useWAInfo } from "@/hooks/use-wa-info";
import type { CatalogoProduto } from "@/utils/groupProducts";
import type { ProductSize } from "@/utils/normalizeSize";

interface CatalogVariant {
  size: ProductSize;
  produtoId: number | null;
  slug: string | null;
  preco: string | null;
  precoPix: string | null;
  parcelamento: string | null;
  medidas: string | null;
  altura: string | null;
  imagem: string | null;
  disponivel: boolean;
  encomenda: boolean;
  estoque: number | null;
}

interface CatalogFamily {
  id: string;
  name: string;
  category: string;
  ranking: number;
  imageUrl: string | null;
  availableSizes: ProductSize[];
  variants: CatalogVariant[];
}

const MAPS_CABO_FRIO = "https://maps.app.goo.gl/UuF6w1nAvTgXockS6";
const MAPS_ARARUAMA  = "https://maps.app.goo.gl/cGmvFgeubawLRNGy8";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1584031402256-c787e148e02d?w=400&q=70";

function waLink(numero: string, loja: string, texto?: string) {
  const msg = texto ?? `Olá! Vi o site da Castor ${loja} e quero saber mais sobre os colchões!`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay },
});

const REGIOES = ["Cabo Frio", "Búzios", "Arraial do Cabo", "São Pedro da Aldeia", "Araruama", "Iguaba Grande", "Saquarema"];

function getBestVariant(variants: CatalogVariant[]): CatalogVariant | null {
  const withPrice = variants.filter(v => v.precoPix && v.disponivel);
  if (withPrice.length === 0) return variants.find(v => v.precoPix) ?? variants[0] ?? null;
  const sizeOrder: ProductSize[] = ["King", "Queen", "Casal", "Viúvo", "Solteiro King", "Solteiro"];
  for (const s of sizeOrder) {
    const found = withPrice.find(v => v.size === s);
    if (found) return found;
  }
  return withPrice[0];
}

function LocalBusinessJsonLd({ lojaId }: { lojaId: number }) {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": ["FurnitureStore", "LocalBusiness"],
      "@id": "https://lojacastorcabofrio.com.br/#organization",
      name: "Castor Colchões — Cabo Frio e Araruama",
      description: "Colchões Castor com tecnologia suíça. Diagnóstico personalizado do sono, entrega em toda a Região dos Lagos.",
      url: "https://lojacastorcabofrio.com.br",
      telephone: lojaId === 2 ? "+5522988447240" : "+5522992410112",
      image: "https://lojacastorcabofrio.com.br/opengraph.jpg",
      address: [
        { "@type": "PostalAddress", streetAddress: "Av. Júlia Kubitschek, 64", addressLocality: "Cabo Frio", addressRegion: "RJ", addressCountry: "BR", postalCode: "28913-100" },
        { "@type": "PostalAddress", streetAddress: "Av. Getúlio Vargas, 137", addressLocality: "Araruama", addressRegion: "RJ", addressCountry: "BR", postalCode: "28970-000" },
      ],
      openingHoursSpecification: [
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "09:00", closes: "18:00" },
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "09:00", closes: "13:00" },
      ],
      aggregateRating: { "@type": "AggregateRating", ratingValue: "5.0", reviewCount: "142", bestRating: "5", worstRating: "1" },
      priceRange: "$$",
    };
    let el = document.getElementById("lb-json-ld") as HTMLScriptElement | null;
    if (!el) { el = document.createElement("script"); el.id = "lb-json-ld"; el.type = "application/ld+json"; document.head.appendChild(el); }
    el.textContent = JSON.stringify(schema);
    return () => { document.getElementById("lb-json-ld")?.remove(); };
  }, [lojaId]);
  return null;
}

export default function Landing() {
  const [showMapa, setShowMapa] = useState(false);
  const [showCiencia, setShowCiencia] = useState(false);
  const { lojaId, selecionarLoja, detectarPorLocalizacao } = useLoja();
  const waInfo = useWAInfo();

  const { data: outletDestaque = [] } = useQuery<CatalogoProduto[]>({
    queryKey: ["outlet-destaque", lojaId],
    queryFn: async () => {
      const res = await fetch(`/api/produtos/outlet?lojaId=${lojaId}&limite=4`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: destaques = [], isLoading: destaquesLoading } = useQuery<CatalogFamily[]>({
    queryKey: ["landing-destaques", lojaId],
    queryFn: async () => {
      const res = await fetch(`/api/catalog/families?lojaId=${lojaId}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const topDestaques = destaques.slice(0, 6);

  const toggle = () => {
    const newId = lojaId === 2 ? 1 : 2;
    selecionarLoja(newId);
    detectarPorLocalizacao({ operacao: newId === 2 ? "araruama" : "cabo_frio" });
  };

  useEffect(() => { trackPageView("landing"); }, []);

  return (
    <div className="overflow-x-hidden">
      <LocalBusinessJsonLd lojaId={lojaId} />

      {/* ── HERO (compacto) ──────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 60px)"
        }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-14 md:pt-20 md:pb-16">
          <div className="max-w-2xl mx-auto md:mx-0 text-center md:text-left">
              <motion.div {...fade(0)} className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-full px-4 py-1.5 text-red-300 text-xs font-bold uppercase tracking-wider mb-5">
                <Star className="w-3.5 h-3.5 fill-red-400 text-red-400" /> Especialistas em Sono · Região dos Lagos – RJ
              </motion.div>

              <motion.h1 {...fade(0.1)} className="text-3xl md:text-4xl lg:text-5xl font-black leading-[1.08] tracking-tight mb-4">
                Não vendemos{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-300">colchão.</span>{" "}
                Resolvemos o seu sono.
              </motion.h1>

              <motion.p {...fade(0.15)} className="text-slate-300 text-base leading-relaxed mb-5 max-w-xl mx-auto md:mx-0">
                Diagnóstico personalizado, tecnologia suíça Castor e atendimento de quem realmente entende do assunto.
              </motion.p>

              <motion.div {...fade(0.2)} className="mb-6">
                  <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-2">📍 Qual loja mais perto de você?</p>
                  <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/15">
                    <button
                      onClick={() => lojaId !== 1 && toggle()}
                      aria-pressed={lojaId === 1}
                      className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all ${
                        lojaId === 1
                          ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      Cabo Frio
                    </button>
                    <button
                      onClick={() => lojaId !== 2 && toggle()}
                      aria-pressed={lojaId === 2}
                      className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all ${
                        lojaId === 2
                          ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      Araruama
                    </button>
                  </div>
                </motion.div>

              <motion.div {...fade(0.25)} className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <button onClick={() => setShowCiencia(true)} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-extrabold px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-red-900/40 active:scale-95 text-sm">
                  <Brain className="w-5 h-5" />
                  Descobrir meu perfil do sono
                </button>
                <Link href="/catalogo" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-7 py-3.5 rounded-2xl transition-all text-sm">
                  Ver catálogo <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
          </div>

          {/* Trust bar */}
          <motion.div {...fade(0.3)} className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: "⭐", v: "5.0", label: "Google Reviews" },
              { icon: "🏆", v: "Campeã", label: "ReclameAQUI 2025" },
              { icon: "🇨🇭", v: "60 anos", label: "Tecnologia Castor" },
              { icon: "✅", v: "ISO 9001", label: "Certificação INER" },
            ].map(b => (
              <div key={b.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">{b.icon}</span>
                <div>
                  <p className="text-white font-extrabold text-sm leading-tight">{b.v}</p>
                  <p className="text-white/70 text-xs">{b.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRODUTOS EM DESTAQUE ─────────────────────────────────────────── */}
      {(destaquesLoading || topDestaques.length > 0) && (
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div {...fade()} className="text-center mb-8">
              <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Mais procurados</p>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Destaques da Castor {waInfo.loja}</h2>
            </motion.div>

            {destaquesLoading && topDestaques.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-slate-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-slate-100 rounded w-1/3" />
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-5 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {topDestaques.map((family, i) => {
                const best = getBestVariant(family.variants);
                const img = family.imageUrl || best?.imagem || FALLBACK_IMG;
                const slug = best?.slug;
                const href = slug ? `/produto/${slug}` : "/catalogo";

                return (
                  <motion.div key={family.id} {...fade(i * 0.06)}>
                    <Link
                      href={href}
                      className="block bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-red-300 hover:shadow-lg transition-all group"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                        <img
                          src={img}
                          alt={`Colchão ${family.name}`}
                          width={800}
                          height={600}
                          sizes="(max-width: 768px) 50vw, 33vw"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading={i < 3 ? "eager" : "lazy"}
                          {...(i === 0 ? { fetchPriority: "high" as const } : {})}
                        />
                      </div>
                      <div className="p-3">
                        <span className="inline-block bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5">
                          {family.category === "colchoes" ? "Colchão"
                           : family.category === "cama-box-colchao" ? "Box + Colchão"
                           : family.category === "cama-box" ? "Cama Box"
                           : family.category}
                        </span>
                        <p className="font-bold text-slate-900 text-sm leading-tight line-clamp-2 group-hover:text-red-600 transition-colors">{family.name}</p>
                        {best?.precoPix && (
                          <div className="mt-1.5">
                            <span className="text-[10px] text-slate-400">Pix</span>
                            <p className="text-red-600 font-extrabold text-base">{best.precoPix}</p>
                          </div>
                        )}
                        {family.availableSizes.length > 1 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {family.availableSizes.map(s => (
                              <span key={s} className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            )}

            <motion.div {...fade(0.3)} className="text-center mt-8">
              <Link href="/catalogo" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold px-8 py-3.5 rounded-2xl shadow-lg transition-all active:scale-95 text-sm">
                Ver catálogo completo <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── CATEGORIAS (visual grid 3x2 com fotos) ────────────────────── */}
      <section className="py-14 bg-gradient-to-b from-[#f5f0ea] to-[#ede7df]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fade()} className="text-center mb-8">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Portfólio completo</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">Explore nossos produtos</h2>
            <p className="text-slate-500 mt-2 text-sm">Entrega em toda a Região dos Lagos — {REGIOES.join(" · ")}</p>
          </motion.div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { slug: "colchoes", label: "Colchões" },
              { slug: "cama-box-colchao", label: "Cama Box" },
              { slug: "cama-box", label: "Box Avulso" },
              { slug: "travesseiros", label: "Travesseiros" },
              { slug: "protetor", label: "Protetores" },
              { slug: "roupa-de-cama", label: "Roupa de Cama" },
            ].map((card, i) => {
              const family = destaques.find(f => f.category === card.slug);
              const imgSrc = family?.imageUrl ?? family?.variants[0]?.imagem ?? null;
              return (
                <motion.div key={card.slug} {...fade(i * 0.06)}>
                  <Link
                    href={`/catalogo?categoria=${card.slug}`}
                    className="group flex flex-col items-center text-center"
                  >
                    <div className="relative w-full aspect-square rounded-2xl bg-[#e8e2da] overflow-hidden mb-2 sm:mb-3">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={card.label}
                          width={400}
                          height={400}
                          className="w-full h-full object-contain p-3 sm:p-4 drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-16 h-12 bg-stone-300/40 rounded-lg animate-pulse" />
                        </div>
                      )}
                    </div>
                    <p className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-red-600 transition-colors leading-tight">
                      {card.label}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CIÊNCIA DO SONO CTA ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(139,92,246,0.2) 0%, transparent 50%)"
        }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 text-center md:text-left">
              <motion.div {...fade(0)} className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
                <Activity className="w-3.5 h-3.5" /> Ciência do Sono
              </motion.div>
              <motion.h2 {...fade(0.1)} className="text-2xl md:text-3xl font-black leading-tight mb-3">
                Entenda seu sono.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">Transforme seus dias.</span>
              </motion.h2>
              <motion.p {...fade(0.15)} className="text-slate-300 text-base leading-relaxed max-w-lg mb-4">
                Seu corpo é único. Seu sono também. Nossa inteligência analisa seu biotipo, postura, peso, dores e hábitos de descanso para identificar a solução mais compatível com você.
              </motion.p>
              <motion.div {...fade(0.2)} className="flex flex-wrap gap-3 justify-center md:justify-start text-sm">
                {[
                  "Personalização inteligente",
                  "Baseado em evidências",
                  "Resultado em 2 min",
                ].map(item => (
                  <span key={item} className="flex items-center gap-1.5 text-blue-200/80">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" /> {item}
                  </span>
                ))}
              </motion.div>
            </div>
            <motion.div {...fade(0.25)} className="flex-shrink-0">
              <button onClick={() => setShowCiencia(true)} className="flex items-center gap-2 bg-white text-slate-900 font-extrabold px-7 py-4 rounded-2xl shadow-xl hover:bg-blue-50 transition-all active:scale-95 text-base whitespace-nowrap">
                <Sparkles className="w-5 h-5 text-blue-600" /> Começar avaliação gratuita
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fade()} className="text-center mb-10">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Avaliações reais · Google</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">O que nossos clientes dizem</h2>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
              <span className="ml-2 text-slate-600 font-bold">5.0 no Google</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { texto: "Não sinto mais dores na coluna desde que comprei aqui. O Thalles foi super atencioso, explicou tudo com detalhes e a entrega foi mais rápida do que eu esperava. Recomendo demais!", local: "Cabo Frio" },
              { texto: "Atendimento humanizado faz toda diferença. Fui bem atendida, o vendedor conhece muito sobre ergonomia do sono. O colchão chegou rápido e a qualidade é incrível. Loja super séria!", local: "Búzios" },
              { texto: "Melhor compra que fiz! Acordava todo dia com dor nas costas, depois do colchão Castor isso acabou. O Thalles me ajudou a escolher o certo para o meu perfil. Nota 10!", local: "Arraial do Cabo" },
            ].map((d, i) => (
              <motion.div key={i} {...fade(i * 0.1)} className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(j => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed italic mb-4">"{d.texto}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <span className="text-red-600 font-bold text-xs">G</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Cliente Google · {d.local}</p>
                    <p className="text-[10px] text-slate-400">⭐⭐⭐⭐⭐ Google Maps</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECNOLOGIAS ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fade()} className="text-center mb-10">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Por que Castor é diferente</p>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Engenharia do sono.<br className="hidden md:block" /> Não só um colchão.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Zap, cor: "bg-blue-50 text-blue-600", titulo: "Pocket® Autêntico", desc: "Molas pré-comprimidas de aço temperado: se um se mexe, o outro não sente. Suporte individualizado real." },
              { icon: Wind, cor: "bg-cyan-50 text-cyan-600", titulo: "Fresh Comfort Gel®", desc: "Partículas de gel dissipam o calor corporal e mantêm a temperatura ideal (18–22°C) para o sono REM." },
              { icon: Shield, cor: "bg-emerald-50 text-emerald-600", titulo: "Actigard® Anti-ácaros", desc: "Tratamento suíço permanente no tecido que elimina ácaros, fungos e bactérias — essencial para quem tem rinite." },
              { icon: Award, cor: "bg-red-50 text-red-600", titulo: "Pró-Espuma INER", desc: "Densidade real certificada. D33 significa 33kg/m³ de matéria-prima verdadeira — sem carga mineral barata." },
              { icon: RotateCcw, cor: "bg-purple-50 text-purple-600", titulo: "Double Face", desc: "Pode girar dos dois lados, distribuindo o desgaste. Isso aumenta a durabilidade em até 50% — projetado para 10+ anos." },
              { icon: Star, cor: "bg-amber-50 text-amber-600", titulo: "Molas Tecnopedic®", desc: "Aço carbono com alto teor de manganês, temperado eletronicamente. Mantém o suporte ortopédico sem afundar." },
            ].map((t, i) => (
              <motion.div key={t.titulo} {...fade(i * 0.07)} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-red-200 transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${t.cor}`}>
                  <t.icon className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 mb-2">{t.titulo}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OFERTAS OUTLET ───────────────────────────────────────────────── */}
      {outletDestaque.length > 0 && (
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div {...fade()} className="flex items-center justify-between mb-8">
              <div>
                <p className="text-orange-500 font-bold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Preços especiais
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900">Ofertas Outlet</h2>
                <p className="text-slate-500 text-sm mt-1">Produtos disponíveis por encomenda com preço de fábrica</p>
              </div>
              <Link
                href="/catalogo?categoria=outlet"
                className="hidden md:flex items-center gap-2 text-orange-500 hover:text-orange-600 font-bold text-sm transition-colors"
              >
                Ver todos <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {outletDestaque.map((produto, i) => (
                <motion.div key={produto.id} {...fade(i * 0.07)}>
                  <Link
                    href="/catalogo?categoria=outlet"
                    className="block bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden hover:border-orange-300 hover:shadow-md transition-all group"
                  >
                    {produto.imagem && (
                      <div className="aspect-[4/3] overflow-hidden bg-white">
                        <img
                          src={produto.imagem}
                          alt={`${produto.familyName ?? produto.nome} - Outlet`}
                          width={400}
                          height={300}
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-3">
                      <span className="inline-block bg-orange-100 text-orange-600 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5">
                        🔥 Outlet
                      </span>
                      <p className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">{produto.familyName ?? produto.nome}</p>
                      {produto.precoPix && (
                        <p className="text-red-600 font-extrabold text-base mt-1">{produto.precoPix}</p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <motion.div {...fade(0.3)} className="text-center mt-6 md:hidden">
              <Link
                href="/catalogo?categoria=outlet"
                className="inline-flex items-center gap-2 text-orange-500 font-bold text-sm"
              >
                Ver todos os produtos outlet <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── LOCALIZAÇÃO + CTA FINAL ──────────────────────────────────────── */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <motion.div {...fade()}>
              <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-3">Nossas lojas</p>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Duas lojas na<br />Região dos Lagos</h2>
              <p className="text-slate-500 mb-5 leading-relaxed">
                Venha testar na prática e sair com a certeza de ter feito o melhor investimento para a sua saúde do sono.
              </p>

              {/* Cabo Frio */}
              <a href={MAPS_CABO_FRIO} target="_blank" rel="noreferrer"
                className="flex items-start gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-red-300 transition-all group mb-3">
                <MapPin className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-0.5">Cabo Frio</p>
                  <p className="font-extrabold text-slate-900 group-hover:text-red-600 transition-colors">Av. Júlia Kubitschek, 64</p>
                  <p className="text-sm text-slate-500">Jardim Flamboyant · Cabo Frio – RJ · 28913-100</p>
                  <p className="text-xs text-blue-500 font-semibold mt-1">Ver no Google Maps →</p>
                </div>
              </a>

              {/* Araruama */}
              <a href={MAPS_ARARUAMA} target="_blank" rel="noreferrer"
                className="flex items-start gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-red-300 transition-all group mb-4">
                <MapPin className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-0.5">Araruama</p>
                  <p className="font-extrabold text-slate-900 group-hover:text-red-600 transition-colors">Castor Colchões Araruama</p>
                  <p className="text-sm text-slate-500">Araruama – RJ</p>
                  <p className="text-xs text-blue-500 font-semibold mt-1">Ver no Google Maps →</p>
                </div>
              </a>

              <p className="text-xs text-slate-400">Seg–Sex: 9h às 18h &nbsp;·&nbsp; Sáb: 9h às 13h</p>
            </motion.div>

            {/* CTA WhatsApp */}
            <motion.div {...fade(0.15)} className="bg-gradient-to-br from-red-600 to-red-900 rounded-3xl p-8 text-white shadow-2xl shadow-red-900/30 text-center">
              <p className="text-red-200 text-sm font-bold uppercase tracking-wider mb-3">
                {lojaId === 2 ? "Loja Araruama" : "Fale agora mesmo"}
              </p>
              <h3 className="text-2xl font-black mb-3">Atendimento<br />personalizado</h3>
              <p className="text-red-100 text-sm leading-relaxed mb-6">
                Me chame no WhatsApp e eu respondo na hora. Se quiser, faça o Mapa do Sono antes — você já chega com seu perfil completo!
              </p>
              <a
                href={waLink(waInfo.numero, waInfo.loja)}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackWhatsAppClick("landing_cta", waInfo.loja)}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-extrabold px-6 py-4 rounded-2xl transition-all shadow-lg active:scale-95 text-base mb-3"
              >
                <MessageCircle className="w-5 h-5" />
                Falar com {waInfo.contato}
              </a>
              <p className="text-red-200/60 text-xs">{waInfo.tel} · Resposta imediata</p>
              {lojaId === 2 && (
                <p className="text-red-300/60 text-[10px] mt-1">Detectamos que você está próximo de Araruama</p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MODAL CIÊNCIA DO SONO (intro) ───────────────────────────────── */}
      <AnimatePresence>
        {showCiencia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCiencia(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              className="relative bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowCiencia(false)}
                aria-label="Fechar"
                className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>

              {/* Header */}
              <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-t-3xl px-6 pt-8 pb-6 text-center">
                <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
                  <Activity className="w-3.5 h-3.5" /> Ciência do Sono
                </div>
                <h2 className="text-2xl font-black text-white leading-tight mb-2">
                  Entenda seu sono.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">Transforme seus dias.</span>
                </h2>
                <p className="text-slate-400 text-sm">Seu corpo é único. Seu sono também.</p>
              </div>

              <div className="px-6 py-6 space-y-4">
                {/* Card 1 — Descoberta */}
                <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Brain className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Descoberta</span>
                  </div>
                  <p className="text-slate-800 text-sm leading-relaxed mb-3">
                    Nossa inteligência analisa seu <strong>biotipo, postura, peso, dores, temperatura corporal</strong> e hábitos de descanso para identificar a solução mais compatível com você.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    {["Análise personalizada", "Biotipo e medidas", "Dores e desconfortos", "Hábitos e qualidade do sono"].map(item => (
                      <span key={item} className="flex items-center gap-1 bg-white/80 border border-blue-100 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3 text-blue-500" /> {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card 2 — Autoridade */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                      <Sparkles className="w-4.5 h-4.5 text-violet-600" />
                    </div>
                    <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Recomendação inteligente</span>
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed mb-3">
                    Não mostramos primeiro um colchão. <strong>Primeiro entendemos você.</strong> Depois nossa IA cruza dezenas de variáveis para indicar a solução mais adequada ao seu perfil.
                  </p>
                  <div className="space-y-2">
                    {[
                      "Personalização inteligente",
                      "Baseado em evidências",
                      "Resultado em menos de 2 minutos",
                      "Recomendação imparcial",
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => {
                    setShowCiencia(false);
                    setShowMapa(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] text-base"
                >
                  <Sparkles className="w-5 h-5" />
                  Começar avaliação gratuita
                </button>

                <p className="text-center text-xs text-slate-400">
                  Tudo começa com o autoconhecimento. Sem compromisso.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL MAPA DO SONO ─────────────────────────────────────────────── */}
      <MapaSonoModal open={showMapa} onClose={() => setShowMapa(false)} />
    </div>
  );
}
