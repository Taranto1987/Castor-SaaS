import { useState, useEffect } from "react";
import { useLoja } from "@/contexts/LojaContext";

export type WAInfo = {
  numero: string;
  loja: string;
  contato: string;
};

// Static fallbacks — used when LojaContext hasn't resolved yet.
// Once the context resolves (from a previous page, sessionStorage, or geo-detection
// below), lojaInfo.whatsappNumero becomes the single source of truth.
const WA_CF:  WAInfo = { numero: "5522992410112", loja: "Cabo Frio", contato: "ThallesZzz" };
const WA_ARU: WAInfo = { numero: "5522988447240", loja: "Araruama",  contato: "Marcela" };
const CIDADES_ARU = ["araruama", "saquarema", "iguaba grande", "maricá", "silva jardim"];
const LOJA_WA: Record<number, WAInfo> = { 1: WA_CF, 2: WA_ARU };

export function useWAInfo(): WAInfo {
  const { lojaId, lojaInfo, detectarPorLocalizacao } = useLoja();

  // Initialise from the persisted lojaId in sessionStorage (avoids flicker on repeat visits).
  const [waInfo, setWaInfo] = useState<WAInfo>(() => LOJA_WA[lojaId] ?? WA_CF);

  // Primary source: LojaContext resolved from API (/api/loja/detect).
  // Covers: geo-detection done by MapaSono, Calculadora, or a previous visit.
  useEffect(() => {
    if (!lojaInfo) return;
    const base = LOJA_WA[lojaInfo.lojaId] ?? WA_CF;
    setWaInfo({ ...base, numero: lojaInfo.whatsappNumero ?? base.numero });
  }, [lojaInfo]);

  // Fallback: if LojaContext is still null, run geo-detection once.
  // Also populates the context so sibling components (Header, Chat, etc.) benefit.
  useEffect(() => {
    if (lojaInfo) return;
    const controller = new AbortController();
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then(r => r.json())
      .then((data: { city?: string }) => {
        const cidade = (data.city ?? "").toLowerCase();
        if (CIDADES_ARU.some(c => cidade.includes(c))) {
          setWaInfo(WA_ARU);
          detectarPorLocalizacao({ cidade: data.city }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [lojaInfo]);

  return waInfo;
}
