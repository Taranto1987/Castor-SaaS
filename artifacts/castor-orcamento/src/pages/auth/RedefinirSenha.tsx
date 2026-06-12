import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";

function parseToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

export default function RedefinirSenha() {
  const [, navigate] = useLocation();
  const token = parseToken();

  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [mensagem, setMensagem] = useState("");
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/reset-info?token=${token}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { email: string } | null) => { if (data?.email) setEmailUsuario(data.email); })
      .catch(() => {});
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">Link inválido</h1>
          <p className="text-slate-500 text-sm">Este link de redefinição não é válido ou expirou.</p>
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
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, novaSenha: senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao redefinir senha");
      if (data.email) setEmailUsuario(data.email);
      setStatus("ok");
      setMensagem(data.message ?? "Senha redefinida com sucesso!");
      const emailParam = data.email ? `?email=${encodeURIComponent(data.email)}` : "";
      setTimeout(() => navigate(`/login${emailParam}`), 4000);
    } catch (err) {
      setStatus("error");
      setMensagem(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  if (status === "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">Senha redefinida!</h1>
          {emailUsuario && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Seu email de acesso</p>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <p className="text-sm font-bold text-slate-800 break-all">{emailUsuario}</p>
              </div>
              <p className="text-xs text-slate-400">Use este email para entrar no sistema.</p>
            </div>
          )}
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
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
              <KeyRound className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Redefinir senha</h1>
            <p className="text-slate-500 text-sm">Escolha uma nova senha segura.</p>
          </div>

          {emailUsuario && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold">Conta</p>
                <p className="text-sm font-bold text-slate-700 truncate">{emailUsuario}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  placeholder="Mínimo 8 caracteres"
                  value={senha}
                  onChange={e => { setSenha(e.target.value); setMensagem(""); }}
                  autoFocus
                />
                <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Confirmar senha</label>
              <input
                type={show ? "text" : "password"}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {status === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</> : "Redefinir senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
