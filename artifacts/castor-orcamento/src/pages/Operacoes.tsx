import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Radar, TrendingUp, Flame, CalendarClock, Truck, PackageX,
  Phone, MessageCircle, User, Loader2, Inbox, Percent,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Opportunity {
  id: number;
  orcamentoId: number;
  customerId: number | null;
  cliente: string;
  whatsapp: string | null;
  status: string;
  score: number;
  closingProbability: number;
  valorNumerico: number;
  valorBrl: string | null;
  diasSemResposta: number;
  proximaAcao: string | null;
  responsavel: string | null;
  criadoEm: string | null;
}

interface OperacoesData {
  resumo: {
    pipelineTotal: number;
    receitaPrevista: number;
    leadsCriticos: number;
    followupsHoje: number;
    entregasPendentes: number;
    produtosSemEstoque: number;
    margensCriticas: number;
  };
  acaoAgora: Opportunity[];
  pipeline: Opportunity[];
}

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function scoreTone(score: number) {
  if (score >= 90) return "bg-red-600 text-white";
  if (score >= 70) return "bg-orange-500 text-white";
  if (score >= 40) return "bg-amber-400 text-amber-950";
  return "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
}

function acaoTone(acao: string | null) {
  if (acao === "Intervenção Humana") return "text-red-600 dark:text-red-400";
  if (acao === "Ligar") return "text-orange-600 dark:text-orange-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: typeof Radar; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <span className={`grid place-items-center w-8 h-8 rounded-xl ${tone}`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}

function ActionCard({ o }: { o: Opportunity }) {
  const digits = (o.whatsapp ?? "").replace(/\D/g, "");
  const waHref = digits ? `https://wa.me/${digits}` : undefined;
  const telHref = digits ? `tel:+${digits}` : undefined;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-slate-50 truncate">{o.cliente}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {o.valorBrl ?? BRL(o.valorNumerico)}
            {o.diasSemResposta > 0 && <> · {o.diasSemResposta} dias sem resposta</>}
          </p>
          <p className={`text-xs font-semibold mt-1 ${acaoTone(o.proximaAcao)}`}>
            {o.proximaAcao ?? "—"}
          </p>
        </div>
        <span className={`shrink-0 grid place-items-center w-12 h-12 rounded-xl font-extrabold ${scoreTone(o.score)}`}>
          {o.score}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={telHref}
          aria-disabled={!telHref}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${!telHref && "opacity-40 pointer-events-none"}`}
        >
          <Phone className="w-4 h-4" /> Ligar
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!waHref}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors ${!waHref && "opacity-40 pointer-events-none"}`}
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
        <Link
          href="/equipe/clientes"
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <User className="w-4 h-4" /> CRM
        </Link>
      </div>
    </div>
  );
}

export default function Operacoes() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? "";

  const { data, isLoading, isError } = useQuery<OperacoesData>({
    queryKey: ["operacoes"],
    queryFn: async () => {
      const res = await fetch("/api/operacoes", { headers: { "x-session-token": token } });
      if (!res.ok) throw new Error("Erro ao carregar a Central de Operações");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-slate-50">
          <Radar className="w-6 h-6 text-red-600" /> Central de Operações
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          O sistema te diz quem contatar, quanto vale e qual ação executar.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-300">
          Não foi possível carregar a Central de Operações. Tente novamente em instantes.
        </div>
      )}

      {data && (
        <>
          {/* Widgets */}
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard icon={TrendingUp} label="Pipeline Total" value={data.resumo.pipelineTotal} tone="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
            <StatCard icon={TrendingUp} label="Receita Prevista" value={BRL(data.resumo.receitaPrevista)} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" />
            <StatCard icon={Flame} label="Leads Críticos" value={data.resumo.leadsCriticos} tone="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" />
            <StatCard icon={CalendarClock} label="Follow-ups Hoje" value={data.resumo.followupsHoje} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" />
            <StatCard icon={Truck} label="Entregas Pendentes" value={data.resumo.entregasPendentes} tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400" />
            <StatCard icon={PackageX} label="Produtos Sem Estoque" value={data.resumo.produtosSemEstoque} tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" />
            <StatCard icon={Percent} label="Margens Críticas" value={data.resumo.margensCriticas} tone="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" />
          </section>

          {/* Ação Agora */}
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold tracking-widest text-slate-400 dark:text-slate-600 uppercase">
              Ação Agora
            </h2>

            {data.acaoAgora.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
                <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-3 font-semibold text-slate-700 dark:text-slate-300">
                  Nenhuma oportunidade ativa ainda
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Cada orçamento salvo vira automaticamente uma oportunidade aqui, ordenada por prioridade.
                  Gere um orçamento para começar a alimentar a Central.
                </p>
                <Link
                  href="/orcamento"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Criar orçamento
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.acaoAgora.map((o) => <ActionCard key={o.id} o={o} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
