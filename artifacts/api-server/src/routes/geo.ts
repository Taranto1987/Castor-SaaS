import { Router, type Request, type Response } from "express";

const CIDADES_ARARUAMA = ["araruama", "saquarema", "iguaba grande", "maricá", "rio bonito", "silva jardim"];

const router = Router();

router.get("/geo", async (req: Request, res: Response) => {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
    const ip = (rawIp ?? req.socket.remoteAddress ?? "").trim();

    if (!ip || ip === "127.0.0.1" || ip === "::1") {
      res.json({ loja: "cabo-frio" });
      return;
    }

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "Castor-SaaS/1.0" },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      res.json({ loja: "cabo-frio" });
      return;
    }

    const data = await response.json() as { city?: string; error?: boolean };

    if (data.error) {
      res.json({ loja: "cabo-frio" });
      return;
    }

    const cidade = (data.city ?? "").toLowerCase();
    const loja = CIDADES_ARARUAMA.some(c => cidade.includes(c)) ? "araruama" : "cabo-frio";

    res.json({ loja });
  } catch {
    res.json({ loja: "cabo-frio" });
  }
});

export default router;
