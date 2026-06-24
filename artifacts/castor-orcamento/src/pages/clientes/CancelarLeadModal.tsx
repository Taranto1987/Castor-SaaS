import { useState } from "react";
import { XCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { API_URL, getAuthHeaders } from "./constants";
import type { Lead } from "./constants";

export function CancelarLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");

  const cancelar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ estagio: "cancelado", motivo: motivo.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao cancelar");
      }
      return res.json();
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
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <XCircle className="w-5 h-5" />
            Cancelar Lead
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-slate-600">
            Cancelar <strong>{lead.nome}</strong>? O lead fica no histórico com status "Cancelado".
          </p>
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: comprou de concorrente, desistiu, sem contato..."
              rows={3}
              autoFocus
            />
          </div>
          {cancelar.isError && (
            <p className="text-xs text-red-500">{(cancelar.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={!motivo.trim() || cancelar.isPending}
            onClick={() => cancelar.mutate()}
          >
            {cancelar.isPending ? "Cancelando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
