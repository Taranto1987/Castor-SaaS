import { useMemo, useState } from "react";
import {
  Users, DollarSign, Flame, Clock, RefreshCw,
  Plus, Search, Filter, LayoutGrid, List, Archive, ShoppingBag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/utils/currency";
import { getDias, getLeadValue } from "./helpers";
import { KpiCard } from "./KpiCard";
import { PipelineBoard } from "./PipelineBoard";
import { LeadRow } from "./LeadRow";
import { NovoLeadModal } from "./NovoLeadModal";
import { EditarLeadModal } from "./EditarLeadModal";
import { CancelarLeadModal } from "./CancelarLeadModal";
import { ResetarCRMModal } from "./ResetarCRMModal";
import { ClientesHistorico } from "./ClientesHistorico";
import { API_URL, getAuthHeaders, userIsDono, ESTAGIOS, PIPELINE_STAGES, ACTIVE_STAGES, ARCHIVED_STAGES } from "./constants";
import type { Lead } from "./constants";

export default function Clientes() {
  const { user } = useAuth();
  const [novoModal,      setNovoModal]      = useState(false);
  const [editLead,       setEditLead]       = useState<Lead | null>(null);
  const [cancelLead,     setCancelLead]     = useState<Lead | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [search,         setSearch]         = useState("");
  const [filterEstagio,  setFilterEstagio]  = useState("todos");

  const isDono = userIsDono(user);

  const { data, isLoading, isError, refetch } = useQuery<{ leads: Lead[] }>({
    queryKey: ["leads", user?.sessionToken],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/leads`, { headers: getAuthHeaders(), cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!user?.sessionToken,
    staleTime: 0,
    refetchOnMount: true,
  });

  const leads = data?.leads ?? [];

  const kpis = useMemo(() => {
    const active   = leads.filter((l) => ACTIVE_STAGES.includes(l.estagio));
    const pipeline = active.reduce((s, l) => s + getLeadValue(l), 0);
    const quentes  = leads.filter((l) => ACTIVE_STAGES.includes(l.estagio) && (l.pontuacao ?? 0) >= 70).length;
    const overdue  = leads.filter((l) => ACTIVE_STAGES.includes(l.estagio) && getDias(l) > 7).length;
    return { activeCount: active.length, pipelineValue: pipeline, quentes, overdue };
  }, [leads]);

  const activeLeadsCount     = kpis.activeCount;
  const archivedLeads        = leads.filter((l) => ARCHIVED_STAGES.includes(l.estagio));
  const resetableCount       = leads.filter((l) => ["novo", "contato", "proposta", "negociacao", "ganho"].includes(l.estagio)).length;
  const totalResettableCount = leads.filter((l) => !ARCHIVED_STAGES.includes(l.estagio)).length;

  function applyFilter(list: Lead[]) {
    let l = list;
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((r) => r.nome.toLowerCase().includes(q) || (r.whatsapp ?? "").includes(q));
    }
    if (filterEstagio !== "todos") l = l.filter((r) => r.estagio === filterEstagio);
    return l;
  }

  const pipelineLeads = useMemo(
    () => applyFilter(leads.filter((l) => PIPELINE_STAGES.includes(l.estagio))),
    [leads, search, filterEstagio],
  );

  const listaLeads = useMemo(
    () => applyFilter(leads.filter((l) => !ARCHIVED_STAGES.includes(l.estagio))),
    [leads, search, filterEstagio],
  );

  const arquivadosFiltered = useMemo(
    () => applyFilter(archivedLeads),
    [archivedLeads, search, filterEstagio],
  );

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight">CRM</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {activeLeadsCount} lead{activeLeadsCount !== 1 ? "s" : ""} ativo{activeLeadsCount !== 1 ? "s" : ""}
            {archivedLeads.length > 0 && ` · ${archivedLeads.length} arquivado${archivedLeads.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDono && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetModal(true)}
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5" />
              Resetar CRM
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setNovoModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Novo Lead
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Leads ativos" value={kpis.activeCount} sub="no pipeline" accent="bg-blue-500" />
        <KpiCard icon={DollarSign} label="Em pipeline" value={kpis.pipelineValue > 0 ? formatBRL(kpis.pipelineValue) : "—"} sub="valor potencial" accent="bg-emerald-600" />
        <KpiCard icon={Flame} label="Leads quentes" value={kpis.quentes} sub="score ≥ 70" accent="bg-red-500" />
        <KpiCard icon={Clock} label="Sem contato" value={kpis.overdue} sub="há mais de 7 dias" accent={kpis.overdue > 0 ? "bg-amber-500" : "bg-slate-400"} />
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <TabsList className="self-start">
            <TabsTrigger value="pipeline" className="gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5">
              <List className="w-3.5 h-3.5" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="arquivados" className="gap-1.5">
              <Archive className="w-3.5 h-3.5" />
              Arquivados
              {archivedLeads.length > 0 && (
                <span className="ml-0.5 text-[10px] bg-slate-200 text-slate-600 rounded-full px-1.5 leading-5">{archivedLeads.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              Clientes
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm w-40"
              />
            </div>
            <Select value={filterEstagio} onValueChange={setFilterEstagio}>
              <SelectTrigger className="h-8 text-sm w-36 gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTAGIOS.map((e) => (
                  <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="pipeline">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              Carregando...
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p className="text-sm font-medium text-red-500">Erro ao carregar leads.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <PipelineBoard leads={pipelineLeads} onEdit={setEditLead} onCancel={setCancelLead} />
          )}
        </TabsContent>

        <TabsContent value="lista">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Carregando...
              </div>
            ) : isError ? (
              <div className="text-center py-16">
                <p className="text-sm font-medium text-red-500">Erro ao carregar leads.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button>
              </div>
            ) : listaLeads.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                {leads.length === 0 ? (
                  <>
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                    <p className="font-semibold text-slate-500">Nenhum lead cadastrado</p>
                    <p className="text-sm mt-1">Clique em "Novo Lead" para começar.</p>
                  </>
                ) : (
                  <p>Nenhum resultado para os filtros.</p>
                )}
              </div>
            ) : (
              listaLeads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onEdit={setEditLead} onCancel={setCancelLead} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="arquivados">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Carregando...
              </div>
            ) : arquivadosFiltered.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Archive className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="font-semibold text-slate-500">Nenhum lead arquivado</p>
                <p className="text-sm mt-1">Leads cancelados, perdidos e arquivados aparecem aqui.</p>
              </div>
            ) : (
              arquivadosFiltered.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onEdit={setEditLead} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="clientes">
          <ClientesHistorico />
        </TabsContent>
      </Tabs>

      <NovoLeadModal open={novoModal} onClose={() => setNovoModal(false)} />
      {editLead   && <EditarLeadModal   lead={editLead}   onClose={() => setEditLead(null)}   />}
      {cancelLead && <CancelarLeadModal lead={cancelLead} onClose={() => setCancelLead(null)} />}
      {showResetModal && (
        <ResetarCRMModal
          activeCount={resetableCount}
          totalResettableCount={totalResettableCount}
          onClose={() => setShowResetModal(false)}
        />
      )}
    </div>
  );
}
