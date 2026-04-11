import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginScreen from "@/components/LoginScreen";
import PublicLayout from "@/components/PublicLayout";
import Layout from "@/components/Layout";

// Public pages
import Landing from "@/pages/Landing";
import Catalogo from "@/pages/Catalogo";
import MapaSono from "@/pages/MapaSono";

// Private pages
import Home from "@/pages/Home";
import Orcamento from "@/pages/Orcamento";
import Historico from "@/pages/Historico";
import Crawler from "@/pages/Crawler";
import Dashboard from "@/pages/Dashboard";
import Logistica from "@/pages/Logistica";
import Clientes from "@/pages/Clientes";
import Outlet from "@/pages/Outlet";
import Estoque from "@/pages/Estoque";
import RankingOutlet from "@/pages/RankingOutlet";
import EntradaEstoque from "@/pages/EntradaEstoque";
import Financeiro from "@/pages/Financeiro";
import Usuarios from "@/pages/Usuarios";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

// ── Wraps private pages: shows Login if not authenticated ──────────────────
function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginScreen />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function DonoRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  if (!isAuthenticated) return <LoginScreen />;
  if (user?.papel !== "dono") {
    setLocation("/equipe");
    return null;
  }
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Switch>
      {/* ── PUBLIC ─────────────────────────────────────────────────────── */}
      <Route path="/">
        <PublicLayout><Landing /></PublicLayout>
      </Route>
      <Route path="/catalogo">
        <PublicLayout><Catalogo /></PublicLayout>
      </Route>
      <Route path="/mapa-sono">
        <PublicLayout><MapaSono /></PublicLayout>
      </Route>

      {/* ── PRIVATE ────────────────────────────────────────────────────── */}
      <Route path="/equipe"             component={() => <PrivateRoute component={Home} />} />
      <Route path="/orcamento"          component={() => <PrivateRoute component={Orcamento} />} />
      <Route path="/historico"          component={() => <PrivateRoute component={Historico} />} />
      <Route path="/dashboard"          component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/logistica"          component={() => <PrivateRoute component={Logistica} />} />
      <Route path="/crawler"            component={() => <PrivateRoute component={Crawler} />} />
      <Route path="/equipe/clientes"    component={() => <PrivateRoute component={Clientes} />} />
      <Route path="/outlet"             component={() => <PrivateRoute component={Outlet} />} />
      <Route path="/estoque"            component={() => <DonoRoute component={Estoque} />} />
      <Route path="/ranking-outlet"     component={() => <DonoRoute component={RankingOutlet} />} />
      <Route path="/entrada-estoque"   component={() => <DonoRoute component={EntradaEstoque} />} />
      <Route path="/financeiro"         component={() => <PrivateRoute component={Financeiro} />} />
      <Route path="/usuarios"           component={() => <DonoRoute component={Usuarios} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
