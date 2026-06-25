import { Router } from "express";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { isNotNull } from "drizzle-orm";

const router = Router();

const STATIC_ROUTES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/",                changefreq: "daily",   priority: "1.0" },
  { path: "/catalogo",        changefreq: "daily",   priority: "0.9" },
  { path: "/mapa-sono",       changefreq: "weekly",  priority: "0.7" },
  { path: "/lp/luxo",         changefreq: "monthly", priority: "0.6" },
  { path: "/lp/box-bau",      changefreq: "monthly", priority: "0.6" },
  { path: "/lp/outlet",       changefreq: "monthly", priority: "0.6" },
  { path: "/lp/saude-coluna", changefreq: "monthly", priority: "0.6" },
  { path: "/lp/entrega-24h",  changefreq: "monthly", priority: "0.6" },
];

router.get("/sitemap.xml", async (_req, res) => {
  const siteUrl = (process.env.SITE_URL ?? "https://lojacastorcabofrio.com.br").replace(/\/$/, "");
  try {
    const staticEntries = STATIC_ROUTES.map(r => [
      "  <url>",
      `    <loc>${siteUrl}${r.path}</loc>`,
      `    <changefreq>${r.changefreq}</changefreq>`,
      `    <priority>${r.priority}</priority>`,
      "  </url>",
    ].join("\n")).join("\n");

    const rows = await db
      .select({ slug: produtosTable.slug, criadoEm: produtosTable.criadoEm })
      .from(produtosTable)
      .where(isNotNull(produtosTable.slug));

    const productEntries = rows.map(r => {
      const lastmod = r.criadoEm ? r.criadoEm.toISOString().split("T")[0] : "";
      return [
        "  <url>",
        `    <loc>${siteUrl}/produto/${r.slug}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
      ].filter(Boolean).join("\n");
    }).join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      staticEntries,
      productEntries,
      "</urlset>",
    ].join("\n");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.send(xml);
  } catch {
    res.status(500).send("Internal Server Error");
  }
});

export default router;
