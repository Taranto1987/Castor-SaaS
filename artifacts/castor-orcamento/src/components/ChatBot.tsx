import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING = "Olá! 👋 Sou o **ThallesZzz**, consultor especialista em colchões Castor. Estou aqui pra te ajudar a encontrar o colchão perfeito pro seu sono.\n\nMe conta: **como anda seu sono?** Tem sentido alguma dor ou desconforto?";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const apiMessages = newMessages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE}api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error("Chat request failed");

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
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: fullContent,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />");
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-4 sm:right-6 z-[60] w-[calc(100vw-2rem)] sm:w-[380px] max-h-[70vh] bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200 flex flex-col overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-700 to-red-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    ThallesZzz
                  </h3>
                  <p className="text-[10px] text-red-200">
                    Consultor Castor · Online agora
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-slate-50">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-red-700" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
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
                    <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-red-700" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3 py-2 shadow-sm">
                      <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                    </div>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-slate-200 bg-white shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  disabled={isStreaming}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="w-10 h-10 bg-red-600 hover:bg-red-500 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center transition-colors shrink-0 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 text-center mt-1.5">
                Assistente IA · Castor Exclusiva Cabo Frio
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowPulse(false);
        }}
        className={`fixed bottom-6 right-[5.5rem] sm:right-52 z-[60] w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-90 ${
          isOpen
            ? "bg-slate-700 hover:bg-slate-600"
            : "bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600"
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <Sparkles className="w-6 h-6 text-white" />
            {showPulse && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </button>

      {!isOpen && showPulse && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="fixed bottom-[4.5rem] right-[10rem] sm:right-[17rem] z-[59] bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg border border-slate-200 whitespace-nowrap"
        >
          Precisa de ajuda? Fale comigo! 💬
        </motion.div>
      )}
    </>
  );
}
