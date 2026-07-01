import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Database, Play, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, HardDrive, ShieldCheck, RotateCcw
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useStatusCrawler,
  useIniciarCrawler,
  getStatusCrawlerQueryKey
} from "@workspace/api-client-react";

export default function Crawler() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  // Status Query
  const { data: status, refetch } = useStatusCrawler();

  // Poll if status is running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status?.status === 'running') {
      setIsPolling(true);
      interval = setInterval(() => {
        refetch();
      }, 3000);
    } else {
      setIsPolling(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status?.status, refetch]);

  // Start Mutation
  const { mutate: startCrawler, isPending: isStarting } = useIniciarCrawler({
    mutation: {
      onSuccess: () => {
        toast({ title: "Iniciado", description: "O robô começou a coletar os produtos." });
        queryClient.invalidateQueries({ queryKey: getStatusCrawlerQueryKey() });
        refetch();
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível iniciar o robô.", variant: "destructive" });
      }
    }
  });

  const [isResetting, setIsResetting] = useState(false);

  const isRunning = status?.status === 'running';
  const progressPercent = status?.totalProdutos
    ? Math.round((status.produtosColetados / status.totalProdutos) * 100)
    : 0;

  const handleStart = () => {
    if (isRunning) return;
    if (confirm("Tem certeza que deseja iniciar a varredura completa? Isso pode demorar alguns minutos e atualizará o banco de dados atual.")) {
      startCrawler();
    }
  };

  const handleReset = async () => {
    if (!confirm("Forçar reset vai marcar o crawler como parado. Use apenas se ele estiver travado.")) return;
    setIsResetting(true);
    try {
      await fetch("/api/crawler/resetar", { method: "POST", headers: { "x-session-token": sessionStorage.getItem("sessionToken") ?? "" } });
      toast({ title: "Reset feito", description: "Status resetado. Pode iniciar uma nova varredura." });
      queryClient.invalidateQueries({ queryKey: getStatusCrawlerQueryKey() });
      refetch();
    } catch {
      toast({ title: "Erro", description: "Não foi possível resetar.", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusColor = (s?: string) => {
    switch(s) {
      case 'running': return 'text-blue-500 bg-blue-50 border-blue-200';
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (s?: string) => {
    switch(s) {
      case 'running': return <RefreshCw className="w-5 h-5 animate-spin" />;
      case 'completed': return <CheckCircle2 className="w-5 h-5" />;
      case 'error': return <AlertTriangle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusText = (s?: string) => {
    switch(s) {
      case 'running': return 'Varredura em andamento';
      case 'completed': return 'Banco atualizado com sucesso';
      case 'error': return 'Erro na última execução';
      default: return 'Aguardando inicialização';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--';
    try {
      return format(new Date(dateString), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Database className="w-8 h-8 text-primary" /> Banco de Dados
        </h1>
        <p className="text-slate-500 mt-2 text-sm md:text-base max-w-2xl">
          Gerencie a sincronização de produtos. O robô varre o site oficial e atualiza precos, imagens e detalhes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Status Card */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-8 relative overflow-hidden">
          {/* Animated bg blob when running */}
          {isRunning && (
            <motion.div 
              className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          )}

          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Status do Sincronizador</h2>
              <p className="text-sm text-slate-500 mt-1">{status?.mensagem || "Pronto para operação"}</p>
            </div>
            
            <div className={cn("px-4 py-2 rounded-full border flex items-center gap-2 font-bold text-sm", getStatusColor(status?.status))}>
              {getStatusIcon(status?.status)}
              {getStatusText(status?.status)}
            </div>
          </div>

          <div className="relative z-10 space-y-3">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-slate-600">Progresso da Coleta</span>
              <span className={cn(isRunning ? "text-primary" : "text-slate-700")}>
                {status?.produtosColetados || 0} / {status?.totalProdutos || 0} produtos
              </span>
            </div>
            
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                className={cn("h-full rounded-full", isRunning ? "bg-primary" : status?.status === 'error' ? "bg-red-500" : "bg-slate-300")}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="relative z-10 flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleStart}
              disabled={isRunning || isStarting}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRunning || isStarting ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> Sincronizando...</>
              ) : (
                <><Play className="w-5 h-5" /> Iniciar Varredura Completa</>
              )}
            </button>
            {isRunning && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                title="Forçar reset se o crawler estiver travado"
                className="px-4 py-4 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                {isResetting ? "Resetando..." : "Forçar Reset"}
              </button>
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-primary/20">
            <ShieldCheck className="w-8 h-8 text-blue-200 mb-4" />
            <h3 className="font-display font-bold text-lg mb-1">Catálogo Protegido</h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-6">
              Todos os preços são validados e padronizados automaticamente ao entrar no banco.
            </p>
            <div className="bg-white/10 rounded-xl p-4 border border-white/10 backdrop-blur">
              <div className="text-blue-200 text-xs uppercase tracking-wider font-semibold mb-1">Total no Banco</div>
              <div className="text-3xl font-bold">{status?.totalProdutos || 0}</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-slate-400" /> Metadados
            </h4>
            
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-slate-500 text-xs mb-1">Último Início</div>
                <div className="font-semibold text-slate-700">{formatDate(status?.iniciadoEm)}</div>
              </div>
              <hr className="border-slate-100" />
              <div>
                <div className="text-slate-500 text-xs mb-1">Última Finalização</div>
                <div className="font-semibold text-slate-700">{formatDate(status?.finalizadoEm)}</div>
              </div>
              {status?.erros ? (
                <>
                  <hr className="border-slate-100" />
                  <div>
                    <div className="text-red-500 text-xs mb-1">Erros Registrados</div>
                    <div className="font-bold text-red-600">{status.erros}</div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
