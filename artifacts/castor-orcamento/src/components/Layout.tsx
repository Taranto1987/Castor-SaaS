import { type ComponentType, ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  FileText, Search, Clock, BarChart2, Truck,
  LogOut, User, Users, ShoppingCart, Package, DollarSign,
  TrendingUp, ClipboardPlus, UserCog, Menu, X, ChevronRight,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  donoOnly?: boolean;
  items: NavItem[];
}

function useSections(isDono: boolean): NavSection[] {
  return [
    {
      label: "Vendas",
      items: [
        { path: "/equipe",          label: "Catálogo",   icon: Search       },
        { path: "/orcamento",       label: "Orçamento",  icon: FileText     },
        { path: "/historico",       label: "Histórico",  icon: Clock        },
        { path: "/equipe/clientes", label: "Clientes",   icon: Users        },
        { path: "/outlet",          label: "Outlet",     icon: ShoppingCart },
      ],
    },
    {
      label: "Operações",
      items: [
        { path: "/logistica",  label: "Logística",  icon: Truck     },
        { path: "/dashboard",  label: "Dashboard",  icon: BarChart2 },
      ],
    },
    ...(isDono
      ? [
          {
            label: "Gestão",
            donoOnly: true,
            items: [
              { path: "/estoque",         label: "Estoque",          icon: Package      },
              { path: "/entrada-estoque", label: "Entrada",          icon: ClipboardPlus },
              { path: "/financeiro",      label: "Financeiro",       icon: DollarSign   },
              { path: "/ranking-outlet",  label: "Ranking Outlet",   icon: TrendingUp   },
              { path: "/usuarios",        label: "Usuários",         icon: UserCog      },
            ],
          },
          {
            label: "Sistema",
            donoOnly: true,
            items: [
              { path: "/crawler", label: "Atualizador de Preços", icon: RefreshCw },
            ],
          },
        ]
      : []),
  ];
}

const PINNED_PATHS = ["/equipe", "/orcamento", "/dashboard", "/logistica"];

// ── Sidebar nav item ──────────────────────────────────────────────────────────

function SidebarItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.path}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-red-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 leading-none">{item.label}</span>
    </Link>
  );
}

// ── Sidebar (desktop) ─────────────────────────────────────────────────────────

function Sidebar({
  sections,
  location,
}: {
  sections: NavSection[];
  location: string;
}) {
  const { user, logout } = useAuth();
  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 overflow-y-auto z-40">
      <div className="px-4 py-4 border-b border-slate-100">
        <Link href="/" className="flex items-center cursor-pointer">
          <img src="/logo-castor.webp" alt="Castor" className="h-11 w-auto" />
        </Link>
      </div>

      {user && (
        <div className="px-4 py-3 border-b border-slate-100">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-bold",
              user.operacao === "araruama"
                ? "bg-blue-50 border-blue-100 text-blue-700"
                : "bg-red-50 border-red-100 text-red-700"
            )}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{user.nome.split(" ")[0]}</span>
            <span className="ml-auto capitalize text-[10px] font-medium opacity-70">
              {user.papel}
            </span>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  isActive={location === item.path}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </aside>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────

function DrawerItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={item.path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all",
        isActive
          ? "bg-red-600 text-white font-bold shadow-sm"
          : "text-slate-700 hover:bg-slate-50 font-medium"
      )}
    >
      <item.icon className="w-5 h-5 shrink-0" />
      <span className="flex-1 text-sm">{item.label}</span>
      {!isActive && <ChevronRight className="w-4 h-4 text-slate-300" />}
    </Link>
  );
}

function MobileDrawer({
  open,
  onClose,
  sections,
  location,
}: {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
  location: string;
}) {
  const { user, logout } = useAuth();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="md:hidden fixed inset-0 bg-black/40 z-[60]"
            onClick={onClose}
          />
          <motion.div
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              {user && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-1.5 border text-sm font-bold",
                    user.operacao === "araruama"
                      ? "bg-blue-50 border-blue-100 text-blue-700"
                      : "bg-red-50 border-red-100 text-red-700"
                  )}
                >
                  <User className="w-4 h-4" />
                  {user.nome.split(" ")[0]}
                  <span className="text-[10px] font-medium opacity-60 capitalize ml-1">
                    {user.papel}
                  </span>
                </div>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="px-4 mb-1 text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <DrawerItem
                        key={item.path}
                        item={item}
                        isActive={location === item.path}
                        onClick={onClose}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 pb-8 pt-2 border-t border-slate-100">
              <button
                onClick={() => { logout(); onClose(); }}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50 font-semibold transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm">Sair da conta</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

interface LayoutProps { children: ReactNode; }

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDono = user?.papel === "dono";
  const sections = useSections(isDono);

  const allItems = sections.flatMap((s) => s.items);
  const pinnedItems = PINNED_PATHS.map((p) => allItems.find((i) => i.path === p)!).filter(Boolean);

  return (
    <div className="min-h-screen flex relative">
      <Sidebar sections={sections} location={location} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-50 bg-white border-b border-slate-200/80">
          <div className="flex items-center justify-between px-4 h-14">
            <Link href="/" className="flex items-center">
              <img src="/logo-castor.webp" alt="Castor" className="h-9 w-auto" />
            </Link>
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile bottom bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe">
          <nav className="flex items-stretch h-16">
            {pinnedItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 relative",
                    isActive ? "text-red-600" : "text-slate-400"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabMobile"
                      className="absolute top-0 w-8 h-0.5 bg-red-600 rounded-b-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-700"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Menu</span>
            </button>
          </nav>
        </div>
      </div>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={sections}
        location={location}
      />
    </div>
  );
}
