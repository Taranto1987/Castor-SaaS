import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

const SITE_URL = process.env.SITE_URL ?? "https://lojacastorcabofrio.com.br";

const SITEMAP_URLS = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/catalogo", priority: "0.9", changefreq: "daily" },
  { loc: "/mapa-sono", priority: "0.8", changefreq: "monthly" },
  { loc: "/colchao-cabo-frio", priority: "0.9", changefreq: "weekly" },
  { loc: "/colchao-araruama", priority: "0.9", changefreq: "weekly" },
];

app.get("/sitemap.xml", (_req: Request, res: Response) => {
  const now = new Date().toISOString().split("T")[0];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_URLS.map(
      u =>
        `  <url>\n    <loc>${SITE_URL}${u.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    ),
    "</urlset>",
  ].join("\n");

  res.header("Content-Type", "application/xml");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(xml);
});

app.get("/robots.txt", (_req: Request, res: Response) => {
  res.type("text/plain");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

export default app;
