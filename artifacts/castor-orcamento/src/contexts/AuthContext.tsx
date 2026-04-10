import { createContext, useContext, useState, ReactNode } from "react";

const SESSION_KEY = "castor_auth_user";

export type Papel    = "dono" | "vendedor" | "entrega";
export type Operacao = "cabo_frio" | "araruama";
export type Tom      = "especialista" | "acolhedor" | "direto" | "proximo" | "tecnico";

export interface ColaboradorConfig {
  nome:       string;
  papel:      Papel;
  operacao:   Operacao;
  wa:         string;        // número formatado para exibição (22) XXXXX-XXXX
  waRaw:      string;        // só dígitos para URL do WA
  lojaLink:   string;        // Google Business (avaliações)
  mapsLink:   string;        // Google Maps (navegação)
  endereco:   string;        // endereço de exibição
  tom:        Tom;
  header:     string;        // cabeçalho do orçamento
  assinatura: string;        // linha de assinatura final
}

// ─── COLABORADORES ────────────────────────────────────────────────────────────
const CABO_FRIO_LINK      = "https://share.google/bDIGyrtnaNFOMfWEd";
const ARARUAMA_LINK       = "https://share.google/o7duCdh84jQYnPn7z";
const CABO_FRIO_MAPS      = "https://maps.app.goo.gl/UuF6w1nAvTgXockS6";
const ARARUAMA_MAPS       = "https://maps.app.goo.gl/cGmvFgeubawLRNGy8";
const CABO_FRIO_ENDERECO  = "Av. Júlia Kubitschek, 64 · Jardim Flamboyant · Cabo Frio – RJ";
const ARARUAMA_ENDERECO   = "Av. Getúlio Vargas, 137 · Centro · Araruama – RJ";

export const COLABORADORES: Record<string, ColaboradorConfig> = {
  THALLES: {
    nome:       "Thalles",
    papel:      "dono",
    operacao:   "cabo_frio",
    wa:         "(22) 99241-0112",
    waRaw:      "5522992410112",
    lojaLink:   CABO_FRIO_LINK,
    mapsLink:   CABO_FRIO_MAPS,
    endereco:   CABO_FRIO_ENDERECO,
    tom:        "especialista",
    header:     "🛏️ CASTOR CABO FRIO | ThallesZzz",
    assinatura: "ThallesZzz — Especialista em Sono",
  },
  MARCELA: {
    nome:       "Marcela Taranto",
    papel:      "vendedor",
    operacao:   "cabo_frio",
    wa:         "(22) 98844-7240",
    waRaw:      "5522988447240",
    lojaLink:   CABO_FRIO_LINK,
    mapsLink:   CABO_FRIO_MAPS,
    endereco:   CABO_FRIO_ENDERECO,
    tom:        "acolhedor",
    header:     "🏪 CASTOR CABO FRIO | Marcela",
    assinatura: "Marcela Taranto — Castor Cabo Frio",
  },
  VAGNER: {
    nome:       "Vagner",
    papel:      "vendedor",
    operacao:   "cabo_frio",
    wa:         "(22) 98832-7816",
    waRaw:      "5522988327816",
    lojaLink:   CABO_FRIO_LINK,
    mapsLink:   CABO_FRIO_MAPS,
    endereco:   CABO_FRIO_ENDERECO,
    tom:        "direto",
    header:     "🏪 CASTOR CABO FRIO | Vagner",
    assinatura: "Vagner — Castor Cabo Frio",
  },
  NETE: {
    nome:       "Nete Rafaele",
    papel:      "vendedor",
    operacao:   "araruama",
    wa:         "(22) 98824-9183",
    waRaw:      "5522988249183",
    lojaLink:   ARARUAMA_LINK,
    mapsLink:   ARARUAMA_MAPS,
    endereco:   ARARUAMA_ENDERECO,
    tom:        "proximo",
    header:     "💙 CASTOR ARARUAMA | Nete",
    assinatura: "Nete Rafaele — Castor Araruama",
  },
  PEDROPAULO: {
    nome:       "Pedro Paulo",
    papel:      "vendedor",
    operacao:   "araruama",
    wa:         "(22) 2665-6035",
    waRaw:      "5522266560035",
    lojaLink:   ARARUAMA_LINK,
    mapsLink:   ARARUAMA_MAPS,
    endereco:   ARARUAMA_ENDERECO,
    tom:        "tecnico",
    header:     "🏪 CASTOR ARARUAMA | Pedro Paulo",
    assinatura: "Pedro Paulo — Castor Araruama",
  },
  // ── legado / acesso especial ────────────────────────────────────────────────
  CASTOR2: {
    nome:       "Administrador",
    papel:      "dono",
    operacao:   "cabo_frio",
    wa:         "(22) 99241-0112",
    waRaw:      "5522992410112",
    lojaLink:   CABO_FRIO_LINK,
    mapsLink:   CABO_FRIO_MAPS,
    endereco:   CABO_FRIO_ENDERECO,
    tom:        "especialista",
    header:     "🏪 CASTOR CABO FRIO",
    assinatura: "Castor Cabo Frio",
  },
  ENTREGA: {
    nome:       "Pedro",
    papel:      "entrega",
    operacao:   "cabo_frio",
    wa:         "(22) 99241-0112",
    waRaw:      "5522992410112",
    lojaLink:   CABO_FRIO_LINK,
    mapsLink:   CABO_FRIO_MAPS,
    endereco:   CABO_FRIO_ENDERECO,
    tom:        "direto",
    header:     "🏪 CASTOR CABO FRIO",
    assinatura: "Castor Cabo Frio",
  },
};

// ─── TYPE ─────────────────────────────────────────────────────────────────────

export type AuthUser = ColaboradorConfig & { codigo: string; sessionToken?: string };

type AuthContextType = {
  user: AuthUser | null;
  login: (codigo: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  async function login(codigo: string): Promise<boolean> {
    const normalizado = codigo.trim().toUpperCase();
    const found = COLABORADORES[normalizado];
    if (!found) return false;

    let sessionToken: string | undefined;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizado }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionToken = data.token;
      }
    } catch {}

    if (!sessionToken) {
      return false;
    }

    const authUser: AuthUser = { ...found, codigo: normalizado, sessionToken };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    setUser(authUser);
    return true;
  }

  function logout() {
    if (user?.sessionToken) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-session-token": user.sessionToken },
      }).catch(() => {});
    }
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: user !== null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
