import { cn } from "@/lib/utils";

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", accent)}>
        <Icon className="w-4.5 h-4.5 text-white" size={18} />
      </div>
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide leading-none mb-1">{label}</p>
      <p className="text-xl font-extrabold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
