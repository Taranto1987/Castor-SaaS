import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Search, FileText, Clock, BarChart2, Truck, Users,
  ShoppingCart, Package, DollarSign, MessageSquare, UserCog, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
});

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPaletteDialog open={open} setOpen={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

const NAV_ITEMS = [
  { label: "Catálogo",          path: "/equipe",          icon: Search,        group: "Vendas"  },
  { label: "Novo Orçamento",    path: "/orcamento",       icon: FileText,      group: "Vendas"  },
  { label: "Histórico",         path: "/historico",       icon: Clock,         group: "Vendas"  },
  { label: "Clientes / CRM",    path: "/equipe/clientes", icon: Users,         group: "Vendas"  },
  { label: "Outlet",            path: "/outlet",          icon: ShoppingCart,  group: "Vendas"  },
  { label: "Inbox WhatsApp",    path: "/inbox",           icon: MessageSquare, group: "Atendimento" },
  { label: "Logística",         path: "/logistica",       icon: Truck,         group: "Operações" },
  { label: "Dashboard",         path: "/dashboard",       icon: BarChart2,     group: "Operações" },
  { label: "Estoque",           path: "/estoque",         icon: Package,       group: "Gestão", donoOnly: true },
  { label: "Financeiro",        path: "/financeiro",      icon: DollarSign,    group: "Gestão" },
  { label: "Usuários",          path: "/usuarios",        icon: UserCog,       group: "Gestão", donoOnly: true },
  { label: "Atualizador Preços",path: "/crawler",         icon: RefreshCw,     group: "Sistema", donoOnly: true },
];

function CommandPaletteDialog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isDono = user?.papel === "dono" || user?.papel === "ADMIN";

  const items = NAV_ITEMS.filter((i) => !i.donoOnly || isDono);
  const groups = Array.from(new Set(items.map((i) => i.group)));

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Navegar para... (⌘K)" />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {items
              .filter((i) => i.group === group)
              .map((item) => (
                <CommandItem key={item.path} onSelect={() => go(item.path)}>
                  <item.icon className="mr-2 h-4 w-4 text-slate-500" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
      </CommandList>
    </CommandDialog>
  );
}
