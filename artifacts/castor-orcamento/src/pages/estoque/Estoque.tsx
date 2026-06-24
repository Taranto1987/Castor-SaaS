import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { EstoqueTab } from "./EstoqueTab";
import { GestaoModosTab } from "./GestaoModosTab";

export default function Estoque() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isDono = user?.papel === "dono";
  const [aba, setAba] = useState<"estoque" | "modos">("estoque");

  const handleRefresh = () => {
    if (aba === "estoque") {
      queryClient.invalidateQueries({ queryKey: ["estoque-produtos"] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["gestao-produtos"] });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-slate-900 tracking-tight">
            Estoque
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Controle de quantidades e gestão do catálogo.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setAba("estoque")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
            aba === "estoque" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Estoque
        </button>
        {isDono && (
          <button
            onClick={() => setAba("modos")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              aba === "modos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Catálogo / Outlet
          </button>
        )}
      </div>

      {aba === "estoque" && <EstoqueTab isDono={isDono} />}
      {aba === "modos" && isDono && <GestaoModosTab />}
    </div>
  );
}
