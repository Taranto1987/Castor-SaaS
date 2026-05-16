import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import * as Accordion from "@radix-ui/react-accordion";
import {
  Star, MessageCircle, MapPin, ChevronRight, ChevronDown,
  Shield, Zap, Wind, RotateCcw, Award, Moon, CheckCircle,
  X, ArrowRight, Users, Clock, Sparkles, Heart, ThumbsUp,
  BedDouble, TrendingUp, Phone, Eye,
} from "lucide-react";
import { trackWhatsAppClick } from "@/lib/tracking";
import SleepScienceSection from "@/components/lp/SleepScienceSection";
import MapaSonoModal from "@/components/MapaSonoModal";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WAContact {
  numero: string;
  nome: string;
  loja: string;
  tel: string;
}

export interface Review {
  name: string;
  city: string;
  text: string;
  time: string;
  initials: string;
}

export interface FAQItem {
  q: string;
  a: string;
}

export interface LPFeature {
  icon: "zap" | "wind" | "shield" | "award" | "rotate" | "star" | "moon" | "heart" | "trending" | "bed" | "sparkles" | "check" | "thumbsup" | "eye";
  title: string;
  desc: string;
  colorClass: string;
}

export interface LPConfig {
  pageTitle: string;
  metaDescription: string;
  badge: string;
  h1: string;
  headlineLine1: string;
  headlineLine2: string;
  headlineAccent: string;
  sub: string;
  ctaLabel: string;
  ctaSubtext: string;
  wa: WAContact;
  waAlt?: WAContact;
  scarcityText: string;
  scarcityEmoji: string;
  accentClasses: {
    bg: string;
    bgHover: string;
    bgLight: string;
    text: string;
    border: string;
    gradFrom: string;
    gradTo: string;
    ring: string;
  };
  heroGradient: string;
  features: LPFeature[];
  reviews: Review[];
  faq: FAQItem[];
  quizTitle: string;
  quizSub: string;
  garantiaText: string;
  cidade: string;
  mapLink: string;
  endereco: string;
  jsonLdExtra?: Record<string, unknown>;
  // Image slots — provide URLs when available
  images?: {
    heroBg?: string;          // Full-width hero background (1920×1080)
    specialistPhoto?: string; // Specialist portrait (800×1000)
    storeInterior?: string;   // Store interior (1200×800)
    productShot?: string;     // Mattress close-up (1200×800)
    deliveryPhoto?: string;   // Delivery team in action (1200×800)
    sleepScience?: string;    // "Enquanto você dorme" section background (portrait 3:4)
  };
}

// ── Tracking helpers ───────────────────────────────────────────────────────────

function pushEvent(event: string, data?: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });

  // Meta Pixel (fbq)
  if (typeof window !== "undefined" && (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq) {
    const fbq = (window as unknown as { fbq: (...args: unknown[]) => void }).fbq;
    if (event === "whatsapp_click") fbq("track", "Contact", data);
    if (event === "lp_quiz_completo") fbq("track", "Lead", data);
    if (event === "lp_cta_click") fbq("track", "InitiateCheckout", data);
  }

  // Google Ads conversion
  if (typeof window !== "undefined" && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
    const gtag = (window as unknown as { gtag: (...args: unknown[]) => void }).gtag;
    if (event === "whatsapp_click") {
      gtag("event", "conversion", { send_to: "AW-CONVERSION_ID/whatsapp_click" });
    }
  }
}

function useScrollDepthTracking(lpSlug: string) {
  const milestones = useRef(new Set<number>());
  useEffect(() => {
    function onScroll() {
      const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      [25, 50, 75, 90].forEach(m => {
        if (pct >= m && !milestones.current.has(m)) {
          milestones.current.add(m);
          pushEvent("lp_scroll_depth", { lp: lpSlug, depth: m });
        }
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lpSlug]);
}

function useTimeOnPage(lpSlug: string) {
  useEffect(() => {
    const start = Date.now();
    const timers = [30, 60, 120].map(secs =>
      window.setTimeout(() => pushEvent("lp_time_on_page", { lp: lpSlug, seconds: secs }), secs * 1000)
    );
    pushEvent("lp_view", { lp: lpSlug });
    return () => {
      timers.forEach(id => window.clearTimeout(id));
      const total = Math.round((Date.now() - start) / 1000);
      pushEvent("lp_exit", { lp: lpSlug, seconds_total: total });
    };
  }, [lpSlug]);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function waLink(wa: WAContact, msg: string) {
  return `https://wa.me/${wa.numero}?text=${encodeURIComponent(msg)}`;
}

function defaultWaMsg(wa: WAContact) {
  return `Olá ${wa.nome}! Vi o site da Castor ${wa.loja} e quero mais informações sobre colchões.`;
}

const ICON_MAP = {
  zap: Zap, wind: Wind, shield: Shield, award: Award, rotate: RotateCcw,
  star: Star, moon: Moon, heart: Heart, trending: TrendingUp, bed: BedDouble,
  sparkles: Sparkles, check: CheckCircle, thumbsup: ThumbsUp, eye: Eye,
};

// ── Meta & Schema injection ────────────────────────────────────────────────────

function PageMeta({ cfg }: { cfg: LPConfig }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = cfg.pageTitle;

    const metas: { name?: string; property?: string; content: string }[] = [
      { name: "description", content: cfg.metaDescription },
      { property: "og:title", content: cfg.pageTitle },
      { property: "og:description", content: cfg.metaDescription },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Castor Colchões" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: cfg.pageTitle },
      { name: "twitter:description", content: cfg.metaDescription },
    ];

    const added: HTMLMetaElement[] = [];
    metas.forEach(({ name, property, content }) => {
      const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      const isNew = !el;
      if (!el) {
        el = document.createElement("meta");
        if (name) el.name = name;
        if (property) el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.content = content;
      if (isNew) added.push(el);
    });

    return () => {
      document.title = prevTitle;
      added.forEach(el => el.remove());
    };
  }, [cfg]);
  return null;
}

function LocalBusinessSchema({ cfg }: { cfg: LPConfig }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "lb-schema";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": ["FurnitureStore", "LocalBusiness"],
      "@id": `https://castorcolchoes.com.br/#loja-${cfg.cidade.toLowerCase().replace(/ /g, "-")}`,
      name: `Castor Colchões ${cfg.cidade}`,
      description: cfg.metaDescription,
      url: "https://castorcolchoes.com.br",
      telephone: cfg.wa.tel,
      address: {
        "@type": "PostalAddress",
        streetAddress: cfg.endereco,
        addressLocality: cfg.cidade,
        addressRegion: "RJ",
        addressCountry: "BR",
      },
      openingHoursSpecification: [
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "18:00" },
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "09:00", closes: "13:00" },
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5.0",
        reviewCount: "142",
        bestRating: "5",
        worstRating: "1",
      },
      priceRange: "$$",
      hasMap: cfg.mapLink,
      ...cfg.jsonLdExtra,
    });
    document.getElementById("lb-schema")?.remove();
    document.head.appendChild(script);
    return () => document.getElementById("lb-schema")?.remove();
  }, [cfg]);
  return null;
}

function FAQSchema({ faq }: { faq: FAQItem[] }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "faq-schema";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
    document.getElementById("faq-schema")?.remove();
    document.head.appendChild(script);
    return () => document.getElementById("faq-schema")?.remove();
  }, [faq]);
  return null;
}

// ── Scarcity Bar with Countdown ────────────────────────────────────────────────

function useCountdown(targetHours = 4) {
  const [secs, setSecs] = useState<number>(() => {
    const stored = sessionStorage.getItem("castor-lp-countdown");
    if (stored) return parseInt(stored);
    return targetHours * 3600 + Math.floor(Math.random() * 1800);
  });

  useEffect(() => {
    sessionStorage.setItem("castor-lp-countdown", String(secs));
    if (secs <= 0) return;
    const id = window.setInterval(() => setSecs(s => {
      const next = Math.max(0, s - 1);
      sessionStorage.setItem("castor-lp-countdown", String(next));
      return next;
    }), 1000);
    return () => window.clearInterval(id);
  }, [secs]);

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ScarcityBar({ cfg, onDismiss }: { cfg: LPConfig; onDismiss: () => void }) {
  const countdown = useCountdown();
  return (
    <div className="bg-red-600 text-white py-2.5 px-4 flex items-center justify-center gap-3 text-xs sm:text-sm font-semibold relative">
      <span className="text-base">{cfg.scarcityEmoji}</span>
      <span dangerouslySetInnerHTML={{ __html: cfg.scarcityText }} />
      <span className="bg-red-800/60 px-2 py-0.5 rounded font-mono font-bold">{countdown}</span>
      <button onClick={onDismiss} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Exit Intent Popup ─────────────────────────────────────────────────────────

function ExitIntentPopup({ cfg, onClose }: { cfg: LPConfig; onClose: () => void }) {
  const wa = cfg.wa;
  const msg = `Olá ${wa.nome}! Estava saindo do site mas quero antes saber: qual o melhor colchão para mim? Pode me ajudar?`;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative text-center"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Moon className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-red-500 font-bold text-xs uppercase tracking-wider mb-2">Espera um segundo!</p>
        <h3 className="text-2xl font-black text-slate-900 mb-3">
          Diagnóstico de sono<br />100% gratuito
        </h3>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          Antes de sair, responda 3 perguntas e receba a indicação personalizada do seu colchão ideal — direto no WhatsApp.
        </p>
        <a
          href={waLink(wa, msg)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            pushEvent("lp_exit_intent_cta", { loja: wa.loja });
            trackWhatsAppClick("lp_exit_intent", wa.loja);
            onClose();
          }}
          className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-400 text-white font-extrabold px-6 py-4 rounded-2xl transition-all shadow-lg mb-3 text-base"
        >
          <MessageCircle className="w-5 h-5" />
          Quero o diagnóstico grátis
        </a>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs transition-colors">
          Não, prefiro dormir mal mesmo
        </button>
      </motion.div>
    </div>
  );
}

function useExitIntent(enabled: boolean) {
  const [show, setShow] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 20 && !fired.current) {
        fired.current = true;
        setShow(true);
        pushEvent("lp_exit_intent_trigger", {});
      }
    }
    document.addEventListener("mouseleave", onMouseLeave);
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, [enabled]);

  return { show, dismiss: () => setShow(false) };
}

// ── LGPD Cookie Notice ─────────────────────────────────────────────────────────

function LGPDNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const accepted = localStorage.getItem("castor-lgpd");
    if (!accepted) setShow(true);
  }, []);

  function accept() {
    localStorage.setItem("castor-lgpd", "1");
    setShow(false);
    pushEvent("lgpd_accept", {});
  }

  if (!show) return null;
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-[90] bg-slate-900 text-white px-4 py-4 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
          🍪 Usamos cookies para melhorar sua experiência, personalizar recomendações e medir o desempenho das páginas, conforme a <strong className="text-white">LGPD (Lei 13.709/18)</strong>. Ao continuar, você concorda com isso.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={accept} className="bg-white text-slate-900 font-bold text-xs px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors">
            Aceitar e continuar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Trust Bar ─────────────────────────────────────────────────────────────────

function TrustBar() {
  const items = [
    { emoji: "⭐", value: "5.0 Google", label: "Única na região" },
    { emoji: "🏆", value: "25 anos", label: "de especialização" },
    { emoji: "✅", value: "ISO 9001", label: "Certificado INER" },
    { emoji: "🇨🇭", value: "Castor®", label: "Tecnologia Suíça" },
  ];
  return (
    <div className="bg-white border-b border-slate-100 py-4">
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-2xl">{item.emoji}</span>
            <div>
              <p className="font-black text-slate-900 text-sm leading-tight">{item.value}</p>
              <p className="text-slate-400 text-xs">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Viewer Count ──────────────────────────────────────────────────────────────

function useViewerCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const base = 7 + (new Date().getHours() % 8);
    setCount(base + Math.floor(Math.random() * 5));
    const id = window.setInterval(() => {
      setCount(c => Math.max(5, Math.min(24, c + (Math.random() > 0.55 ? 1 : -1))));
    }, 11000);
    return () => window.clearInterval(id);
  }, []);
  return count;
}

// ── Mapa do Sono CTA Section ───────────────────────────────────────────────────

function MapaSonoSection({ onOpen }: { onOpen: () => void }) {
  return (
    <section id="mapa-sono" className="py-20 bg-slate-50">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(155deg, #6B0E1E 0%, #8B1428 100%)" }}
        >
          <div className="px-8 py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <Moon className="w-7 h-7 text-white" />
            </div>
            <p className="text-white/50 text-[11px] font-bold tracking-[0.25em] uppercase mb-3">
              Diagnóstico personalizado · gratuito
            </p>
            <h2 className="text-white text-3xl font-black leading-snug mb-3">
              Mapa do Sono
            </h2>
            <p className="text-white/70 text-[15px] leading-relaxed mb-8 max-w-md mx-auto">
              13 perguntas precisas. Motor de recomendação baseado em pesquisas do INER. Resultado entregue direto no WhatsApp — com o colchão certo para o seu corpo.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              {[
                "13 perguntas — só cliques",
                "Resultado no WhatsApp",
                "Atendimento imediato",
              ].map(item => (
                <div key={item} className="flex items-center gap-2 bg-white/8 rounded-full px-3 py-2 justify-center">
                  <svg className="w-3.5 h-3.5 text-white/70 shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="1.5,6 4.5,9 10.5,3" />
                  </svg>
                  <span className="text-white/70 text-[12px] font-medium whitespace-nowrap">{item}</span>
                </div>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
              onClick={onOpen}
              className="inline-flex items-center gap-2.5 bg-white font-black text-[15px] px-8 py-4 rounded-2xl shadow-lg shadow-black/20 transition-all"
              style={{ color: "#6B0E1E" }}
            >
              <Moon className="w-5 h-5" />
              Iniciar Mapa do Sono
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Reviews Carousel ───────────────────────────────────────────────────────────

function ReviewsCarousel({ cfg }: { cfg: LPConfig }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  useEffect(() => {
    if (!emblaApi) return;
    const id = window.setInterval(() => emblaApi.scrollNext(), 4000);
    return () => window.clearInterval(id);
  }, [emblaApi]);

  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <p className={`${cfg.accentClasses.text} font-bold text-sm uppercase tracking-wider mb-2`}>Avaliações reais · Google</p>
          <h2 className="text-3xl font-black text-slate-900 mb-3">Única loja 5.0 da Região dos Lagos</h2>
          <div className="flex items-center justify-center gap-1">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
            <span className="ml-2 font-bold text-slate-700">5.0 · 142 avaliações · 25 anos de mercado</span>
          </div>
        </motion.div>

        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex gap-5">
            {cfg.reviews.map((r, i) => (
              <div key={i} className="flex-shrink-0 w-80 sm:w-96 bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {r.initials}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.city} · {r.time}</p>
                  </div>
                  <div className="ml-auto bg-[#4285F4] rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-[10px]">G</span>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[1,2,3,4,5].map(j => <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">"{r.text}"</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <a href="https://maps.app.goo.gl/UuF6w1nAvTgXockS6" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            Ver todas as avaliações no Google <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FAQSection({ cfg }: { cfg: LPConfig }) {
  return (
    <section className="py-20 bg-slate-50">
      <FAQSchema faq={cfg.faq} />
      <div className="max-w-3xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <p className={`${cfg.accentClasses.text} font-bold text-sm uppercase tracking-wider mb-2`}>Dúvidas frequentes</p>
          <h2 className="text-3xl font-black text-slate-900">Perguntas e Respostas</h2>
        </motion.div>
        <Accordion.Root type="single" collapsible className="space-y-3">
          {cfg.faq.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <Accordion.Item value={`faq-${i}`} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors">
                <Accordion.Header>
                  <Accordion.Trigger className="flex items-center justify-between w-full text-left px-6 py-5 font-bold text-slate-900 hover:text-slate-700 transition-colors group">
                    <span>{f.q}</span>
                    <ChevronDown className="w-5 h-5 text-slate-400 group-data-[state=open]:rotate-180 transition-transform shrink-0 ml-4" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="px-6 pb-5 text-slate-600 text-sm leading-relaxed data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                  {f.a}
                </Accordion.Content>
              </Accordion.Item>
            </motion.div>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}

// ── Guarantee Strip ────────────────────────────────────────────────────────────

function GuaranteeStrip({ text }: { text: string }) {
  return (
    <div className="bg-emerald-50 border-y border-emerald-100 py-5">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-4 text-center">
        <Shield className="w-6 h-6 text-emerald-600 shrink-0" />
        <p className="font-bold text-emerald-800 text-sm sm:text-base">{text}</p>
        <Shield className="w-6 h-6 text-emerald-600 shrink-0 hidden sm:block" />
      </div>
    </div>
  );
}

// ── Floating CTA ───────────────────────────────────────────────────────────────

function FloatingCTA({ cfg }: { cfg: LPConfig }) {
  const [visible, setVisible] = useState(false);
  const wa = cfg.wa;
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 350);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2"
        >
          {/* Phone CTA — mobile only */}
          <a
            href={`tel:${wa.tel.replace(/\D/g, "")}`}
            onClick={() => pushEvent("lp_phone_click", { loja: wa.loja })}
            className="sm:hidden flex items-center justify-center w-11 h-11 bg-slate-900 rounded-2xl shadow-xl hover:bg-slate-700 transition-all"
            aria-label="Ligar agora"
          >
            <Phone className="w-5 h-5 text-white" />
          </a>
          <a
            href={waLink(wa, defaultWaMsg(wa))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick("lp_floating", wa.loja)}
            className="flex items-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-bold px-5 py-3.5 rounded-2xl shadow-2xl shadow-green-900/40 transition-all active:scale-95"
            style={{ filter: "drop-shadow(0 0 10px rgba(34,197,94,0.45))" }}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">WhatsApp agora</span>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Image section (product showcase) ──────────────────────────────────────────

function ProductShowcase({ cfg }: { cfg: LPConfig }) {
  const images = cfg.images;
  if (!images?.productShot && !images?.storeInterior && !images?.deliveryPhoto) return null;

  return (
    <section className="py-16 bg-slate-900 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {images.productShot && (
            <div className="sm:col-span-2 rounded-2xl overflow-hidden aspect-video relative">
              <img
                src={images.productShot}
                alt={`Colchão Castor ${cfg.cidade} — detalhe da tecnologia`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                width={800}
                height={450}
              />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                Tecnologia real · certificada pelo INER
              </div>
            </div>
          )}
          {images.storeInterior && (
            <div className="rounded-2xl overflow-hidden aspect-video sm:aspect-auto relative">
              <img
                src={images.storeInterior}
                alt={`Loja Castor Colchões ${cfg.cidade} — showroom`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                width={400}
                height={500}
              />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                Showroom · {cfg.cidade}
              </div>
            </div>
          )}
          {images.deliveryPhoto && !images.storeInterior && (
            <div className="rounded-2xl overflow-hidden aspect-video relative">
              <img
                src={images.deliveryPhoto}
                alt="Equipe de entrega Castor Colchões — montagem profissional"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                width={400}
                height={450}
              />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                Entrega + montagem grátis
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Main LP Template ───────────────────────────────────────────────────────────

export default function LPTemplate({ cfg }: { cfg: LPConfig }) {
  const [scarcityDismissed, setScarcityDismissed] = useState(false);
  const [showMapa, setShowMapa] = useState(false);
  const viewerCount = useViewerCount();
  const { show: exitShow, dismiss: exitDismiss } = useExitIntent(true);

  useScrollDepthTracking(cfg.wa.loja + "-" + cfg.cidade);
  useTimeOnPage(cfg.wa.loja + "-" + cfg.cidade);

  useEffect(() => {
    const d = sessionStorage.getItem(`castor-sc-${cfg.wa.loja}`);
    if (d) setScarcityDismissed(true);
  }, [cfg.wa.loja]);

  function dismissScarcity() {
    setScarcityDismissed(true);
    sessionStorage.setItem(`castor-sc-${cfg.wa.loja}`, "1");
  }

  const wa = cfg.wa;
  const waHref = waLink(wa, defaultWaMsg(wa));

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <PageMeta cfg={cfg} />
      <LocalBusinessSchema cfg={cfg} />

      {!scarcityDismissed && <ScarcityBar cfg={cfg} onDismiss={dismissScarcity} />}

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
              <BedDouble className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <span className="font-black text-slate-900 text-sm">Castor Colchões</span>
            <span className="hidden sm:inline text-slate-300 text-xs ml-1">· {cfg.cidade}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={`tel:${wa.tel.replace(/\D/g, "")}`}
              onClick={() => pushEvent("lp_phone_click", { loja: wa.loja })}
              className="hidden sm:flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors">
              <Phone className="w-3.5 h-3.5" /> {wa.tel}
            </a>
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick("lp_header", wa.loja)}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95">
              <MessageCircle className="w-3.5 h-3.5" /> Falar agora
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section
        className={`relative ${cfg.heroGradient} text-white overflow-hidden`}
        aria-label="Seção principal"
      >
        {cfg.images?.heroBg && (
          <img
            src={cfg.images.heroBg}
            alt=""
            role="presentation"
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-20"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={1920}
            height={1080}
          />
        )}
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 80px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 80px)"
        }} />

        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-24 sm:pt-20 sm:pb-28">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="flex flex-col lg:flex-row items-center gap-10">

            {/* Text block */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-2 mb-4">
                <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-white/90 text-xs font-bold uppercase tracking-wider">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{cfg.badge}
                </span>
                {viewerCount > 0 && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1.5 text-white/80 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />{viewerCount} vendo agora
                  </motion.span>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.06] tracking-tight mb-5">
                {cfg.headlineLine1}<br />
                <span className="text-white/85">{cfg.headlineLine2}</span>
                {cfg.headlineAccent && (
                  <><br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-100">{cfg.headlineAccent}</span></>
                )}
              </h1>

              <p className="text-white/70 text-lg leading-relaxed mb-7 max-w-xl">{cfg.sub}</p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <a href={waHref} target="_blank" rel="noopener noreferrer"
                  onClick={() => { trackWhatsAppClick("lp_hero", wa.loja); pushEvent("lp_cta_click", { loja: wa.loja, position: "hero" }); }}
                  className="group flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-extrabold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-green-900/30 active:scale-95 text-base">
                  <MessageCircle className="w-5 h-5" />{cfg.ctaLabel}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <button
                  onClick={() => setShowMapa(true)}
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-8 py-4 rounded-2xl transition-all text-base active:scale-95"
                >
                  <Moon className="w-5 h-5" /> Mapa do Sono grátis
                </button>
              </div>

              <p className="text-white/40 text-xs text-center lg:text-left">{cfg.ctaSubtext}</p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-5">
                {[
                  "⭐ 5.0 Google · Única na região",
                  "🏆 25+ anos de mercado",
                  "✅ Troca em 30 dias",
                ].map(t => (
                  <span key={t} className="text-white/65 text-xs font-semibold">{t}</span>
                ))}
              </div>
            </div>

            {/* Specialist photo */}
            {cfg.images?.specialistPhoto && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.15 }}
                className="shrink-0"
              >
                <div className="relative w-60 h-72 md:w-72 md:h-88 rounded-[2rem] overflow-hidden border-2 border-white/15 shadow-2xl">
                  <img
                    src={cfg.images.specialistPhoto}
                    alt={`Especialista ${wa.nome} — Castor Colchões ${cfg.cidade}`}
                    className="w-full h-full object-cover object-top"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={288}
                    height={352}
                  />
                  <div className="absolute bottom-4 left-3 right-3 bg-black/65 backdrop-blur-md rounded-xl px-3 py-2">
                    <p className="text-white font-extrabold text-sm">{wa.nome}</p>
                    <p className="text-green-400 text-xs font-semibold">● Online agora · Especialista</p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────────────────────────── */}
      <TrustBar />

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className={`${cfg.accentClasses.text} font-bold text-sm uppercase tracking-wider mb-2`}>Diferenciais exclusivos</p>
            <h2 className="text-3xl font-black text-slate-900">Por que a Castor é diferente</h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cfg.features.map((f, i) => {
              const Icon = ICON_MAP[f.icon];
              return (
                <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 mb-2 text-sm">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SLEEP SCIENCE — aparece só quando a foto estiver configurada ─────── */}
      {cfg.images?.sleepScience && <SleepScienceSection imageSrc={cfg.images.sleepScience} />}

      {/* ── PRODUCT IMAGES ──────────────────────────────────────────────────── */}
      <ProductShowcase cfg={cfg} />

      {/* ── GUARANTEE ───────────────────────────────────────────────────────── */}
      <GuaranteeStrip text={cfg.garantiaText} />

      {/* ── MAPA DO SONO ─────────────────────────────────────────────────── */}
      <MapaSonoSection onOpen={() => setShowMapa(true)} />

      {/* ── REVIEWS ─────────────────────────────────────────────────────────── */}
      <ReviewsCarousel cfg={cfg} />

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <FAQSection cfg={cfg} />

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className={`py-20 ${cfg.heroGradient} text-white relative overflow-hidden`}>
        {cfg.images?.heroBg && (
          <img src={cfg.images.heroBg} alt="" role="presentation" loading="lazy"
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-15" />
        )}
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-white/60 text-sm font-bold uppercase tracking-wider mb-3">Pronto para dormir bem?</p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">
              Atendimento humano.<br />Resposta imediata.
            </h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto leading-relaxed">
              {wa.nome} responde na hora — sem bots, sem scripts. Especialista que realmente conhece cada produto e vai te indicar o certo para o seu perfil.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={waHref} target="_blank" rel="noopener noreferrer"
                onClick={() => { trackWhatsAppClick("lp_final_cta", wa.loja); pushEvent("lp_cta_click", { loja: wa.loja, position: "final" }); }}
                className="group flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-extrabold px-10 py-5 rounded-2xl transition-all shadow-xl shadow-green-900/30 active:scale-95 text-lg">
                <MessageCircle className="w-6 h-6" />Falar com {wa.nome}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-white/60 text-xs"><Clock className="w-4 h-4" /> Resposta imediata</div>
              <div className="flex items-center gap-2 text-white/60 text-xs"><MapPin className="w-4 h-4" /> {cfg.cidade}</div>
              <div className="flex items-center gap-2 text-white/60 text-xs"><Users className="w-4 h-4" /> +2.000 clientes</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-8 text-center text-xs">
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-bold text-white mb-1">Castor Colchões — {cfg.cidade}</p>
          <p className="mb-2">{cfg.endereco} · {wa.tel}</p>
          <p className="mb-3">Seg–Sex: 9h às 18h · Sáb: 9h às 13h</p>
          <p className="text-slate-600">© {new Date().getFullYear()} Castor Colchões. Tecnologia suíça desde 1998 · Região dos Lagos, RJ.</p>
        </div>
      </footer>

      {/* ── FLOATING CTA ────────────────────────────────────────────────────── */}
      <FloatingCTA cfg={cfg} />

      {/* ── LGPD ────────────────────────────────────────────────────────────── */}
      <LGPDNotice />

      {/* ── EXIT INTENT ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {exitShow && <ExitIntentPopup cfg={cfg} onClose={exitDismiss} />}
      </AnimatePresence>

      {/* ── MAPA DO SONO MODAL ───────────────────────────────────────────────── */}
      <MapaSonoModal open={showMapa} onClose={() => setShowMapa(false)} />
    </div>
  );
}
