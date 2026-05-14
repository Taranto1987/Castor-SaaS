import { useState, useEffect } from "react";
import { useLoja } from "@/contexts/LojaContext";

export type WAInfo = {
  numero: string;
  loja: string;
  contato: string;
  tel: string;
};

// Fallbacks used only when LojaContext hasn't resolved yet (first render / no prior session).
// All fields are overridden by API data the moment lojaInfo becomes available.
const FALLBACK_CF:  WAInfo = { numero: "5522992410112", loja: "Cabo Frio", contato: "ThallesZzz", tel: "(22) 99241-0112" };
const FALLBACK_ARU: WAInfo = { numero: "5522988447240", loja: "Araruama",  contato: "Marcela",    tel: "(22) 98844-7240" };
const FALLBACK_BY_LOJA: Record<number, WAInfo> = { 1: FALLBACK_CF, 2: FALLBACK_ARU };
const CIDADES_ARU = ["araruama", "saquarema", "iguaba grande", "maricá", "silva jardim"];

export function useWAInfo(): WAInfo {
  const { lojaId, lojaInfo, detectarPorLocalizacao } = useLoja();

  // Initialise from persisted lojaId (avoids flicker on repeat visits that set the session).
  const [waInfo, setWaInfo] = useState<WAInfo>(() => FALLBACK_BY_LOJA[lojaId] ?? FALLBACK_CF);

  // Primary source: LojaContext resolved from /api/loja/detect.
  // ALL fields come from the backend — no hardcoded names.
  useEffect(() => {
    if (!lojaInfo) return;
    const fallback = FALLBACK_BY_LOJA[lojaInfo.lojaId] ?? FALLBACK_CF;
    setWaInfo({
      numero:  lojaInfo.whatsappNumero   ?? fallback.numero,
      loja:    lojaInfo.cidade           ?? fallback.loja,
      contato: lojaInfo.contato          ?? fallback.contato,
      tel:     lojaInfo.whatsappDisplay  ?? fallback.tel,
    });
  }, [lojaInfo]);

  // Fallback: geo-detect via ipapi.co when LojaContext is still null.
  // Also populates the context so sibling components benefit immediately.
  useEffect(() => {
    if (lojaInfo) return;
    const controller = new AbortController();
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then(r => r.json())
      .then((data: { city?: string }) => {
        const cidade = (data.city ?? "").toLowerCase();
        if (CIDADES_ARU.some(c => cidade.includes(c))) {
          setWaInfo(FALLBACK_ARU);
          detectarPorLocalizacao({ cidade: data.city }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [lojaInfo]);

  return waInfo;
}
