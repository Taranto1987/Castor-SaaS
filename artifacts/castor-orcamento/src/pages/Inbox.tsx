import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, UserCheck, Bot, Clock, Phone,
  RefreshCw, ArrowLeft, CheckCheck, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Sempre relativo: /api/* é roteado pelo rewrite do Vercel ao backend canônico.
const API_URL = "";

function getAuthHeaders(): Record<string, string> {
  const raw = sessionStorage.getItem("castor_auth_user");
  if (!raw) return {};
  const user = JSON.parse(raw);
  if (user?.sessionToken) return { "x-session-token": user.sessionToken };
  return {};
}

interface Conversa {
  id: number;
  phone: string;
  nome?: string | null;
  status: "bot" | "aguardando_humano" | "humano" | "resolvido";
  atendente?: string | null;
  ultimaMensagemEm: string;
  naoLidas: number;
  ultimaMensagem?: { body?: string | null; direcao: string; criadoEm: string } | null;
}

interface Mensagem {
  id: number;
  body?: string | null;
  direcao: "inbound" | "outbound";
  tipo: string;
  status: string;
  atendente?: string | null;
  lida: boolean;
  criadoEm: string;
}

function statusBadge(status: Conversa["status"]) {
  const map = {
    bot:              { label: "Bot", color: "bg-blue-100 text-blue-700 border-blue-200" },
    aguardando_humano:{ label: "Aguardando", color: "bg-amber-100 text-amber-700 border-amber-200" },
    humano:           { label: "Humano", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    resolvido:        { label: "Resolvido", color: "bg-slate-100 text-slate-500 border-slate-200" },
  };
  return map[status] ?? map.bot;
}

function formatTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ── Conversation List ─────────────────────────────────────────────────────────

function ConversaItem({
  conversa,
  active,
  onClick,
}: {
  conversa: Conversa;
  active: boolean;
  onClick: () => void;
}) {
  const status = statusBadge(conversa.status);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex gap-3 px-4 py-3.5 text-left transition-colors border-b border-slate-100 dark:border-slate-800",
        active
          ? "bg-blue-50 dark:bg-slate-700"
          : "hover:bg-slate-50 dark:hover:bg-slate-800"
      )}
    >
      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
        <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 justify-between">
          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
            {conversa.nome ?? conversa.phone}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
            {formatTime(conversa.ultimaMensagemEm)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="outline" className={cn("text-[10px] py-0", status.color)}>
            {status.label}
          </Badge>
          {conversa.naoLidas > 0 && (
            <span className="ml-auto bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
              {conversa.naoLidas > 9 ? "9+" : conversa.naoLidas}
            </span>
          )}
        </div>
        {conversa.ultimaMensagem?.body && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
            {conversa.ultimaMensagem.direcao === "outbound" ? "Você: " : ""}
            {conversa.ultimaMensagem.body}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: Mensagem }) {
  const outbound = msg.direcao === "outbound";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex", outbound ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          outbound
            ? "bg-green-500 text-white rounded-br-sm"
            : "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-bl-sm"
        )}
      >
        {msg.body && <p className="leading-relaxed">{msg.body}</p>}
        <div className={cn("flex items-center gap-1 mt-1 justify-end", outbound ? "text-green-200" : "text-slate-400 dark:text-slate-500")}>
          <span className="text-[10px]">{formatTime(msg.criadoEm)}</span>
          {outbound && (
            msg.status === "lido"
              ? <CheckCheck className="w-3 h-3" />
              : <Check className="w-3 h-3" />
          )}
          {outbound && msg.atendente && (
            <span className="text-[9px] ml-1">{msg.atendente}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Inbox() {
  const qc = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [inputMsg, setInputMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // SSE para updates em tempo real
  useEffect(() => {
    const token = JSON.parse(sessionStorage.getItem("castor_auth_user") ?? "{}")?.sessionToken;
    if (!token) return;

    const es = new EventSource(`${API_URL}/api/inbox/stream?token=${token}`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "nova_mensagem") {
          qc.invalidateQueries({ queryKey: ["inbox-conversas"] });
          if (data.phone === selectedPhone) {
            qc.invalidateQueries({ queryKey: ["inbox-mensagens", data.phone] });
          }
        }
        if (data.type === "handoff" || data.type === "devolvido_bot") {
          qc.invalidateQueries({ queryKey: ["inbox-conversas"] });
        }
      } catch {}
    };
    return () => es.close();
  }, [selectedPhone, qc]);

  // Lista de conversas
  const { data: conversasData, isLoading: loadingConversas } = useQuery({
    queryKey: ["inbox-conversas"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/inbox/conversas`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<{ conversas: Conversa[] }>;
    },
    refetchInterval: 15_000,
  });

  // Mensagens da conversa selecionada
  const { data: mensagensData, isLoading: loadingMsgs } = useQuery({
    queryKey: ["inbox-mensagens", selectedPhone],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/inbox/conversas/${encodeURIComponent(selectedPhone!)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<{ conversa: Conversa; mensagens: Mensagem[] }>;
    },
    enabled: !!selectedPhone,
    refetchInterval: false,
  });

  useEffect(() => {
    if (mensagensData?.mensagens) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagensData?.mensagens?.length]);

  const enviar = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/inbox/conversas/${encodeURIComponent(selectedPhone!)}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ texto: inputMsg }),
      });
      if (!res.ok) throw new Error("Erro ao enviar");
      return res.json();
    },
    onSuccess: () => {
      setInputMsg("");
      qc.invalidateQueries({ queryKey: ["inbox-mensagens", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["inbox-conversas"] });
    },
  });

  const assumir = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/inbox/conversas/${encodeURIComponent(selectedPhone!)}/assumir`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox-conversas"] });
      qc.invalidateQueries({ queryKey: ["inbox-mensagens", selectedPhone] });
    },
  });

  const devolver = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/inbox/conversas/${encodeURIComponent(selectedPhone!)}/devolver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox-conversas"] });
      qc.invalidateQueries({ queryKey: ["inbox-mensagens", selectedPhone] });
    },
  });

  const conversas = conversasData?.conversas ?? [];
  const conversa = mensagensData?.conversa;
  const mensagens = mensagensData?.mensagens ?? [];

  const selectConversa = (phone: string) => {
    setSelectedPhone(phone);
    setMobileShowChat(true);
  };

  const totalNaoLidas = conversas.reduce((s, c) => s + c.naoLidas, 0);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col -mx-4 sm:-mx-6 -mt-6 overflow-hidden">
      {/* Page header */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
        <MessageSquare className="w-5 h-5 text-green-500" />
        <h1 className="text-xl font-display font-extrabold text-slate-900 dark:text-slate-100">
          Inbox WhatsApp
        </h1>
        {totalNaoLidas > 0 && (
          <Badge className="bg-green-500 text-white text-xs">{totalNaoLidas}</Badge>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className={cn(
          "w-full md:w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 overflow-hidden",
          mobileShowChat && "hidden md:flex"
        )}>
          <div className="flex-1 overflow-y-auto">
            {loadingConversas ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : conversas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                <MessageSquare className="w-10 h-10 mb-3 text-slate-200 dark:text-slate-700" />
                <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm">Nenhuma conversa ainda</p>
                <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">As mensagens do WhatsApp aparecem aqui.</p>
              </div>
            ) : (
              conversas.map((c) => (
                <ConversaItem
                  key={c.id}
                  conversa={c}
                  active={selectedPhone === c.phone}
                  onClick={() => selectConversa(c.phone)}
                />
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className={cn(
          "flex-1 flex flex-col bg-slate-50 dark:bg-slate-800/50 overflow-hidden",
          !mobileShowChat && "hidden md:flex",
          !selectedPhone && "md:flex items-center justify-center"
        )}>
          {!selectedPhone ? (
            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3">
              <MessageSquare className="w-12 h-12 text-slate-200 dark:text-slate-700" />
              <p className="font-semibold text-slate-500 dark:text-slate-400">Selecione uma conversa</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => { setMobileShowChat(false); setSelectedPhone(null); }}
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                    {conversa?.nome ?? selectedPhone}
                  </p>
                  {conversa && (
                    <Badge variant="outline" className={cn("text-[10px]", statusBadge(conversa.status).color)}>
                      {conversa.status === "humano" ? `${conversa.atendente ?? "Humano"}` : statusBadge(conversa.status).label}
                    </Badge>
                  )}
                </div>
                {/* Handoff buttons */}
                <div className="flex gap-2 shrink-0">
                  {conversa?.status !== "humano" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={assumir.isPending}
                      onClick={() => assumir.mutate()}
                      className="text-xs gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Assumir
                    </Button>
                  )}
                  {conversa?.status === "humano" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={devolver.isPending}
                      onClick={() => devolver.mutate()}
                      className="text-xs gap-1 text-slate-500"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Devolver ao bot
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Carregando...
                  </div>
                ) : mensagens.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 text-sm py-10">
                    Nenhuma mensagem ainda.
                  </p>
                ) : (
                  <>
                    {mensagens.map((m) => <MsgBubble key={m.id} msg={m} />)}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                {conversa?.status !== "humano" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    Bot ativo — assuma o atendimento para responder
                  </p>
                )}
                <form
                  onSubmit={(e) => { e.preventDefault(); if (inputMsg.trim()) enviar.mutate(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder={conversa?.status === "humano" ? "Digite sua mensagem..." : "Assuma o atendimento primeiro"}
                    disabled={conversa?.status !== "humano" || enviar.isPending}
                    className="flex-1 text-sm"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!inputMsg.trim() || conversa?.status !== "humano" || enviar.isPending}
                    className="shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
