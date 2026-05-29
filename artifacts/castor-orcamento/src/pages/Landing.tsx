import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { MessageCircle, Star, MapPin, ChevronRight, Moon, Shield, Zap, Wind, RotateCcw, Award, BedDouble, Package, Box, Layers, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import MapaSonoModal from "@/components/MapaSonoModal";
import { trackWhatsAppClick, trackPageView } from "@/lib/tracking";
import { useLoja } from "@/contexts/LojaContext";
import { useWAInfo } from "@/hooks/use-wa-info";
import type { CatalogoProduto } from "@/utils/groupProducts";

const MAPS_CABO_FRIO = "https://maps.app.goo.gl/UuF6w1nAvTgXockS6";
const MAPS_ARARUAMA  = "https://maps.app.goo.gl/cGmvFgeubawLRNGy8";

function waLink(numero: string, loja: string, texto?: string) {
  const msg = texto ?? `Olá! Vi o site da Castor ${loja} e quero saber mais sobre os colchões!`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay },
});

const REGIOES = ["Cabo Frio", "Búzios", "Arraial do Cabo", "São Pedro da Aldeia", "Araruama", "Iguaba Grande", "Saquarema"];

export default function Landing() {
  const [showMapa, setShowMapa] = useState(false);
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

  // Synchronous toggle + background API fetch for full lojaInfo
  const toggle = () => {
    const newId = lojaId === 2 ? 1 : 2;
    selecionarLoja(newId);
    detectarPorLocalizacao({ operacao: newId === 2 ? "araruama" : "cabo_frio" });
  };

  useEffect(() => { trackPageView("landing"); }, []);

  return (
    <div className="overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 60px)"
        }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="flex flex-col md:flex-row items-center gap-12">

            {/* Text */}
            <div className="flex-1 text-center md:text-left">
              <motion.div {...fade(0)} className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-full px-4 py-1.5 text-red-300 text-xs font-bold uppercase tracking-wider mb-6">
                <Star className="w-3.5 h-3.5 fill-red-400 text-red-400" /> Especialistas em Sono · Região dos Lagos – RJ
              </motion.div>

              <motion.h1 {...fade(0.1)} className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight mb-6">
                Não vendemos<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-300">colchão.</span><br />
                Resolvemos<br />o seu sono.
              </motion.h1>

              <motion.p {...fade(0.2)} className="text-slate-300 text-lg leading-relaxed mb-4 max-w-xl">
                Diagnóstico personalizado, tecnologia suíça Castor e atendimento de quem realmente entende do assunto.
              </motion.p>

              {/* Cidades atendidas */}
              <motion.div {...fade(0.25)} className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                {REGIOES.map(c => (
                  <span key={c} className="bg-white/10 border border-white/15 text-white/70 text-xs font-semibold px-3 py-1 rounded-full">
                    📍 {c}
                  </span>
                ))}
              </motion.div>

              <motion.div {...fade(0.28)} className="mb-8">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2 text-center md:text-left">📍 Qual loja mais perto de você?</p>
                  <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/15">
                    <button
                      onClick={() => lojaId !== 1 && toggle()}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        lojaId === 1
                          ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      Cabo Frio
                    </button>
                    <button
                      onClick={() => lojaId !== 2 && toggle()}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        lojaId === 2
                          ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      Araruama
                    </button>
                  </div>
                </motion.div>

              <motion.div {...fade(0.3)} className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <button onClick={() => setShowMapa(true)} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-extrabold px-7 py-4 rounded-2xl transition-all shadow-xl shadow-red-900/40 active:scale-95 text-base">
                  <Moon className="w-5 h-5" />
                  Descobrir meu colchão ideal
                </button>
                <Link href="/catalogo" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-7 py-4 rounded-2xl transition-all text-base">
                  Ver catálogo <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>

            {/* Avatar hero card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="flex-shrink-0"
            >
              <a
                href={waLink(waInfo.numero, waInfo.loja, `Oi ${waInfo.contato}! Vi vocês no site e quero saber mais sobre os colchões Castor.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="block cursor-pointer group"
              >
                <div className="relative w-64 h-64 md:w-80 md:h-80 group-hover:scale-[1.02] transition-transform">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-red-900/30 rounded-[2rem] backdrop-blur-sm border border-white/10 shadow-2xl" />
                  <img
                    src={lojaId === 2 ? "/marcela-avatar.webp" : "/thalles-avatar.webp"}
                    alt={`Especialista ${waInfo.contato}`}
                    className="absolute inset-0 w-full h-full object-cover object-top rounded-[2rem]"
                    fetchPriority="high"
                    decoding="async"
                  />
                  <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl px-3 py-2">
                    <p className="text-white font-extrabold text-sm">Especialista {waInfo.contato}</p>
                    <p className="text-green-400 text-xs font-semibold">● Online agora · Mapa do Sono</p>
                  </div>
                </div>
              </a>
            </motion.div>
          </div>

          {/* Trust bar */}
          <motion.div {...fade(0.4)} className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <p className="text-white/50 text-xs">{b.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── MAPA DO SONO CTA ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-red-700 to-red-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
                <img src={lojaId === 2 ? "/marcela-avatar.webp" : "/thalles-avatar.webp"} alt={waInfo.contato} className="w-full h-full object-cover object-top" loading="lazy" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <motion.p {...fade(0)} className="text-red-200 text-sm font-bold uppercase tracking-wider mb-2">Exclusivo · Castor {waInfo.loja}</motion.p>
              <motion.h2 {...fade(0.1)} className="text-2xl md:text-3xl font-black leading-tight mb-3">
                Mapa do Sono com o Especialista {waInfo.contato}
              </motion.h2>
              <motion.p {...fade(0.2)} className="text-red-100 text-base leading-relaxed max-w-lg">
                Dormir mal, sentir desconforto ao acordar ou ter calor à noite são sinais de desalinhamento entre seu corpo e o colchão.
                <br /><br />
                Este diagnóstico de engenharia do sono analisa seu perfil e determina com precisão o colchão ideal — promovendo alinhamento da coluna, redistribuição de pressão e conforto térmico.
              </motion.p>
            </div>
            <motion.div {...fade(0.3)} className="flex-shrink-0">
              <button onClick={() => setShowMapa(true)} className="flex items-center gap-2 bg-white text-red-700 font-extrabold px-7 py-4 rounded-2xl shadow-xl hover:bg-red-50 transition-all active:scale-95 text-base whitespace-nowrap">
                <Moon className="w-5 h-5" /> Fazer o mapa agora
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TECNOLOGIAS ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fade()} className="text-center mb-12">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Por que Castor é diferente</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
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

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fade()} className="text-center mb-12">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Avaliações reais · Google</p>
            <h2 className="text-3xl font-black text-slate-900">O que nossos clientes dizem</h2>
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

      {/* ── CATEGORIAS ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fade()} className="text-center mb-12">
            <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-2">Portfólio completo</p>
            <h2 className="text-3xl font-black text-slate-900">Explore nossos produtos</h2>
            <p className="text-slate-500 mt-2 text-sm">Entrega em toda a Região dos Lagos — {REGIOES.join(" · ")}</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { Icon: BedDouble, nome: "Colchões",     desc: "Mola, espuma e híbrido",      cat: "colchoes",        iconBg: "bg-red-50",     iconColor: "text-red-600"     },
              { Icon: Package,   nome: "Cama Box",     desc: "Box + colchão conjunto",       cat: "cama-box-colchao",iconBg: "bg-amber-50",   iconColor: "text-amber-600"   },
              { Icon: Box,       nome: "Box Avulso",   desc: "Só a base cama box",           cat: "cama-box",        iconBg: "bg-slate-100",  iconColor: "text-slate-600"   },
              { Icon: Moon,      nome: "Travesseiros", desc: "Memória, látex e pluma",       cat: "travesseiros",    iconBg: "bg-violet-50",  iconColor: "text-violet-600"  },
              { Icon: Shield,    nome: "Protetores",   desc: "Proteção e higiene",           cat: "protetor",        iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
              { Icon: Layers,    nome: "Roupa de Cama",desc: "Jogo de lençóis e edredom",   cat: "roupa-de-cama",   iconBg: "bg-sky-50",     iconColor: "text-sky-600"     },
            ].map((c, i) => (
              <motion.div key={c.cat} {...fade(i * 0.07)}>
                <Link href={`/catalogo?categoria=${c.cat}`} className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-red-300 hover:shadow-md transition-all group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
                    <c.Icon className={`w-5 h-5 ${c.iconColor}`} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 group-hover:text-red-600 transition-colors leading-tight">{c.nome}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-400 ml-auto shrink-0 transition-colors" />
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div {...fade(0.3)} className="text-center mt-8">
            <Link href="/catalogo" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold px-8 py-4 rounded-2xl shadow-lg transition-all active:scale-95">
              Ver todo o catálogo <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── OFERTAS OUTLET ───────────────────────────────────────────────── */}
      {outletDestaque.length > 0 && (
        <section className="py-16 bg-white">
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
                          alt={produto.nome}
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
      <section className="py-20 bg-white">
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
                className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 hover:border-red-300 transition-all group mb-3">
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
                className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 hover:border-red-300 transition-all group mb-4">
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

            {/* CTA WhatsApp — inteligente por localização */}
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

      {/* ── FLOATING WHATSAPP — inteligente ──────────────────────────────── */}
      <a
        href={waLink(waInfo.numero, waInfo.loja)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackWhatsAppClick("landing_floating", waInfo.loja)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl shadow-green-900/40 transition-all active:scale-95 hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm hidden sm:inline">WhatsApp {waInfo.loja}</span>
      </a>

      {/* ── MODAL MAPA DO SONO ─────────────────────────────────────────────── */}
      <MapaSonoModal open={showMapa} onClose={() => setShowMapa(false)} />
    </div>
  );
}
