import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_URL, getAuthHeaders, ESTAGIOS } from "./constants";
import type { Lead } from "./constants";

export function EditarLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(lead.nome);
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp ?? "");
  const [origem, setOrigem] = useState(lead.origem ?? "loja");
  const [estagio, setEstagio] = useState(lead.estagio);
  const [observacoes, setObservacoes] = useState(lead.observacoes ?? "");
  const [tagsRaw, setTagsRaw] = useState((lead.tags as string[]).join(", "));
  const [motivoGanho, setMotivoGanho] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      const extra: Record<string, unknown> = {};
      if (estagio === "ganho" && motivoGanho.trim()) extra.motivoGanho = motivoGanho.trim();
      if (estagio === "perdido" && motivoPerda.trim()) extra.motivoPerda = motivoPerda.trim();
      const res = await fetch(`${API_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ nome: nome.trim(), whatsapp: whatsapp.trim() || null, origem, estagio, observacoes: observacoes.trim() || null, tags, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
  });

  const EDIT_ESTAGIOS = ESTAGIOS.filter((e) => e.key !== "cancelado");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lead — {lead.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(22) 99999-9999" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loja">Loja física</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="whatsapp_direto">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estágio</Label>
              <Select value={estagio} onValueChange={setEstagio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDIT_ESTAGIOS.map((e) => (
                    <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="interesse, urgente..." />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas sobre o cliente..."
              rows={3}
            />
          </div>
          {estagio === "ganho" && (
            <div className="space-y-1.5">
              <Label>Motivo do ganho <span className="text-slate-400 text-xs">(opcional)</span></Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                value={motivoGanho}
                onChange={(e) => setMotivoGanho(e.target.value)}
                placeholder="Ex: produto ideal, preço competitivo, urgência..."
                rows={2}
              />
            </div>
          )}
          {estagio === "perdido" && (
            <div className="space-y-1.5">
              <Label>Motivo da perda <span className="text-slate-400 text-xs">(opcional)</span></Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                placeholder="Ex: comprou de concorrente, sem orçamento, desistiu..."
                rows={2}
              />
            </div>
          )}
          {salvar.isError && (
            <p className="text-xs text-red-500">{(salvar.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
