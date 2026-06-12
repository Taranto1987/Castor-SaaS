import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, RefreshCw, ShieldOff, ShieldCheck,
  X, Copy, CheckCircle2, AlertCircle, Clock, Link2, KeyRound, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  lojaId: number;
  operacao: string;
  ativo: boolean;
  ultimoLogin: string | null;
  criadoEm: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARGO_LABEL: Record<string, string> = {
  ADMIN:      "Admin",
  GERENTE:    "Gerente",
  VENDEDOR:   "Vendedor",
  FINANCEIRO: "Financeiro",
  ENTREGA:    "Entrega",
};

const CARGO_COLOR: Record<string, string> = {
  ADMIN:      "bg-violet-100 text-violet-700 border-violet-200",
  GERENTE:    "bg-indigo-100 text-indigo-700 border-indigo-200",
  VENDEDOR:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  FINANCEIRO: "bg-blue-100 text-blue-700 border-blue-200",
  ENTREGA:    "bg-orange-100 text-orange-700 border-orange-200",
};

const OPERACAO_LABEL: Record<string, string> = {
  cabo_frio: "Cabo Frio",
  araruama:  "Araruama",
};

function relativeDate(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2)  return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `há ${days} dia${days > 1 ? "s" : ""}` :
    new Date(iso).toLocaleDateString("pt-BR");
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── Invite result display ────────────────────────────────────────────────────

function ConviteResult({ link, onClose }: { link: string; onClose: () => void }) {
  const { copied, copy } = useCopy();
  const fullLink = `${window.location.origin}${link}`;
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Usuário criado!</h2>
          <p className="text-xs text-slate-400">Compartilhe o link de convite com o funcionário.</p>
        </div>
      </div>
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
        <p className="text-xs text-slate-500 mb-2 font-semibold">Link de convite (expira em 72h)</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-slate-700 break-all">{fullLink}</code>
          <button
            onClick={() => copy(fullLink)}
            className="shrink-0 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-all"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        O funcionário acessará este link para definir sua própria senha.
      </p>
      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-all"
      >
        Fechar
      </button>
    </div>
  );
}

// ─── Create user modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, token }: { onClose: () => void; token: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: "", email: "", cargo: "VENDEDOR", operacao: "cabo_frio", wa: "",
  });
  const [conviteLink, setConviteLink] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar usuário");
      return data as { usuario: Usuario; convite: { link: string } };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setConviteLink(data.convite.link);
    },
    onError: (e: Error) => setErro(e.message),
  });

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErro(""); };

  if (conviteLink) return <ModalWrapper onClose={onClose}><ConviteResult link={conviteLink} onClose={onClose} /></ModalWrapper>;

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Novo funcionário</h2>
              <p className="text-xs text-slate-400">Um convite será gerado para ele definir a senha.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Nome completo</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ex: Marcela Taranto"
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="marcela@castor.com.br"
              value={form.email}
              onChange={e => set("email", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Cargo</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                value={form.cargo}
                onChange={e => set("cargo", e.target.value)}
              >
                {Object.entries(CARGO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Loja</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                value={form.operacao}
                onChange={e => set("operacao", e.target.value)}
              >
                <option value="cabo_frio">Cabo Frio</option>
                <option value="araruama">Araruama</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              WhatsApp <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="(22) 99999-9999"
              value={form.wa}
              onChange={e => set("wa", e.target.value)}
            />
          </div>
        </div>

        {erro && (
          <p className="flex items-center gap-2 text-sm text-red-600 font-semibold bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {erro}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.nome.trim() || !form.email.trim() || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            {mutation.isPending ? "Criando…" : "Criar e gerar convite"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Edit email modal ─────────────────────────────────────────────────────────

function EmailModal({ usuario, onClose, token }: { usuario: Usuario; onClose: () => void; token: string }) {
  const qc = useQueryClient();
  const [novoEmail, setNovoEmail] = useState(usuario.email);
  const [erro, setErro] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/usuarios/${usuario.id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ email: novoEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios"] }); onClose(); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Editar email</h2>
              <p className="text-xs text-slate-400">{usuario.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Novo email de acesso</label>
          <input
            type="email"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={novoEmail}
            onChange={e => { setNovoEmail(e.target.value); setErro(""); }}
            autoFocus
          />
          <p className="text-xs text-slate-400 mt-1">Este é o email que o funcionário usa para entrar no sistema.</p>
        </div>
        {erro && <p className="text-sm text-red-600 font-semibold bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!novoEmail.trim() || novoEmail === usuario.email || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {mutation.isPending ? "Salvando…" : "Salvar email"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Change cargo modal ───────────────────────────────────────────────────────

function CargoModal({ usuario, onClose, token }: { usuario: Usuario; onClose: () => void; token: string }) {
  const qc = useQueryClient();
  const [cargo, setCargo] = useState(usuario.cargo);
  const [erro, setErro] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/usuarios/${usuario.id}/cargo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ cargo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios"] }); onClose(); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Alterar cargo</h2>
              <p className="text-xs text-slate-400">{usuario.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <select
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
          value={cargo}
          onChange={e => setCargo(e.target.value)}
        >
          {Object.entries(CARGO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {erro && <p className="text-sm text-red-600 font-semibold bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={cargo === usuario.cargo || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            {mutation.isPending ? "Salvando…" : "Salvar cargo"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── User card ────────────────────────────────────────────────────────────────

function UserCard({
  u, token,
  onCargo,
  onEmail,
}: { u: Usuario; token: string; onCargo: (u: Usuario) => void; onEmail: (u: Usuario) => void }) {
  const qc = useQueryClient();
  const { copied, copy } = useCopy();
  const [confirmDesativar, setConfirmDesativar] = useState(false);

  const toggleAtivo = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/usuarios/${u.id}/ativo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usuarios"] }); setConfirmDesativar(false); },
  });

  const gerarConvite = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/usuarios/${u.id}/convite`, {
        method: "POST",
        headers: { "x-session-token": token },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<{ link: string }>;
    },
    onSuccess: (data) => copy(`${window.location.origin}${data.link}`),
  });

  const gerarReset = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/usuarios/${u.id}/redefinir-senha`, {
        method: "POST",
        headers: { "x-session-token": token },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<{ link: string }>;
    },
    onSuccess: (data) => copy(`${window.location.origin}${data.link}`),
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white border rounded-2xl p-4 shadow-sm transition-all",
        u.ativo ? "border-slate-200" : "border-slate-100 opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center text-base font-black shrink-0",
            u.ativo ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-400"
          )}>
            {u.nome.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("font-bold text-sm", u.ativo ? "text-slate-900" : "text-slate-400")}>
                {u.nome}
              </p>
              {!u.ativo && (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full border border-slate-200">Desativado</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded-full border", CARGO_COLOR[u.cargo] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                {CARGO_LABEL[u.cargo] ?? u.cargo}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {OPERACAO_LABEL[u.operacao] ?? u.operacao}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEmail(u)}
            title="Editar email"
            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            onClick={() => onCargo(u)}
            title="Alterar cargo"
            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
          <button
            onClick={() => gerarReset.mutate()}
            title={copied ? "Link copiado!" : "Gerar link de reset de senha"}
            disabled={gerarReset.isPending}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
          >
            {copied && gerarReset.isSuccess
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <KeyRound className="w-4 h-4" />}
          </button>
          <button
            onClick={() => gerarConvite.mutate()}
            title={copied && gerarConvite.isSuccess ? "Link copiado!" : "Reenviar convite"}
            disabled={gerarConvite.isPending}
            className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
          >
            {copied && gerarConvite.isSuccess
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <Link2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => u.ativo ? setConfirmDesativar(true) : toggleAtivo.mutate()}
            title={u.ativo ? "Desativar" : "Reativar"}
            disabled={toggleAtivo.isPending}
            className={cn(
              "p-2 rounded-lg transition-all",
              u.ativo ? "text-slate-400 hover:text-red-600 hover:bg-red-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
            )}
          >
            {u.ativo ? <ShieldOff className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
        <span className="text-[11px] text-slate-400">
          {u.ultimoLogin
            ? <>Último login: <span className="font-semibold text-slate-500">{relativeDate(u.ultimoLogin)}</span></>
            : "Nunca fez login"}
        </span>
      </div>

      <AnimatePresence>
        {confirmDesativar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-red-100 space-y-2">
              <p className="text-xs text-red-700 font-semibold">
                Desativar <strong>{u.nome}</strong>? As sessões ativas serão encerradas.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDesativar(false)} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
                <button
                  onClick={() => toggleAtivo.mutate()}
                  disabled={toggleAtivo.isPending}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-all"
                >
                  Desativar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Usuarios() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? "";

  const [showCreate, setShowCreate] = useState(false);
  const [cargoModal, setCargoModal] = useState<Usuario | null>(null);
  const [emailModal, setEmailModal] = useState<Usuario | null>(null);

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios", { headers: { "x-session-token": token } });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 60_000,
  });

  const ativos   = usuarios.filter(u => u.ativo);
  const inativos = usuarios.filter(u => !u.ativo);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight">Usuários</h1>
          <p className="text-slate-500 mt-1 text-sm">Gerencie a equipe e permissões de acesso.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" /> Novo funcionário
        </button>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: usuarios.length, color: "text-slate-700" },
            { label: "Ativos", value: ativos.length, color: "text-emerald-600" },
            { label: "Inativos", value: inativos.length, color: "text-slate-400" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
              <p className={cn("text-2xl font-extrabold", s.color)}>{s.value}</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <Users className="w-6 h-6 animate-pulse" />
          <span className="font-medium">Carregando…</span>
        </div>
      ) : (
        <>
          {ativos.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Ativos ({ativos.length})
              </h2>
              {ativos.map(u => <UserCard key={u.id} u={u} token={token} onCargo={setCargoModal} onEmail={setEmailModal} />)}
            </div>
          )}
          {inativos.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-2">
                <ShieldOff className="w-3.5 h-3.5" /> Inativos ({inativos.length})
              </h2>
              {inativos.map(u => <UserCard key={u.id} u={u} token={token} onCargo={setCargoModal} onEmail={setEmailModal} />)}
            </div>
          )}
          {usuarios.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Nenhum usuário encontrado.</p>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} token={token} />}
        {cargoModal && <CargoModal usuario={cargoModal} onClose={() => setCargoModal(null)} token={token} />}
        {emailModal && <EmailModal usuario={emailModal} onClose={() => setEmailModal(null)} token={token} />}
      </AnimatePresence>
    </div>
  );
}
