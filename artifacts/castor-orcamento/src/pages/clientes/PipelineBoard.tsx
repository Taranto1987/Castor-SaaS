import { cn } from "@/lib/utils";
import { formatBRL } from "@/utils/currency";
import { getLeadValue } from "./helpers";
import { LeadCard } from "./LeadCard";
import { ESTAGIOS, PIPELINE_STAGES } from "./constants";
import type { Lead } from "./constants";

export function PipelineBoard({
  leads,
  onEdit,
  onCancel,
}: {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onCancel: (lead: Lead) => void;
}) {
  const cols = ESTAGIOS.filter((e) => PIPELINE_STAGES.includes(e.key as string));

  return (
    <div className="overflow-x-auto pb-4 -mx-1 px-1">
      <div className="flex gap-3 min-w-max">
        {cols.map((col) => {
          const itens    = leads.filter((l) => l.estagio === col.key);
          const colValue = itens.reduce((s, l) => s + getLeadValue(l), 0);
          return (
            <div key={col.key} className="w-64 shrink-0">
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-xl border mb-3", col.color)}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{col.label}</span>
                  <span className="text-[11px] font-bold bg-white/60 rounded-full px-1.5 leading-5">{itens.length}</span>
                </div>
                {colValue > 0 && (
                  <span className="text-[10px] font-semibold opacity-80">{formatBRL(colValue)}</span>
                )}
              </div>
              <div className="space-y-2">
                {itens.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onEdit={onEdit} onCancel={onCancel} />
                ))}
                {itens.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center text-xs text-slate-400">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
