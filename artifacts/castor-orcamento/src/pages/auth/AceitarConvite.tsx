import { useState } from "react";
import { useLocation } from "wouter";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function parseToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

export default function AceitarConvite() {
  const [, navigate] = useLocation();
  const token = parseToken();

  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [mensagem, setMensagem] = useState("");

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">Link inválido</h1>
          <p className="text-slate-500 text-sm">Este link de convite não é válido ou expirou.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) { setMensagem("Senha deve ter pelo menos 8 caracteres."); return; }
    if (senha !== confirma) { setMensagem("As senhas não coincidem."); return; }

    setStatus("loading");
    setMensagem("");
    try {
      const res = await fetch("/api/usuarios/aceitar-convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, novaSenha: senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao definir senha");
      setStatus("ok");
      setMensagem(data.message ?? "Senha definida com sucesso!");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setStatus("error");
      setMensagem(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  if (status === "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">Senha definida!</h1>
          <p className="text-slate-500 text-sm">{mensagem}</p>
          <p className="text-xs text-slate-400">Redirecionando para o login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm">
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
              <KeyRound className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Bem-vindo à Castor!</h1>
            <p className="text-slate-500 text-sm">Defina sua senha para ativar o acesso.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Mínimo 8 caracteres"
                  value={senha}
                  onChange={e => { setSenha(e.target.value); setMensagem(""); }}
                  autoFocus
                />
                <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Confirmar senha</label>
              <input
                type={show ? "text" : "password"}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Repita a senha"
                value={confirma}
                onChange={e => { setConfirma(e.target.value); setMensagem(""); }}
              />
            </div>

            {mensagem && (
              <p className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-3 py-2 ${status === "error" ? "text-red-600 bg-red-50" : "text-amber-700 bg-amber-50"}`}>
                <AlertCircle className="w-4 h-4 shrink-0" /> {mensagem}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading" || !senha || !confirma}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {status === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</> : "Definir senha e entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
