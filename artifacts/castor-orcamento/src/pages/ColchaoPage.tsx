import { motion } from "framer-motion";
import { Link } from "wouter";
import { MessageCircle, MapPin, Star, ChevronRight, Moon, Shield, Award, Phone } from "lucide-react";
import { SEO, LOCAL_BUSINESS_SCHEMA } from "@/components/SEO";
import { LOJAS, type LojaKey } from "@/lib/lojas";
import { trackWhatsAppWithAds } from "@/lib/tracking";

const TESTIMONIALS: Record<LojaKey, { texto: string; nome: string }[]> = {
  "cabo-frio": [
    { texto: "Não sinto mais dores na coluna desde que comprei aqui. O Thalles foi super atencioso, explicou tudo com detalhes e a entrega foi mais rápida do que esperava!", nome: "Maria S. · Cabo Frio" },
    { texto: "Melhor compra que fiz! Acordava todo dia com dor nas costas, depois do colchão Castor isso acabou. O Thalles me ajudou a escolher o certo.", nome: "João P. · Búzios" },
    { texto: "Atendimento humanizado faz toda diferença. Loja super séria, colchão chegou rápido e a qualidade é incrível!", nome: "Ana C. · Arraial do Cabo" },
  ],
  araruama: [
    { texto: "A Marcela foi incrível! Me explicou cada detalhe sobre o colchão ideal pro meu problema na coluna. Recomendo demais a loja de Araruama!", nome: "Fernanda L. · Araruama" },
    { texto: "Finalmente durmo bem! A Marcela entende muito de sono e me ajudou a escolher o colchão perfeito. Entrega rápida e produto de qualidade.", nome: "Carlos M. · Saquarema" },
    { texto: "Comprei na loja de Araruama e fiquei impressionada com o conhecimento da Marcela. Colchão chegou em ótimo estado e o sono melhorou muito!", nome: "Patrícia R. · Iguaba Grande" },
  ],
};

const CITY_CONTENT: Record<LojaKey, {
  heading: string;
  subheading: string;
  description: string;
  features: string[];
  regioes: string[];
}> = {
  "cabo-frio": {
    heading: "Colchão em Cabo Frio",
    subheading: "Castor Colchões · Especialistas em Sono",
    description: "A maior loja de colchões Castor em Cabo Frio. Tecnologia suíça, diagnóstico personalizado de sono e atendimento com o especialista ThallesZzz. Entregamos em Cabo Frio, Búzios, Arraial do Cabo, São Pedro da Aldeia e toda a Região dos Lagos.",
    features: [
      "Colchões ortopédicos com mola Pocket autêntica",
      "Tecnologia Fresh Comfort Gel® para regular temperatura",
      "Tratamento suíço Actigard® anti-ácaros",
      "Garantia de 10 anos · Certificação INER",
      "Diagnóstico de sono gratuito com ThallesZzz",
      "Entrega grátis em Cabo Frio e região",
    ],
    regioes: ["Cabo Frio", "Búzios", "Arraial do Cabo", "São Pedro da Aldeia", "Iguaba Grande", "Araruama"],
  },
  araruama: {
    heading: "Colchão em Araruama",
    subheading: "Castor Colchões · Especialistas em Sono",
    description: "A loja Castor Colchões em Araruama. Tecnologia suíça, diagnóstico personalizado de sono e atendimento com a especialista Marcela. Entregamos em Araruama, Saquarema, Iguaba Grande, Maricá e região.",
    features: [
      "Colchões ortopédicos com mola Pocket autêntica",
      "Tecnologia Fresh Comfort Gel® para regular temperatura",
      "Tratamento suíço Actigard® anti-ácaros",
      "Garantia de 10 anos · Certificação INER",
      "Diagnóstico de sono gratuito com Marcela",
      "Entrega grátis em Araruama e região",
    ],
    regioes: ["Araruama", "Saquarema", "Iguaba Grande", "Maricá", "Rio Bonito", "Silva Jardim"],
  },
};

const LOCAL_SCHEMA: Record<LojaKey, object> = {
  "cabo-frio": {
    ...LOCAL_BUSINESS_SCHEMA,
    name: "Castor Colchões Cabo Frio",
    telephone: "+5522992410112",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av. Júlia Kubitschek, 64",
      addressLocality: "Cabo Frio",
      addressRegion: "RJ",
      postalCode: "28913-100",
      addressCountry: "BR",
    },
  },
  araruama: {
    ...LOCAL_BUSINESS_SCHEMA,
    name: "Castor Colchões Araruama",
    telephone: "+5522988447240",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Araruama",
      addressRegion: "RJ",
      addressCountry: "BR",
    },
  },
};

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

interface ColchaoPageProps {
  loja: LojaKey;
}

export default function ColchaoPage({ loja }: ColchaoPageProps) {
  const lojaData = LOJAS[loja];
  const content = CITY_CONTENT[loja];
  const testimonials = TESTIMONIALS[loja];
  const slug = loja === "cabo-frio" ? "/colchao-cabo-frio" : "/colchao-araruama";

  const waUrl = `https://wa.me/${lojaData.whatsapp}?text=${encodeURIComponent(
    `Olá, ${lojaData.nome}! Vi a página de colchões em ${lojaData.cidade} e quero saber mais.`
  )}`;

  const seoTitle = `Colchão em ${lojaData.cidade} | Castor Colchões – RJ`;
  const seoDesc = `${content.description} Colchões ortopédicos com tecnologia suíça. Fale agora com ${lojaData.nome}: ${lojaData.tel}.`;

  return (
    <div className="overflow-x-hidden">
      <SEO
        title={seoTitle}
        description={seoDesc}
        city={lojaData.cidade}
        canonical={slug}
        jsonLd={LOCAL_SCHEMA[loja]}
      />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fade()} className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-full px-4 py-1.5 text-red-300 text-xs font-bold uppercase tracking-wider mb-6">
            <MapPin className="w-3.5 h-3.5" /> {lojaData.cidade} – RJ · Região dos Lagos
          </motion.div>

          <motion.h1 {...fade(0.1)} className="text-4xl md:text-5xl font-black leading-tight mb-4">
            {content.heading}
          </motion.h1>
          <motion.p {...fade(0.15)} className="text-red-300 font-bold text-lg mb-4">{content.subheading}</motion.p>
          <motion.p {...fade(0.2)} className="text-slate-300 text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            {content.description}
          </motion.p>

          <motion.div {...fade(0.3)} className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppWithAds(`colchao_${loja}_hero`, lojaData.cidade)}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-extrabold px-8 py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-base"
            >
              <MessageCircle className="w-5 h-5" />
              Falar com {lojaData.nome}
            </a>
            <Link
              href="/catalogo"
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-8 py-4 rounded-2xl transition-all text-base"
            >
              Ver catálogo <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── REGIÕES ATENDIDAS ───────────────────────────────────────────── */}
      <section className="bg-slate-50 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-500 text-sm font-semibold mb-4">Entregamos em:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {content.regioes.map(r => (
              <span key={r} className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-1.5 rounded-full">
                📍 {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIFERENCIAIS ───────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fade()} className="text-center mb-12">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Por que escolher a Castor</p>
            <h2 className="text-3xl font-black text-slate-900">
              Colchão de qualidade em {lojaData.cidade}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {content.features.map((f, i) => (
              <motion.div key={f} {...fade(i * 0.06)} className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <Shield className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-slate-700 text-sm font-semibold leading-snug">{f}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS LOCAIS ─────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fade()} className="text-center mb-10">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">O que dizem nossos clientes de {lojaData.cidade}</p>
            <h2 className="text-3xl font-black text-slate-900">Avaliações reais · Google</h2>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
              <span className="ml-2 text-slate-600 font-bold">5.0 no Google</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={i} {...fade(i * 0.1)} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(j => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed italic mb-4">"{t.texto}"</p>
                <p className="text-xs font-bold text-slate-500">{t.nome}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA CONTATO ────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gradient-to-br from-red-700 to-red-900 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <Award className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <motion.h2 {...fade()} className="text-3xl font-black mb-4">
            Fale com {lojaData.nome} agora
          </motion.h2>
          <motion.p {...fade(0.1)} className="text-red-100 text-lg leading-relaxed mb-6">
            Diagnóstico de sono personalizado · Tecnologia suíça Castor · Atendimento em {lojaData.cidade}
          </motion.p>

          <motion.div {...fade(0.2)} className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppWithAds(`colchao_${loja}_cta`, lojaData.cidade)}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-extrabold px-8 py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-base"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp {lojaData.nome}
            </a>
            <a
              href={`tel:+${lojaData.whatsapp}`}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-8 py-4 rounded-2xl transition-all text-base"
            >
              <Phone className="w-5 h-5" />
              {lojaData.tel}
            </a>
          </motion.div>

          <motion.p {...fade(0.3)} className="mt-6 text-red-200/60 text-sm">
            <MapPin className="w-4 h-4 inline mr-1" />
            {lojaData.endereco}
          </motion.p>
        </div>
      </section>

      {/* ── LINK PARA A OUTRA LOJA ─────────────────────────────────────── */}
      <section className="py-8 px-4 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-500 text-sm mb-3">Também atendemos na outra loja:</p>
          <Link
            href={loja === "cabo-frio" ? "/colchao-araruama" : "/colchao-cabo-frio"}
            className="inline-flex items-center gap-2 text-red-600 font-bold hover:underline text-sm"
          >
            Castor Colchões {loja === "cabo-frio" ? "Araruama" : "Cabo Frio"} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FLOATING WHATSAPP ──────────────────────────────────────────── */}
      <a
        href={waUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackWhatsAppWithAds(`colchao_${loja}_floating`, lojaData.cidade)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl shadow-green-900/40 transition-all active:scale-95 hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm hidden sm:inline">WhatsApp {lojaData.cidade}</span>
      </a>
    </div>
  );
}
