import { type ComponentType, ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  FileText, Search, Clock, BarChart2, Truck,
  LogOut, User, Users, ShoppingCart, Package, DollarSign,
  TrendingUp, ClipboardPlus, UserCog, Menu, X, ChevronRight,
  RefreshCw, MessageSquare, Sun, Moon, ChevronLeft, Command,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCommandPalette } from "@/components/CommandPalette";

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
      label: "Atendimento",
      items: [
        { path: "/inbox", label: "Inbox WhatsApp", icon: MessageSquare },
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

const PINNED_PATHS = ["/equipe", "/orcamento", "/inbox", "/dashboard"];

// ── Sidebar nav item ──────────────────────────────────────────────────────────

function SidebarItem({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.path}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
        isActive
          ? "bg-red-600 text-white shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="flex-1 leading-none">{item.label}</span>}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          {item.label}
        </div>
      )}
    </Link>
  );
}

// ── Sidebar (desktop) ─────────────────────────────────────────────────────────

function Sidebar({
  sections,
  location,
  collapsed,
  onToggleCollapse,
}: {
  sections: NavSection[];
  location: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setOpen: openPalette } = useCommandPalette();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 overflow-y-auto z-40 transition-all duration-200",
        collapsed ? "w-[60px]" : "w-56 lg:w-64"
      )}
    >
      {/* Logo + collapse toggle */}
      <div className={cn("flex items-center border-b border-slate-100 dark:border-slate-800", collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-4")}>
        {!collapsed && (
          <Link href="/" className="flex items-center cursor-pointer">
            <img src="/logo-castor.webp" alt="Castor" className="h-11 w-auto" />
          </Link>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* User badge */}
      {user && !collapsed && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-bold",
              user.operacao === "araruama"
                ? "bg-blue-50 dark:bg-blue-950 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300"
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

      {/* Command palette trigger */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => openPalette(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors bg-slate-50 dark:bg-slate-800"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left text-xs">Buscar...</span>
            <kbd className="text-[10px] border border-slate-200 dark:border-slate-700 rounded px-1">⌘K</kbd>
          </button>
        </div>
      )}

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-extrabold tracking-widest text-slate-400 dark:text-slate-600 uppercase">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  isActive={location === item.path || (item.path !== "/equipe" && location.startsWith(item.path))}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("px-2 py-3 border-t border-slate-100 dark:border-slate-800 space-y-1", collapsed && "flex flex-col items-center")}>
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all",
            collapsed && "justify-center"
          )}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-all",
            collapsed && "justify-center"
          )}
          title="Sair da conta"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && "Sair da conta"}
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
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
      )}
    >
      <item.icon className="w-5 h-5 shrink-0" />
      <span className="flex-1 text-sm">{item.label}</span>
      {!isActive && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
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
  const { theme, toggleTheme } = useTheme();
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
            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              {user && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-1.5 border text-sm font-bold",
                    user.operacao === "araruama"
                      ? "bg-blue-50 dark:bg-blue-950 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                      : "bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300"
                  )}
                >
                  <User className="w-4 h-4" />
                  {user.nome.split(" ")[0]}
                  <span className="text-[10px] font-medium opacity-60 capitalize ml-1">
                    {user.papel}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="px-4 mb-1 text-[10px] font-extrabold tracking-widest text-slate-400 dark:text-slate-600 uppercase">
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

            <div className="px-4 pb-8 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { logout(); onClose(); }}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 font-semibold transition-all"
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("castor-sidebar-collapsed") === "true";
    }
    return false;
  });

  const isDono = user?.papel === "dono" || user?.papel === "ADMIN" || user?.papel === "GERENTE";
  const sections = useSections(isDono);

  const allItems = sections.flatMap((s) => s.items);
  const pinnedItems = PINNED_PATHS.map((p) => allItems.find((i) => i.path === p)!).filter(Boolean);

  const handleToggleCollapse = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("castor-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen flex relative bg-background">
      <Sidebar
        sections={sections}
        location={location}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between px-4 h-14">
            <Link href="/" className="flex items-center">
              <img src="/logo-castor.webp" alt="Castor" className="h-9 w-auto" />
            </Link>
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile bottom bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 pb-safe">
          <nav className="flex items-stretch h-16">
            {pinnedItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 relative",
                    isActive ? "text-red-600" : "text-slate-400 dark:text-slate-500"
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
              className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
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
