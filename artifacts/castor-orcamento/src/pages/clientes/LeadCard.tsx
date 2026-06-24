import { motion } from "framer-motion";
import { Edit2, XCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/utils/currency";
import { scoreIcon, scoreLabel, getDias, diasBadge, getLeadValue, origemLabel } from "./helpers";
import { WaBtn } from "./WaBtn";
import { ARCHIVED_STAGES } from "./constants";
import type { Lead } from "./constants";

export function LeadCard({
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
  const dias   = getDias(lead);
  const db     = diasBadge(dias);
  const valor  = getLeadValue(lead);
  const isTerminal = ARCHIVED_STAGES.includes(lead.estagio);

  return (
    <Link href={`/equipe/clientes/${lead.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
      >
        <div className="flex items-start gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-slate-900 text-sm leading-tight block truncate">{lead.nome}</span>
            {lead.vendedorAtribuido && (
              <span className="text-[10px] text-slate-400">{lead.vendedorAtribuido}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1 px-1.5 py-0.5", sl.color)}>
              {scoreIcon(score)}
              {score > 0 && <span>{Math.round(score)}</span>}
            </Badge>
            {lead.whatsapp && <WaBtn whatsapp={lead.whatsapp} nome={lead.nome} size="sm" />}
          </div>
        </div>

        {valor > 0 && (
          <p className="text-sm font-bold text-emerald-700 mb-1.5">
            {lead.valorBrl ?? formatBRL(valor)}
          </p>
        )}

        {lead.proximaAcao && lead.proximaAcao !== "Concluído" && (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 mb-1.5 truncate">
            → {lead.proximaAcao}
          </p>
        )}

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[10px] font-semibold border rounded-full px-1.5 py-0.5", db.cls)}>
              {db.text}
            </span>
            {lead.origem && lead.origem !== "loja" && (
              <span className="text-[10px] text-slate-400">{origemLabel(lead.origem)}</span>
            )}
          </div>
          <div className="hidden group-hover:flex items-center gap-0.5">
            {onEdit && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(lead); }}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Editar"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
            {onCancel && !isTerminal && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(lead); }}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Cancelar"
              >
                <XCircle className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {(lead.tags as string[]).length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {(lead.tags as string[]).slice(0, 2).map((t) => (
              <span key={t} className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">{t}</span>
            ))}
          </div>
        )}
      </motion.div>
    </Link>
  );
}
