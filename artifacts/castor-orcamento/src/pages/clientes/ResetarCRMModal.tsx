import { useState } from "react";
import { Archive, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { API_URL, getAuthHeaders } from "./constants";

export function ResetarCRMModal({
  activeCount,
  totalResettableCount,
  onClose,
}: {
  activeCount: number;
  totalResettableCount: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [tudo, setTudo] = useState(false);

  const count  = tudo ? totalResettableCount : activeCount;
  const PALAVRA = tudo ? "LIMPAR TUDO" : "RESETAR";

  const resetar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/leads/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ tudo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao resetar");
      }
      return res.json() as Promise<{ arquivados: number }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            {tudo ? "Limpar CRM" : "Resetar CRM"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          {!tudo ? (
            <p className="text-sm text-slate-600">
              Arquiva <strong>{activeCount} lead{activeCount !== 1 ? "s" : ""}</strong> em estágio ativo
              (Novo, Contato, Proposta, Negociação). Nenhum dado é apagado.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Arquiva <strong>todos os {totalResettableCount} leads</strong> incluindo ganhos e perdidos.
              Use para limpar dados de teste.
            </p>
          )}

          <button
            type="button"
            onClick={() => { setTudo((v) => !v); setConfirm(""); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left",
              tudo
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-200 hover:bg-slate-50 text-slate-600"
            )}
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>{tudo ? "✓ Limpar tudo (incluindo ganhos e perdidos)" : "Incluir ganhos e perdidos"}</span>
          </button>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">
              Digite{" "}
              <span className="font-mono font-bold text-slate-700">{PALAVRA}</span>{" "}
              para confirmar
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={PALAVRA}
              className="font-mono"
              autoFocus
            />
          </div>
          {resetar.isError && (
            <p className="text-xs text-red-500">{(resetar.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={confirm.trim().toUpperCase() !== PALAVRA || resetar.isPending || count === 0}
            onClick={() => resetar.mutate()}
          >
            {resetar.isPending ? "Arquivando..." : `Arquivar ${count} lead${count !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
