import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function gtmPlugin(): Plugin {
  return {
    name: "vite-plugin-gtm",
    transformIndexHtml(html) {
      const gtmId = process.env.VITE_GTM_ID;
      const gaId = process.env.VITE_GA_MEASUREMENT_ID;
      let tags = "";
      let bodyTags = "";

      if (gtmId) {
        tags += `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>\n    `;
        bodyTags += `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n    `;
      }

      if (gaId) {
        tags += `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>\n    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>\n    `;
      }

      if (tags) html = html.replace("</head>", `${tags}</head>`);
      if (bodyTags) html = html.replace("<body>", `<body>\n    ${bodyTags}`);
      return html;
    },
  };
}

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async ({ mode }) => {
  const isDev = mode === "development";
  const isReplit = isDev && !!process.env.REPL_ID;

  const replitPlugins = isReplit
    ? [
        await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
      ]
    : [];

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), gtmPlugin(), ...replitPlugins],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React runtime — tiny, always needed
            "vendor-react": ["react", "react-dom"],
            // Animation library — heavy, shared across pages
            "vendor-motion": ["framer-motion"],
            // Charts — only used in Dashboard/Financeiro (admin only)
            "vendor-recharts": ["recharts"],
            // Radix UI — shared UI primitives
            "vendor-radix": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-popover",
              "@radix-ui/react-accordion",
            ],
            // Data fetching
            "vendor-query": ["@tanstack/react-query"],
          },
        },
        onwarn(warning, warn) {
          if (warning.message?.includes("Can't resolve original location of error")) return;
          warn(warning);
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: { strict: true, deny: ["**/.*"] },
    },
    preview: { port, host: "0.0.0.0", allowedHosts: true },
  };
});
