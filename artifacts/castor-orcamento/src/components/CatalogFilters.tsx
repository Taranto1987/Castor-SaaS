import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductSize } from "@/utils/normalizeSize";

const SIZE_OPTIONS: ProductSize[] = ["Solteiro", "Solteiro King", "Viúvo", "Casal", "Queen", "King"];

type Availability = "all" | "disponivel" | "encomenda";
type SortBy = "ranking" | "price-asc" | "price-desc";

interface Props {
  filterSize: ProductSize | null;
  setFilterSize: (s: ProductSize | null) => void;
  filterAvailability: Availability;
  setFilterAvailability: (a: Availability) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
}

export function CatalogFilters({
  filterSize, setFilterSize,
  filterAvailability, setFilterAvailability,
  sortBy, setSortBy,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasActive = filterSize !== null || filterAvailability !== "all" || sortBy !== "ranking";

  function clearAll() {
    setFilterSize(null);
    setFilterAvailability("all");
    setSortBy("ranking");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border",
            open || hasActive
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {hasActive && (
            <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {(filterSize ? 1 : 0) + (filterAvailability !== "all" ? 1 : 0) + (sortBy !== "ranking" ? 1 : 0)}
            </span>
          )}
        </button>
        {hasActive && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {open && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
          {/* Size */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tamanho</p>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTIONS.map(size => (
                <button
                  key={size}
                  onClick={() => setFilterSize(filterSize === size ? null : size)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-semibold transition-all border",
                    filterSize === size
                      ? "bg-red-600 text-white border-red-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Disponibilidade</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "Todos"],
                ["disponivel", "Pronta Entrega"],
                ["encomenda", "Encomenda"],
              ] as [Availability, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterAvailability(val)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-semibold transition-all border",
                    filterAvailability === val
                      ? "bg-red-600 text-white border-red-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ordenar por</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["ranking", "Relevância"],
                ["price-asc", "Menor Preço"],
                ["price-desc", "Maior Preço"],
              ] as [SortBy, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSortBy(val)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-semibold transition-all border",
                    sortBy === val
                      ? "bg-red-600 text-white border-red-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
