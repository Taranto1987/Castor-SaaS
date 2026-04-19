import { useState, useEffect } from "react";
import { LOJAS, CIDADES_ARARUAMA, type LojaKey } from "@/lib/lojas";

export type { LojaKey };

export function useLocalizacao() {
  const [lojaKey, setLojaKey] = useState<LojaKey>("cabo-frio");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/geo", { signal: controller.signal })
      .then(r => r.json())
      .then((data: { loja?: string }) => {
        if (data.loja === "araruama") setLojaKey("araruama");
        setReady(true);
      })
      .catch(() => {
        // fallback: try ipapi.co directly
        fetch("https://ipapi.co/json/", { signal: controller.signal })
          .then(r => r.json())
          .then((data: { city?: string }) => {
            const cidade = (data.city ?? "").toLowerCase();
            if (CIDADES_ARARUAMA.some(c => cidade.includes(c))) {
              setLojaKey("araruama");
            }
          })
          .catch(() => {})
          .finally(() => setReady(true));
      });

    return () => controller.abort();
  }, []);

  const loja = LOJAS[lojaKey];
  const toggle = () =>
    setLojaKey(prev => (prev === "cabo-frio" ? "araruama" : "cabo-frio"));

  return { lojaKey, loja, ready, toggle };
}

export { LOJAS };
