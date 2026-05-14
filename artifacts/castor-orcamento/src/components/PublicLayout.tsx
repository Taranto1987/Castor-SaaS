import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { MessageCircle, Menu, X, Moon, Search, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trackWhatsAppClick } from "@/lib/tracking";
import ChatBot from "./ChatBot";
import { useWAInfo } from "@/hooks/use-wa-info";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const waInfo = useWAInfo();
  const whatsapp = `https://wa.me/${waInfo.numero}?text=${encodeURIComponent(`Olá! Vi o site da Castor e quero saber mais sobre os colchões!`)}`;

  const navLinks = [
    { path: "/catalogo", label: "Catálogo", icon: Search },
    { path: "/mapa-sono", label: "Mapa do Sono", icon: Moon },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src="/logo-castor.png"
                alt="Castor Cabo Frio"
                className="h-11 w-auto group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  href={path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    location === path
                      ? "text-red-600 bg-red-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>

            {/* WhatsApp CTA */}
            <div className="hidden md:flex items-center gap-3">
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackWhatsAppClick("header_nav", waInfo.loja)}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-green-500/30 active:scale-95 text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Falar no WhatsApp
              </a>
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-100 bg-white overflow-hidden"
            >
              <div className="px-4 py-3 space-y-1">
                {navLinks.map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    href={path}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
                  >
                    <Icon className="w-4 h-4 text-red-500" />
                    {label}
                  </Link>
                ))}
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => { setMobileOpen(false); trackWhatsAppClick("header_mobile", waInfo.loja); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 text-green-700 font-bold"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar no WhatsApp
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white pt-12 pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src="/logo-exclusiva.png" alt="Castor" className="h-10 w-auto mb-3" />
              <p className="text-slate-400 text-sm leading-relaxed">
                Especialistas em engenharia do sono na Região dos Lagos. Não vendemos colchão — resolvemos o seu sono.
              </p>
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wider text-slate-300 mb-3">Navegação</p>
              <div className="space-y-2">
                {[
                  { href: "/catalogo", label: "Catálogo de Produtos" },
                  { href: "/mapa-sono", label: "Mapa do Sono" },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
                    <ChevronRight className="w-3 h-3 text-red-500" /> {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wider text-slate-300 mb-3">Nossas Lojas</p>
              <div className="space-y-3 text-sm text-slate-400">
                <a href="https://maps.app.goo.gl/UuF6w1nAvTgXockS6" target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-slate-200 transition-colors group">
                  <span className="mt-0.5 shrink-0">📍</span>
                  <span>
                    <span className="font-semibold text-slate-300 group-hover:text-white block">Cabo Frio</span>
                    Av. Júlia Kubitschek, 64 · Jardim Flamboyant
                  </span>
                </a>
                <a href="https://maps.app.goo.gl/cGmvFgeubawLRNGy8" target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-slate-200 transition-colors group">
                  <span className="mt-0.5 shrink-0">📍</span>
                  <span>
                    <span className="font-semibold text-slate-300 group-hover:text-white block">Araruama</span>
                    Av. Getúlio Vargas, 137 · Centro
                  </span>
                </a>
                <div className="space-y-1.5 pt-1">
                  <a
                    href="https://wa.me/5522992410112?text=Olá! Vi o site da Castor Cabo Frio e quero saber mais sobre os colchões!"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackWhatsAppClick("footer", "Cabo Frio")}
                    className="flex items-center gap-2 text-green-400 hover:text-green-300 font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" /> (22) 99241-0112 · Cabo Frio
                  </a>
                  <a
                    href="https://wa.me/5522988447240?text=Olá! Vi o site da Castor Araruama e quero saber mais sobre os colchões!"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackWhatsAppClick("footer", "Araruama")}
                    className="flex items-center gap-2 text-green-400 hover:text-green-300 font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" /> (22) 98844-7240 · Araruama
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-slate-500 text-xs">© {new Date().getFullYear()} Castor Cabo Frio & Araruama · Todos os direitos reservados</p>
            <Link href="/equipe" className="text-slate-700 text-xs hover:text-slate-500 transition-colors">
              Área da Equipe
            </Link>
          </div>
        </div>
      </footer>

      <ChatBot />
    </div>
  );
}
