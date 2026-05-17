import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  FileText, Settings, Search, Clock, BarChart2, Truck,
  LogOut, User, Users, ShoppingCart, Package, DollarSign,
  TrendingUp, ClipboardPlus, UserCog, Menu, X, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutProps { children: ReactNode; }

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isDono = user?.papel === "dono";

  const allNavItems = [
    { path: "/equipe",           label: "Catálogo",     icon: Search       },
    { path: "/orcamento",        label: "Orçamento",    icon: FileText     },
    { path: "/historico",        label: "Histórico",    icon: Clock        },
    { path: "/logistica",        label: "Logística",    icon: Truck        },
    { path: "/dashboard",        label: "Dashboard",    icon: BarChart2    },
    ...(isDono ? [{ path: "/financeiro",    label: "Financeiro",   icon: DollarSign   }] : []),
    { path: "/equipe/clientes",  label: "Clientes",     icon: Users        },
    { path: "/outlet",           label: "Outlet",       icon: ShoppingCart },
    ...(isDono ? [
      { path: "/estoque",         label: "Estoque",      icon: Package      },
      { path: "/ranking-outlet",  label: "Ranking",      icon: TrendingUp   },
      { path: "/entrada-estoque", label: "Entrada",      icon: ClipboardPlus },
      { path: "/usuarios",        label: "Usuários",     icon: UserCog      },
    ] : []),
    { path: "/crawler",          label: "Atualizar BD", icon: Settings     },
  ];

  // Bottom bar: 4 pinned items + menu button
  const pinnedPaths = ["/equipe", "/orcamento", "/dashboard", "/logistica"];
  const pinnedItems = allNavItems.filter(i => pinnedPaths.includes(i.path));

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* ── Top header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center cursor-pointer group">
              <img
                src="/logo-castor.webp"
                alt="Castor Cabo Frio"
                className="h-12 w-auto group-hover:scale-105 transition-transform duration-300"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {allNavItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                      isActive
                        ? "text-primary"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                );
              })}

              {user && (
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 border",
                    user.operacao === "araruama"
                      ? "bg-blue-50 border-blue-100 text-blue-700"
                      : "bg-red-50 border-red-100 text-red-700"
                  )}>
                    <User className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{user.nome.split(" ")[0]}</span>
                  </div>
                  <button
                    onClick={logout}
                    title="Sair"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </nav>

            {/* Mobile: hamburger no header */}
            <button
              className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 pb-24 md:pb-8">
        {children}
      </main>

      {/* ── Mobile bottom bar — 4 itens + botão menu ─────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe">
        <nav className="flex items-center h-16">
          {pinnedItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center h-full gap-1 relative",
                  isActive ? "text-primary" : "text-slate-400"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabMobile"
                    className="absolute top-0 w-8 h-0.5 bg-primary rounded-b-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}

          {/* Menu button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center h-full gap-1 text-slate-400 hover:text-slate-700"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Menu</span>
          </button>
        </nav>
      </div>

      {/* ── Drawer overlay ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer — slide up from bottom */}
            <motion.div
              key="drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
            >
              {/* Handle + header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {user && (
                    <div className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 border text-sm font-bold",
                      user.operacao === "araruama"
                        ? "bg-blue-50 border-blue-100 text-blue-700"
                        : "bg-red-50 border-red-100 text-red-700"
                    )}>
                      <User className="w-4 h-4" />
                      {user.nome.split(" ")[0]}
                    </div>
                  )}
                  <span className="text-xs text-slate-400 font-medium capitalize">
                    {user?.operacao?.replace("_", " ")}
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav items */}
              <div className="overflow-y-auto flex-1 px-4 py-3">
                <div className="grid grid-cols-1 gap-1">
                  {allNavItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all",
                          isActive
                            ? "bg-primary text-white font-bold"
                            : "text-slate-700 hover:bg-slate-50 font-medium"
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="flex-1 text-sm">{item.label}</span>
                        {!isActive && <ChevronRight className="w-4 h-4 text-slate-300" />}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Logout */}
              <div className="px-4 pb-6 pt-2 border-t border-slate-100">
                <button
                  onClick={() => { logout(); setDrawerOpen(false); }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-red-600 hover:bg-red-50 font-semibold transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">Sair da conta</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
