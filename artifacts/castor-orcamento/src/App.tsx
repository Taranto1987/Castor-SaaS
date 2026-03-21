import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginScreen from "@/components/LoginScreen";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Orcamento from "@/pages/Orcamento";
import Historico from "@/pages/Historico";
import Crawler from "@/pages/Crawler";
import Dashboard from "@/pages/Dashboard";
import Logistica from "@/pages/Logistica";
import MapaSono from "@/pages/MapaSono";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/orcamento" component={Orcamento} />
        <Route path="/historico" component={Historico} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/logistica" component={Logistica} />
        <Route path="/mapa-sono" component={MapaSono} />
        <Route path="/crawler" component={Crawler} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppGate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Router /> : <LoginScreen />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppGate />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
