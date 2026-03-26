import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { MessageCircle, Menu, X, Moon, Search, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const WHATSAPP = "https://wa.me/5522992410112?text=Olá! Vi o site da Castor Cabo Frio e quero saber mais sobre os colchões!";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
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
                  href={WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileOpen(false)}
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
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white pt-12 pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src="/logo-exclusiva.png" alt="Castor" className="h-10 w-auto mb-3" />
              <p className="text-slate-400 text-sm leading-relaxed">
                Especialistas em engenharia do sono em Cabo Frio. Não vendemos colchão — resolvemos o seu sono.
              </p>
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wider text-slate-300 mb-3">Navegação</p>
              <div className="space-y-2">
                {[
                  { href: "/catalogo", label: "Catálogo de Produtos" },
                  { href: "/mapa-sono", label: "Mapa do Sono — ThallesZzz" },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
                    <ChevronRight className="w-3 h-3 text-red-500" /> {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wider text-slate-300 mb-3">Contato</p>
              <div className="space-y-2 text-sm text-slate-400">
                <p>📍 Av. Júlia Kubitschek, 64</p>
                <p>Jardim Flamboyant · Cabo Frio – RJ</p>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-green-400 hover:text-green-300 font-semibold"
                >
                  <MessageCircle className="w-4 h-4" /> (22) 99241-0112
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-slate-500 text-xs">© 2025 Castor Cabo Frio · Todos os direitos reservados</p>
            <Link href="/equipe" className="text-slate-700 text-xs hover:text-slate-500 transition-colors">
              Área da Equipe
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
