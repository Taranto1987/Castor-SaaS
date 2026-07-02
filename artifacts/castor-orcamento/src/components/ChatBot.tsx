import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  MessageCircle, X, Send, User, Loader2, Sparkles,
  Home, HelpCircle, ChevronRight, ChevronLeft, Search, Moon, Tag,
} from "lucide-react";
import { useWAInfo } from "@/hooks/use-wa-info";
import { trackWhatsAppClick } from "@/lib/tracking";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type WidgetView = "home" | "chat" | "ajuda";

const GREETING = "Olá! 👋 Sou o **ThallesZzz**, consultor especialista em colchões Castor. Estou aqui pra te ajudar a encontrar o colchão perfeito pro seu sono.\n\nMe conta: **como anda seu sono?** Tem sentido alguma dor ou desconforto?";

// Bump this constant to invalidate all cached conversations across all users.
// Required after prompt changes that produce incompatible conversation styles.
const CHAT_CACHE_VERSION = "3";

const SUGGESTED_QUESTIONS = [
  "Qual colchão é ideal pra mim?",
  "Tenho dor nas costas, o que vocês recomendam?",
  "Quero ver as ofertas do Outlet 🔥",
];

const HELP_COLLECTIONS = [
  {
    title: "Escolha do colchão",
    items: [
      "Qual colchão é ideal para quem tem dor nas costas?",
      "Qual a diferença entre molas ensacadas e espuma?",
      "Colchão firme ou macio: qual escolher?",
      "O que é densidade D33 e a certificação INER?",
    ],
  },
  {
    title: "Entrega e prazos",
    items: [
      "Qual o prazo de entrega para a Região dos Lagos?",
      "Vocês montam e retiram a embalagem?",
      "Quais cidades vocês atendem?",
    ],
  },
  {
    title: "Pagamento e garantia",
    items: [
      "Quais formas de pagamento vocês aceitam?",
      "Qual a garantia dos colchões Castor?",
      "E se eu não me adaptar ao colchão?",
    ],
  },
  {
    title: "Outlet e ofertas",
    items: [
      "Como funciona o Outlet Castor?",
      "Os produtos do Outlet têm garantia?",
    ],
  },
];

export default function ChatBot({ hideFloating = false }: { hideFloating?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const anonId = localStorage.getItem("cid") ?? "anon";
      const stored = localStorage.getItem(`castor_chat_${anonId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          messages: Message[];
          lastActivity: number;
          v?: string;
        };
        if (
          parsed.v === CHAT_CACHE_VERSION &&
          Date.now() - parsed.lastActivity < 7 * 24 * 60 * 60 * 1000 &&
          parsed.messages.length > 0
        ) {
          return parsed.messages;
        }
      }
    } catch {}
    return [{ role: "assistant", content: GREETING }];
  });
  // Returning visitors with an ongoing conversation land straight in it.
  const [view, setView] = useState<WidgetView>(() => (messages.length > 1 ? "chat" : "home"));
  const [input, setInput] = useState("");
  const [helpQuery, setHelpQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location, navigate] = useLocation();
  const waInfo = useWAInfo();

  // persistent identity across sessions (localStorage) + ephemeral session id (per tab)
  const [anonymousId] = useState<string>(() => {
    let id = localStorage.getItem("cid");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("cid", id); }
    return id;
  });
  const [sessionId] = useState<string>(() => {
    let id = sessionStorage.getItem("castor_session");
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("castor_session", id); }
    return id;
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, view, scrollToBottom]);

  useEffect(() => {
    if (isOpen && view === "chat" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, view]);

  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        `castor_chat_${anonymousId}`,
        JSON.stringify({ messages, lastActivity: Date.now(), v: CHAT_CACHE_VERSION })
      );
    } catch {}
  }, [messages, anonymousId]);

  const goTo = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const sendMessage = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      // Build a properly alternating conversation — if a previous response was empty
      // (failed silently), merging consecutive user messages avoids Anthropic 400 errors.
      const apiMessages: { role: "user" | "assistant"; content: string }[] = [];
      for (const m of newMessages.filter((m) => m.content)) {
        if (
          apiMessages.length > 0 &&
          apiMessages[apiMessages.length - 1].role === "user" &&
          m.role === "user"
        ) {
          apiMessages[apiMessages.length - 1].content += "\n" + m.content;
        } else {
          apiMessages.push({ role: m.role, content: m.content });
        }
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, anonymousId, sessionId }),
      });

      if (response.status === 429) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Opa, muitas mensagens em sequência! Me dá um minutinho e continua de onde paramos 😊",
          };
          return updated;
        });
        return;
      }
      if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader");

      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: fullContent,
                  };
                  return updated;
                });
              }
              if (data.error) {
                fullContent = "Desculpe, tive um problema técnico. Tente novamente ou fale direto no WhatsApp!";
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: fullContent };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }

      // Stream ended with no content — backend crash or silent network drop
      if (!fullContent) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Desculpe, estou com dificuldades técnicas no momento. Fale direto com a gente no WhatsApp! 📱",
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "Desculpe, estou com dificuldades técnicas no momento. Fale direto com a gente no WhatsApp! 📱",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const askQuestion = (question: string) => {
    setView("chat");
    sendMessage(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const rewriteMap: [RegExp, string][] = [
    [/não tenho acesso ao histórico/gi, "Me relembra rapidinho de onde paramos?"],
    [/não tenho memória (desta|dessa|da) conversa/gi, "Me relembra rapidinho de onde paramos?"],
    [/cada sessão começa do zero/gi, "Me relembra rapidinho de onde paramos?"],
    [/não me lembro\b/gi, "Me relembra rapidinho de onde paramos?"],
    [/como você anda (o )?seu sono\b/gi, "Como anda seu sono?"],
    [/posso dizer (o )?seu nome\b/gi, "Como posso te chamar?"],
    [/estivemos conversando/gi, "você estava olhando"],
  ];

  const formatMessage = (text: string) => {
    let normalized = text;
    for (const [pattern, replacement] of rewriteMap) {
      normalized = normalized.replace(pattern, replacement);
    }
    return normalized
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-red-700 underline font-medium hover:text-red-900" target="_self">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />");
  };

  const whatsappHref = `https://wa.me/${waInfo.numero}?text=${encodeURIComponent(`Olá! Vi o site da Castor ${waInfo.loja} e quero saber mais sobre os colchões!`)}`;
  const avatarSrc = waInfo.contato.toLowerCase().includes("marcela")
    ? "/marcela-avatar.webp"
    : "/thalles-avatar.webp";

  const filteredCollections = HELP_COLLECTIONS
    .map((col) => ({
      ...col,
      items: col.items.filter((q) => q.toLowerCase().includes(helpQuery.trim().toLowerCase())),
    }))
    .filter((col) => col.items.length > 0);

  const tabs: { id: WidgetView; label: string; icon: typeof Home }[] = [
    { id: "home", label: "Início", icon: Home },
    { id: "chat", label: "Mensagens", icon: MessageCircle },
    { id: "ajuda", label: "Ajuda", icon: HelpCircle },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 h-[88dvh] rounded-t-3xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:h-[min(44rem,78dvh)] sm:w-[400px] sm:rounded-2xl z-[60] bg-white shadow-2xl shadow-black/25 border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            {view === "home" ? (
              <div className="relative bg-gradient-to-br from-red-700 via-red-600 to-red-700 text-white px-5 pt-5 pb-6 shrink-0">
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar"
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="relative w-11 h-11 mb-3">
                  <img
                    src={avatarSrc}
                    alt={waInfo.contato}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-white/40"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-red-600" />
                </div>
                <h3 className="text-2xl font-black leading-tight">Olá 👋</h3>
                <p className="text-red-100 text-sm mt-1">Como podemos ajudar o seu sono hoje?</p>
              </div>
            ) : view === "chat" ? (
              <div className="bg-gradient-to-r from-red-700 to-red-600 text-white px-3 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setView("home")}
                    aria-label="Voltar"
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="relative w-9 h-9 shrink-0">
                    <img
                      src={avatarSrc}
                      alt={waInfo.contato}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white/40"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-red-600" />
                  </div>
                  <div className="ml-1">
                    <h3 className="font-bold text-sm leading-tight">ThallesZzz</h3>
                    <p className="text-[10px] text-red-200">Consultor Castor · Online agora</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar"
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-red-700 to-red-600 text-white px-4 py-3.5 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-base">Ajuda</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar"
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Body ───────────────────────────────────────────────── */}
            {view === "home" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-50">
                <button
                  onClick={() => setView("chat")}
                  className="w-full flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-red-300 hover:shadow-md transition-all text-left group"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Faça uma pergunta</p>
                    <p className="text-slate-500 text-xs mt-0.5">ThallesZzz, nosso consultor IA, responde na hora</p>
                  </div>
                  <div className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center shrink-0 group-hover:bg-red-500 transition-colors">
                    <Send className="w-4 h-4 text-white" />
                  </div>
                </button>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => askQuestion(q)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {q}
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => goTo("/mapa-sono")}
                    className="flex flex-col items-start gap-2 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-red-300 hover:shadow-md transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Moon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">Mapa do Sono</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Diagnóstico em 2 min</p>
                    </div>
                  </button>
                  <button
                    onClick={() => goTo("/catalogo")}
                    className="flex flex-col items-start gap-2 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-red-300 hover:shadow-md transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                      <Search className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">Catálogo</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Todos os produtos</p>
                    </div>
                  </button>
                  <button
                    onClick={() => goTo("/catalogo?categoria=outlet")}
                    className="flex flex-col items-start gap-2 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-orange-300 hover:shadow-md transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Tag className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">Outlet 🔥</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Preço de fábrica</p>
                    </div>
                  </button>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackWhatsAppClick("chat_widget", waInfo.loja)}
                    className="flex flex-col items-start gap-2 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-green-300 hover:shadow-md transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">WhatsApp</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Falar com {waInfo.contato}</p>
                    </div>
                  </a>
                </div>
              </div>
            )}

            {view === "chat" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-slate-50">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <img
                        src={avatarSrc}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                      />
                    )}
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-red-600 text-white rounded-br-md"
                          : "bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm"
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: formatMessage(msg.content),
                      }}
                    />
                    {msg.role === "user" && (
                      <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
                {isStreaming &&
                  messages[messages.length - 1]?.content === "" && (
                    <div className="flex gap-2 items-center">
                      <img
                        src={avatarSrc}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3 py-2 shadow-sm">
                        <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                      </div>
                    </div>
                  )}
                {messages.length === 1 && !isStreaming && (
                  <div className="flex flex-col items-end gap-2 pt-1">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="max-w-[85%] text-left bg-white border border-red-200 text-red-700 text-[13px] font-medium px-3.5 py-2 rounded-2xl rounded-br-md shadow-sm hover:bg-red-50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {view === "ajuda" && (
              <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50">
                <div className="p-4 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={helpQuery}
                      onChange={(e) => setHelpQuery(e.target.value)}
                      placeholder="Qual é a sua dúvida?"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    />
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-4">
                  {filteredCollections.map((col) => (
                    <div key={col.title}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {col.title}
                      </p>
                      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
                        {col.items.map((q) => (
                          <button
                            key={q}
                            onClick={() => askQuestion(q)}
                            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            {q}
                            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredCollections.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-slate-500 text-sm font-medium">Nenhum resultado encontrado</p>
                      <button
                        onClick={() => askQuestion(helpQuery)}
                        className="mt-3 inline-flex items-center gap-1.5 text-red-600 text-sm font-bold hover:text-red-700"
                      >
                        Perguntar ao consultor IA <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Footer: input no chat, tabs nas demais views ─────────── */}
            {view === "chat" ? (
              <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte qualquer coisa..."
                    disabled={isStreaming}
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 disabled:opacity-50"
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isStreaming}
                    aria-label="Enviar"
                    className="w-10 h-10 bg-red-600 hover:bg-red-500 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center transition-colors shrink-0 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-1.5">
                  Assistente IA · Castor Exclusiva Cabo Frio
                </p>
              </div>
            ) : (
              <div className="shrink-0 border-t border-slate-200 bg-white flex">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setView(id)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                      view === id ? "text-red-600" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setShowPulse(false);
          }}
          aria-label="Abrir chat"
          className={`fixed bottom-[4.5rem] right-4 md:right-6 z-[60] w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 active:scale-90 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 ${
            location.startsWith("/catalogo") ? "md:bottom-24" : "md:bottom-6"
          } ${hideFloating ? "translate-y-20 opacity-0 pointer-events-none" : ""}`}
        >
          <Sparkles className="w-5 h-5 text-white" />
          {showPulse && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </button>
      )}
    </>
  );
}
