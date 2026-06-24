import { useState } from "react";
import { DollarSign, BarChart2, Receipt, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { TabVisaoGeral } from "./TabVisaoGeral";
import { TabDespesas } from "./TabDespesas";
import { TabComissoes } from "./TabComissoes";
import { TabDRE } from "./TabDRE";
import { MESES } from "./constants";
import type { Tab } from "./constants";

export default function Financeiro() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("visao");
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  if (user?.papel !== "dono") {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <DollarSign className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500">Esta seção é exclusiva para o dono da loja.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "visao", label: "Visão Geral", icon: BarChart2 },
    { key: "despesas", label: "Despesas", icon: Receipt },
    { key: "comissoes", label: "Comissões", icon: Users },
    { key: "dre", label: "DRE", icon: FileText },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
          Financeiro
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          Controle completo de receitas, despesas e lucro.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={mes}
          onChange={e => setMes(parseInt(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {MESES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={ano}
          onChange={e => setAno(parseInt(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {tab === "visao" && <TabVisaoGeral mes={mes} ano={ano} token={user?.sessionToken || ""} />}
      {tab === "despesas" && <TabDespesas mes={mes} ano={ano} token={user?.sessionToken || ""} />}
      {tab === "comissoes" && <TabComissoes mes={mes} ano={ano} token={user?.sessionToken || ""} />}
      {tab === "dre" && <TabDRE mes={mes} ano={ano} token={user?.sessionToken || ""} />}
    </div>
  );
}
