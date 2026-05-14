import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "castor_loja_id";

type Confianca = "alta" | "baixa";

type LojaInfo = {
  lojaId: number;
  operacao: string;
  confianca: Confianca;
  contato: string | null;
  whatsappNumero: string | null;
  whatsappDisplay: string | null;
  cidade: string | null;
};

type LojaContextType = {
  lojaId: number;
  lojaInfo: LojaInfo | null;
  detectarPorLocalizacao: (params: { cidade?: string; cep?: string; ddd?: string; operacao?: string }) => Promise<void>;
  selecionarLoja: (id: number) => void;
};

const DEFAULT_LOJA_ID = 1;

const LojaContext = createContext<LojaContextType>({
  lojaId: DEFAULT_LOJA_ID,
  lojaInfo: null,
  detectarPorLocalizacao: async () => {},
  selecionarLoja: () => {},
});

function persistLojaId(id: number) {
  try { sessionStorage.setItem(STORAGE_KEY, String(id)); } catch {}
}

function loadStoredLojaId(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const id = parseInt(raw, 10);
      if (!isNaN(id) && id > 0) return id;
    }
  } catch {}
  return DEFAULT_LOJA_ID;
}

export function LojaProvider({ children }: { children: ReactNode }) {
  const [lojaId, setLojaId] = useState<number>(loadStoredLojaId);
  const [lojaInfo, setLojaInfo] = useState<LojaInfo | null>(null);

  useEffect(() => {
    persistLojaId(lojaId);
  }, [lojaId]);

  // Synchronous — updates lojaId and sessionStorage immediately.
  // Use this for explicit user selections (loja switcher).
  // The async detectarPorLocalizacao is called separately in background to populate lojaInfo.
  function selecionarLoja(id: number) {
    setLojaId(id);
    persistLojaId(id);
  }

  async function detectarPorLocalizacao(params: { cidade?: string; cep?: string; ddd?: string; operacao?: string }) {
    try {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== null && v !== undefined) as [string, string][]
      ).toString();
      const res = await fetch(`/api/loja/detect${qs ? `?${qs}` : ""}`);
      if (!res.ok) return;
      const data: LojaInfo = await res.json();
      setLojaId(data.lojaId);
      setLojaInfo(data);
    } catch {}
  }

  return (
    <LojaContext.Provider value={{ lojaId, lojaInfo, detectarPorLocalizacao, selecionarLoja }}>
      {children}
    </LojaContext.Provider>
  );
}

export function useLoja() {
  return useContext(LojaContext);
}
