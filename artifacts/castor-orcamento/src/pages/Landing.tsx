import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { MessageCircle, Star, MapPin, ChevronRight, Moon, Shield, Zap, Wind, RotateCcw, Award } from "lucide-react";
import MapaSonoModal from "@/components/MapaSonoModal";

const WHATSAPP = "https://wa.me/5522992410112?text=Olá! Vi o site da Castor Cabo Frio e quero saber mais sobre os colchões!";
const MAPS = "https://maps.app.goo.gl/UuF6w1nAvTgXockS6";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay },
});

const REGIOES = ["Cabo Frio", "Búzios", "Arraial do Cabo", "São Pedro da Aldeia", "Araruama", "Iguaba Grande", "Saquarema"];

export default function Landing() {
  const [showMapa, setShowMapa] = useState(false);

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
              <motion.div {...fade(0.25)} className="flex flex-wrap gap-2 justify-center md:justify-start mb-8">
                {REGIOES.map(c => (
                  <span key={c} className="bg-white/10 border border-white/15 text-white/70 text-xs font-semibold px-3 py-1 rounded-full">
                    📍 {c}
                  </span>
                ))}
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
              <div className="relative w-64 h-64 md:w-80 md:h-80">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-red-900/30 rounded-[2rem] backdrop-blur-sm border border-white/10 shadow-2xl" />
                <img
                  src="/thalles-avatar.jpg"
                  alt="Especialista ThallesZzz"
                  className="absolute inset-0 w-full h-full object-cover object-top rounded-[2rem]"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl px-3 py-2">
                  <p className="text-white font-extrabold text-sm">Especialista ThallesZzz</p>
                  <p className="text-green-400 text-xs font-semibold">● Online agora · Mapa do Sono</p>
                </div>
              </div>
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
                <img src="/thalles-avatar.jpg" alt="ThallesZzz" className="w-full h-full object-cover object-top" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <motion.p {...fade(0)} className="text-red-200 text-sm font-bold uppercase tracking-wider mb-2">Exclusivo · Castor Cabo Frio</motion.p>
              <motion.h2 {...fade(0.1)} className="text-2xl md:text-3xl font-black leading-tight mb-3">
                Mapa do Sono com o Especialista ThallesZzz
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
              { emoji: "🛏️", nome: "Colchões", desc: "Mola, espuma e híbrido", cat: "colchoes" },
              { emoji: "📦", nome: "Cama Box", desc: "Box + colchão conjunto", cat: "cama-box-colchao" },
              { emoji: "🛋️", nome: "Box Avulso", desc: "Só a base cama box", cat: "cama-box" },
              { emoji: "🌙", nome: "Travesseiros", desc: "Memória, látex e pluma", cat: "travesseiros" },
              { emoji: "🛡️", nome: "Protetores", desc: "Proteção e higiene", cat: "protetor" },
              { emoji: "🏠", nome: "Roupa de Cama", desc: "Jogo de lençóis e edredom", cat: "roupa-de-cama" },
            ].map((c, i) => (
              <motion.div key={c.cat} {...fade(i * 0.07)}>
                <Link href={`/catalogo?categoria=${c.cat}`} className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-red-300 hover:shadow-md transition-all group">
                  <span className="text-3xl">{c.emoji}</span>
                  <div>
                    <p className="font-extrabold text-slate-900 group-hover:text-red-600 transition-colors">{c.nome}</p>
                    <p className="text-xs text-slate-400">{c.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-400 ml-auto transition-colors" />
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

      {/* ── LOCALIZAÇÃO + CTA FINAL ──────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <motion.div {...fade()}>
              <p className="text-red-600 font-bold text-sm uppercase tracking-wider mb-3">Visite a loja</p>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Estamos em<br />Cabo Frio – RJ</h2>
              <p className="text-slate-500 mb-4 leading-relaxed">
                Venha testar na prática e sair com a certeza de ter feito o melhor investimento para a sua saúde do sono.
              </p>

              {/* Região de cobertura */}
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs font-bold text-red-700 mb-2">🚚 Entregamos em toda a Região dos Lagos</p>
                <div className="flex flex-wrap gap-1.5">
                  {REGIOES.map(c => (
                    <span key={c} className="bg-white border border-red-200 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">{c}</span>
                  ))}
                </div>
              </div>

              <a href={MAPS} target="_blank" rel="noreferrer"
                className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 hover:border-red-300 transition-all group mb-4">
                <MapPin className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-extrabold text-slate-900 group-hover:text-red-600 transition-colors">Av. Júlia Kubitschek, 64</p>
                  <p className="text-sm text-slate-500">Jardim Flamboyant · Cabo Frio – RJ · 28913-100</p>
                  <p className="text-xs text-blue-500 font-semibold mt-1">Ver no Google Maps →</p>
                </div>
              </a>
              <p className="text-xs text-slate-400">Seg–Sex: 9h às 18h &nbsp;·&nbsp; Sáb: 9h às 13h</p>
            </motion.div>

            <motion.div {...fade(0.15)} className="bg-gradient-to-br from-red-600 to-red-900 rounded-3xl p-8 text-white shadow-2xl shadow-red-900/30 text-center">
              <p className="text-red-200 text-sm font-bold uppercase tracking-wider mb-3">Fale agora mesmo</p>
              <h3 className="text-2xl font-black mb-3">Atendimento<br />personalizado</h3>
              <p className="text-red-100 text-sm leading-relaxed mb-6">
                Me chame no WhatsApp e eu respondo na hora. Se quiser, faça o Mapa do Sono antes — você já chega com seu perfil completo!
              </p>
              <a href={WHATSAPP} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-extrabold px-6 py-4 rounded-2xl transition-all shadow-lg active:scale-95 text-base mb-3">
                <MessageCircle className="w-5 h-5" />
                Falar com ThallesZzz
              </a>
              <p className="text-red-200/60 text-xs">(22) 99241-0112 · Resposta imediata</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FLOATING WHATSAPP ─────────────────────────────────────────────── */}
      <a href={WHATSAPP} target="_blank" rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl shadow-green-900/40 transition-all active:scale-95 hover:scale-105">
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm hidden sm:inline">WhatsApp</span>
      </a>

      {/* ── MODAL MAPA DO SONO ─────────────────────────────────────────────── */}
      <MapaSonoModal open={showMapa} onClose={() => setShowMapa(false)} />
    </div>
  );
}
