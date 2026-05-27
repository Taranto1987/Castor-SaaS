import { createContext, useContext, useState, ReactNode } from "react";

const SESSION_KEY = "castor_auth_user";

export type Papel    = "dono" | "vendedor" | "entrega" | "financeiro" | "ADMIN" | "GERENTE" | "VENDEDOR" | "FINANCEIRO" | "ENTREGA";
export type Operacao = "cabo_frio" | "araruama";
export type Tom      = "especialista" | "acolhedor" | "direto" | "proximo" | "tecnico";

export interface ColaboradorConfig {
  nome:       string;
  papel:      Papel;
  operacao:   Operacao;
  wa:         string;
  waRaw:      string;
  lojaLink:   string;
  mapsLink:   string;
  endereco:   string;
  tom:        Tom;
  header:     string;
  assinatura: string;
}

// ─── Constantes de localização (derivadas de operacao, não vêm do BD) ─────────
const CABO_FRIO_LINK     = "https://share.google/bDIGyrtnaNFOMfWEd";
const ARARUAMA_LINK      = "https://share.google/o7duCdh84jQYnPn7z";
const CABO_FRIO_MAPS     = "https://maps.app.goo.gl/UuF6w1nAvTgXockS6";
const ARARUAMA_MAPS      = "https://maps.app.goo.gl/cGmvFgeubawLRNGy8";
const CABO_FRIO_ENDERECO = "Av. Júlia Kubitschek, 64 · Jardim Flamboyant · Cabo Frio – RJ";
const ARARUAMA_ENDERECO  = "Av. Getúlio Vargas, 137 · Centro · Araruama – RJ";

function operacaoToLocation(operacao: string) {
  if (operacao === "araruama") {
    return { lojaLink: ARARUAMA_LINK, mapsLink: ARARUAMA_MAPS, endereco: ARARUAMA_ENDERECO };
  }
  return { lojaLink: CABO_FRIO_LINK, mapsLink: CABO_FRIO_MAPS, endereco: CABO_FRIO_ENDERECO };
}

// ─── TYPE ─────────────────────────────────────────────────────────────────────

export interface FeatureFlags {
  crm: boolean;
  inbox: boolean;
  aiMemory: boolean;
  hotLeadAlerts: boolean;
  multiAttendant: boolean;
}

export type AuthUser = ColaboradorConfig & {
  codigo: string;
  email?: string;
  sessionToken?: string;
  features?: FeatureFlags;
};

type LoginParams = { email: string; senha: string } | { code: string };

type AuthContextType = {
  user: AuthUser | null;
  login: (params: LoginParams | string) => Promise<boolean>;
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

  async function login(params: LoginParams | string): Promise<boolean> {
    try {
      // Normaliza: aceita string legada (código) ou objeto { email, senha } / { code }
      let body: Record<string, string>;
      if (typeof params === "string") {
        body = { code: params.trim().toUpperCase() };
      } else if ("email" in params) {
        body = { email: params.email.trim(), senha: params.senha };
      } else {
        body = { code: params.code.trim().toUpperCase() };
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) return false;

      const data = await res.json();

      const location = operacaoToLocation(data.operacao ?? "cabo_frio");

      const authUser: AuthUser = {
        codigo:       "code" in body ? body.code : (data.email ?? ""),
        email:        data.email ?? undefined,
        sessionToken: data.token,
        nome:         data.nome,
        papel:        (data.papel ?? data.cargo) as Papel,
        operacao:     (data.operacao ?? "cabo_frio") as Operacao,
        wa:           data.wa ?? "",
        waRaw:        data.waRaw ?? "",
        tom:          (data.tom ?? "direto") as Tom,
        header:       data.header ?? "",
        assinatura:   data.assinatura ?? "",
        ...location,
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
      setUser(authUser);
      return true;
    } catch {
      return false;
    }
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
