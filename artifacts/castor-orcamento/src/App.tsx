import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LojaProvider } from "@/contexts/LojaContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CommandPaletteProvider } from "@/components/CommandPalette";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoginScreen from "@/components/LoginScreen";
import PublicLayout from "@/components/PublicLayout";
import Layout from "@/components/Layout";

// ── Public pages — loaded eagerly (above the fold, SEO-critical) ──────────
import Landing from "@/pages/Landing";
import Catalogo from "@/pages/Catalogo";
import MapaSono from "@/pages/MapaSono";
import ProdutoDetalhe from "@/pages/ProdutoDetalhe";

// ── Landing Pages — lazy (conversion pages, not critical path) ─────────────
const LuxoCaboFrio    = lazy(() => import("@/pages/lp/LuxoCaboFrio"));
const CamaBoxAraruama = lazy(() => import("@/pages/lp/CamaBoxAraruama"));
const OutletPromocao  = lazy(() => import("@/pages/lp/OutletPromocao"));
const SaudeColuna     = lazy(() => import("@/pages/lp/SaudeColuna"));
const Entrega24h      = lazy(() => import("@/pages/lp/Entrega24h"));

// ── Auth pages — lazy (only visited once) ─────────────────────────────────
const AceitarConvite = lazy(() => import("@/pages/auth/AceitarConvite"));
const RedefinirSenha = lazy(() => import("@/pages/auth/RedefinirSenha"));

// ── Admin/private pages — lazy (never loaded by public visitors) ───────────
const Home          = lazy(() => import("@/pages/Home"));
const Orcamento     = lazy(() => import("@/pages/Orcamento"));
const Historico     = lazy(() => import("@/pages/Historico"));
const Dashboard     = lazy(() => import("@/pages/Dashboard"));
const Logistica     = lazy(() => import("@/pages/Logistica"));
const Crawler       = lazy(() => import("@/pages/Crawler"));
const Clientes      = lazy(() => import("@/pages/Clientes"));
const Outlet        = lazy(() => import("@/pages/Outlet"));
const Estoque       = lazy(() => import("@/pages/Estoque"));
const RankingOutlet = lazy(() => import("@/pages/RankingOutlet"));
const EntradaEstoque= lazy(() => import("@/pages/EntradaEstoque"));
const Financeiro      = lazy(() => import("@/pages/Financeiro"));
const Usuarios        = lazy(() => import("@/pages/Usuarios"));
const ClienteDetalhe  = lazy(() => import("@/pages/ClienteDetalhe"));
const Outcomes        = lazy(() => import("@/pages/Outcomes"));
const Inbox           = lazy(() => import("@/pages/Inbox"));
const Operacoes       = lazy(() => import("@/pages/Operacoes"));
const NotFound        = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginScreen />;
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </Layout>
  );
}

function DonoRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  if (!isAuthenticated) return <LoginScreen />;
  if (user?.papel !== "dono" && user?.papel !== "ADMIN" && user?.papel !== "GERENTE") {
    setLocation("/equipe");
    return null;
  }
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* ── PUBLIC ───────────────────────────────────────────────────── */}
        <Route path="/">
          <PublicLayout><Landing /></PublicLayout>
        </Route>
        <Route path="/catalogo">
          <PublicLayout><Catalogo /></PublicLayout>
        </Route>
        <Route path="/mapa-sono">
          <PublicLayout><MapaSono /></PublicLayout>
        </Route>
        <Route path="/produto/:slug">
          <ProdutoDetalhe />
        </Route>

        {/* ── AUTH ─────────────────────────────────────────────────────── */}
        <Route path="/aceitar-convite"><AceitarConvite /></Route>
        <Route path="/redefinir-senha"><RedefinirSenha /></Route>

        {/* ── LANDING PAGES ────────────────────────────────────────────── */}
        <Route path="/lp/luxo"><LuxoCaboFrio /></Route>
        <Route path="/lp/box-bau"><CamaBoxAraruama /></Route>
        <Route path="/lp/outlet"><OutletPromocao /></Route>
        <Route path="/lp/saude-coluna"><SaudeColuna /></Route>
        <Route path="/lp/entrega-24h"><Entrega24h /></Route>

        {/* ── PRIVATE ──────────────────────────────────────────────────── */}
        <Route path="/equipe"           component={() => <PrivateRoute component={Home} />} />
        <Route path="/orcamento"        component={() => <PrivateRoute component={Orcamento} />} />
        <Route path="/historico"        component={() => <PrivateRoute component={Historico} />} />
        <Route path="/operacoes"        component={() => <PrivateRoute component={Operacoes} />} />
        <Route path="/dashboard"        component={() => <PrivateRoute component={Dashboard} />} />
        <Route path="/logistica"        component={() => <PrivateRoute component={Logistica} />} />
        <Route path="/crawler"          component={() => <PrivateRoute component={Crawler} />} />
        <Route path="/equipe/clientes/:id" component={() => <PrivateRoute component={ClienteDetalhe} />} />
        <Route path="/equipe/clientes"  component={() => <PrivateRoute component={Clientes} />} />
        <Route path="/inbox"            component={() => <PrivateRoute component={Inbox} />} />
        <Route path="/outlet"           component={() => <PrivateRoute component={Outlet} />} />
        <Route path="/estoque"          component={() => <DonoRoute component={Estoque} />} />
        <Route path="/ranking-outlet"   component={() => <DonoRoute component={RankingOutlet} />} />
        <Route path="/entrada-estoque"  component={() => <DonoRoute component={EntradaEstoque} />} />
        <Route path="/financeiro"       component={() => <PrivateRoute component={Financeiro} />} />
        <Route path="/usuarios"         component={() => <DonoRoute component={Usuarios} />} />
        <Route path="/diagnosticos"     component={() => <DonoRoute component={Outcomes} />} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <LojaProvider>
            <AuthProvider>
              <CommandPaletteProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <ErrorBoundary>
                    <AppRoutes />
                  </ErrorBoundary>
                </WouterRouter>
                <Toaster />
                <Analytics />
              </CommandPaletteProvider>
            </AuthProvider>
          </LojaProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
