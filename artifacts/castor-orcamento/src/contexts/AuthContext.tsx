import { createContext, useContext, useState, ReactNode } from "react";

const SESSION_KEY = "castor_auth_user";

const USERS: Record<string, { nome: string; papel: "dono" | "entrega" }> = {
  THALLES: { nome: "Thalles", papel: "dono" },
  CASTOR2: { nome: "Administrador", papel: "dono" },
  ENTREGA: { nome: "Entregador", papel: "entrega" },
};

export type AuthUser = {
  nome: string;
  papel: "dono" | "entrega";
  codigo: string;
};

type AuthContextType = {
  user: AuthUser | null;
  login: (codigo: string) => boolean;
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

  function login(codigo: string): boolean {
    const normalizado = codigo.trim().toUpperCase();
    const found = USERS[normalizado];
    if (!found) return false;
    const authUser: AuthUser = { ...found, codigo: normalizado };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    setUser(authUser);
    return true;
  }

  function logout() {
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
