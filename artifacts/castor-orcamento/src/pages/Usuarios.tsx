import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, KeyRound, ShieldOff, ShieldCheck,
  X, Eye, EyeOff, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Usuario {
  id: number;
  codigo: string;
  nome: string;
  papel: string;
  operacao: string;
  wa: string | null;
  ativo: boolean;
  ultimoAcesso: string | null;
  criadoEm: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAPEL_LABEL: Record<string, string> = {
  dono:       "Dono",
  vendedor:   "Vendedor",
  entrega:    "Entrega",
  financeiro: "Financeiro",
};

const PAPEL_COLOR: Record<string, string> = {
  dono:       "bg-violet-100 text-violet-700 border-violet-200",
  vendedor:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  entrega:    "bg-orange-100 text-orange-700 border-orange-200",
  financeiro: "bg-blue-100 text-blue-700 border-blue-200",
};

const OPERACAO_LABEL: Record<string, string> = {
  cabo_frio: "Cabo Frio",
  araruama:  "Araruama",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function relativeDate(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2)   return "agora mesmo";
  if (mins < 60)  return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `há ${days} dia${days > 1 ? "s" : ""}`;
  return formatDate(iso);
}

// ─── Modals ──────────────────────────────────────────────────────────────────

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

function CreateUserModal({ onClose, token }: { onClose: () => void; token: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: "",
    codigo: "",
    papel: "vendedor",
    operacao: "cabo_frio",
    wa: "",
  });
  const [showCodigo, setShowCodigo] = useState(false);
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
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      onClose();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErro(""); };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Novo usuário</h2>
              <p className="text-xs text-slate-400">Preencha os dados de acesso</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Nome */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Nome de exibição</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ex: Marcela Taranto"
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              autoFocus
            />
          </div>

          {/* Código (senha) */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">
              Código de acesso <span className="font-normal text-slate-400">(a senha que o usuário vai digitar)</span>
            </label>
            <div className="relative">
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30 tracking-widest"
                placeholder="Ex: MARCELA2025"
                type={showCodigo ? "text" : "password"}
                value={form.codigo}
                onChange={e => set("codigo", e.target.value.toUpperCase())}
              />
              <button
                type="button"
                onClick={() => setShowCodigo(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCodigo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Papel + Operação */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Papel</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                value={form.papel}
                onChange={e => set("papel", e.target.value)}
              >
                <option value="vendedor">Vendedor</option>
                <option value="entrega">Entrega</option>
                <option value="financeiro">Financeiro</option>
                <option value="dono">Dono</option>
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

          {/* WhatsApp (opcional) */}
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
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.nome.trim() || !form.codigo.trim() || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {mutation.isPending ? "Criando…" : "Criar usuário"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

function TrocaSenhaModal({ usuario, onClose, token }: { usuario: Usuario; onClose: () => void; token: string }) {
  const qc = useQueryClient();
  const [novoCodigo, setNovoCodigo] = useState("");
  const [show, setShow] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/usuarios/${usuario.id}/senha`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ novoCodigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao trocar código");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setOk(true);
      setTimeout(onClose, 1200);
    },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Trocar código</h2>
              <p className="text-xs text-slate-400">{usuario.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {ok ? (
          <div className="flex items-center justify-center gap-2 py-6 text-emerald-600 font-bold">
            <CheckCircle2 className="w-6 h-6" /> Código atualizado!
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Novo código de acesso</label>
              <div className="relative">
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/30 tracking-widest"
                  placeholder="Mínimo 3 caracteres"
                  type={show ? "text" : "password"}
                  value={novoCodigo}
                  onChange={e => { setNovoCodigo(e.target.value.toUpperCase()); setErro(""); }}
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && mutation.mutate()}
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {erro && (
              <p className="flex items-center gap-2 text-sm text-red-600 font-semibold bg-red-50 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {erro}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={novoCodigo.trim().length < 3 || mutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {mutation.isPending ? "Salvando…" : "Salvar código"}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalWrapper>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({
  u,
  token,
  onTrocaSenha,
}: {
  u: Usuario;
  token: string;
  onTrocaSenha: (u: Usuario) => void;
}) {
  const qc = useQueryClient();
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setConfirmDesativar(false);
    },
  });

  const rel = relativeDate(u.ultimoAcesso);

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
        {/* Avatar + info */}
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
                <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full border border-slate-200">
                  Desativado
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={cn(
                "text-[11px] font-bold px-1.5 py-0.5 rounded-full border",
                PAPEL_COLOR[u.papel] ?? "bg-slate-100 text-slate-600 border-slate-200"
              )}>
                {PAPEL_LABEL[u.papel] ?? u.papel}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {OPERACAO_LABEL[u.operacao] ?? u.operacao}
              </span>
              {u.wa && (
                <span className="text-[11px] text-slate-400">{u.wa}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onTrocaSenha(u)}
            title="Trocar código de acesso"
            className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => u.ativo ? setConfirmDesativar(true) : toggleAtivo.mutate()}
            title={u.ativo ? "Desativar acesso" : "Reativar acesso"}
            disabled={toggleAtivo.isPending}
            className={cn(
              "p-2 rounded-lg transition-all",
              u.ativo
                ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
            )}
          >
            {u.ativo ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Último acesso */}
      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
        <span className="text-[11px] text-slate-400">
          {u.ultimoAcesso
            ? <>Último acesso: <span className="font-semibold text-slate-500">{rel}</span></>
            : "Nunca acessou"}
        </span>
      </div>

      {/* Confirm desativar */}
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
                Desativar <strong>{u.nome}</strong>? O histórico de orçamentos é mantido.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDesativar(false)}
                  className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancelar
                </button>
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
  const [trocaSenha, setTrocaSenha] = useState<Usuario | null>(null);

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios", {
        headers: { "x-session-token": token },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    staleTime: 60_000,
  });

  const ativos   = usuarios.filter(u => u.ativo);
  const inativos = usuarios.filter(u => !u.ativo);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight">
            Usuários
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gerencie o acesso da equipe ao sistema.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Novo usuário
        </button>
      </div>

      {/* Stats bar */}
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
          <span className="font-medium">Carregando usuários…</span>
        </div>
      ) : (
        <>
          {/* Ativos */}
          {ativos.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Ativos ({ativos.length})
              </h2>
              {ativos.map(u => (
                <UserCard key={u.id} u={u} token={token} onTrocaSenha={setTrocaSenha} />
              ))}
            </div>
          )}

          {/* Inativos */}
          {inativos.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-2">
                <ShieldOff className="w-3.5 h-3.5" />
                Inativos ({inativos.length})
              </h2>
              {inativos.map(u => (
                <UserCard key={u.id} u={u} token={token} onTrocaSenha={setTrocaSenha} />
              ))}
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
        {showCreate && (
          <CreateUserModal onClose={() => setShowCreate(false)} token={token} />
        )}
        {trocaSenha && (
          <TrocaSenhaModal
            usuario={trocaSenha}
            onClose={() => setTrocaSenha(null)}
            token={token}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
