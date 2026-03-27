import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { FileText, Settings, Search, Clock, BarChart2, Truck, Moon, LogOut, User, Users, ShoppingCart, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/equipe",          label: "Catálogo",   icon: Search },
    { path: "/orcamento",       label: "Orçamento",  icon: FileText },
    { path: "/historico",       label: "Histórico",  icon: Clock },
    { path: "/logistica",       label: "Logística",  icon: Truck },
    { path: "/dashboard",       label: "Dashboard",  icon: BarChart2 },
    { path: "/equipe/clientes", label: "Clientes",   icon: Users },
    { path: "/outlet",          label: "Outlet",     icon: ShoppingCart },
    { path: "/estoque",         label: "Estoque",    icon: Package },
    { path: "/crawler",         label: "Atualizar",  icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo area */}
            <Link href="/" className="flex items-center cursor-pointer group">
              <img
                src="/logo-castor.png"
                alt="Castor Cabo Frio"
                className="h-12 w-auto group-hover:scale-105 transition-transform duration-300"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
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

              {/* User badge + logout */}
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
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-200/50 z-50 pb-safe">
        <nav className="flex justify-around items-center h-16 px-1">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 relative",
                  isActive ? "text-primary" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabMobile"
                    className="absolute top-0 w-8 h-1 bg-primary rounded-b-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          {/* Logout mobile */}
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-400 hover:text-red-500"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
