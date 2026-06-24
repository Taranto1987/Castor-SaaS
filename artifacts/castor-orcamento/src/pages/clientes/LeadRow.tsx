import { Edit2, XCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/utils/currency";
import { scoreIcon, scoreLabel, getDias, diasBadge, getLeadValue } from "./helpers";
import { WaBtn } from "./WaBtn";
import { ESTAGIOS, ARCHIVED_STAGES } from "./constants";
import type { Lead } from "./constants";

export function LeadRow({
  lead,
  onEdit,
  onCancel,
}: {
  lead: Lead;
  onEdit?: (lead: Lead) => void;
  onCancel?: (lead: Lead) => void;
}) {
  const score  = lead.pontuacao ?? 0;
  const sl     = scoreLabel(score);
  const estagio = ESTAGIOS.find((e) => e.key === lead.estagio);
  const dias   = getDias(lead);
  const db     = diasBadge(dias);
  const valor  = getLeadValue(lead);
  const isTerminal = ARCHIVED_STAGES.includes(lead.estagio);

  return (
    <Link href={`/equipe/clientes/${lead.id}`}>
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{lead.nome}</span>
            <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1 px-1.5", sl.color)}>
              {scoreIcon(score)}
              <span className="hidden sm:inline">{sl.label}</span>
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {lead.whatsapp && (
              <span className="text-[11px] text-slate-400">{lead.whatsapp}</span>
            )}
            {lead.proximaAcao && lead.proximaAcao !== "Concluído" && (
              <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[180px]">
                → {lead.proximaAcao}
              </span>
            )}
          </div>
        </div>

        {valor > 0 && (
          <span className="text-sm font-bold text-emerald-700 shrink-0 hidden md:block">
            {lead.valorBrl ?? formatBRL(valor)}
          </span>
        )}

        <Badge variant="outline" className={cn("text-[10px] shrink-0 hidden sm:flex", estagio?.color)}>
          {estagio?.label}
        </Badge>

        <span className={cn("text-[10px] font-semibold border rounded-full px-1.5 py-0.5 shrink-0", db.cls)}>
          {db.text}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {lead.whatsapp && (
            <WaBtn whatsapp={lead.whatsapp} nome={lead.nome} size="sm" />
          )}
          <div className="hidden group-hover:flex items-center gap-0.5">
            {onEdit && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(lead); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Editar"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onCancel && !isTerminal && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(lead); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Cancelar"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
