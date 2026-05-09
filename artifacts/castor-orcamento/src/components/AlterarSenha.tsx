import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AlterarSenha({ onSuccess }: { onSuccess?: () => void }) {
  const { user, logout } = useAuth();
  const token = user?.sessionToken ?? "";

  const [form, setForm] = useState({ senhaAtual: "", novaSenha: "", confirma: "" });
  const [show, setShow] = useState(false);
  const [erro, setErro] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.novaSenha.length < 8) throw new Error("Nova senha deve ter pelo menos 8 caracteres.");
      if (form.novaSenha !== form.confirma) throw new Error("As senhas não coincidem.");

      const res = await fetch("/api/auth/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ senhaAtual: form.senhaAtual, novaSenha: form.novaSenha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao alterar senha");
      return data;
    },
    onSuccess: () => {
      onSuccess?.();
      // Server invalidou as sessões — força logout local também
      setTimeout(() => logout(), 1500);
    },
    onError: (e: Error) => setErro(e.message),
  });

  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setErro(""); };

  if (mutation.isSuccess) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="font-bold text-slate-900 text-lg">Senha alterada!</p>
        <p className="text-slate-500 text-sm text-center">Suas sessões foram encerradas. Faça login novamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <KeyRound className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm">Alterar senha</h3>
          <p className="text-xs text-slate-400">Disponível apenas para logins com email.</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-600 block mb-1">Senha atual</label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            placeholder="Sua senha atual"
            value={form.senhaAtual}
            onChange={e => set("senhaAtual", e.target.value)}
          />
          <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-600 block mb-1">Nova senha</label>
        <input
          type={show ? "text" : "password"}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          placeholder="Mínimo 8 caracteres"
          value={form.novaSenha}
          onChange={e => set("novaSenha", e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-600 block mb-1">Confirmar nova senha</label>
        <input
          type={show ? "text" : "password"}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          placeholder="Repita a nova senha"
          value={form.confirma}
          onChange={e => set("confirma", e.target.value)}
        />
      </div>

      {erro && (
        <p className="flex items-center gap-2 text-sm text-red-600 font-semibold bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {erro}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={!form.senhaAtual || !form.novaSenha || !form.confirma || mutation.isPending}
        className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</> : "Alterar senha"}
      </button>
    </div>
  );
}
