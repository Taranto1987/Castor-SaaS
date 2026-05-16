import { useState, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, LogIn, Mail, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();

  // Modo: "email" (novo) | "codigo" (legado)
  const [modo, setModo] = useState<"email" | "codigo">("email");

  // Email+senha
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  // Código legado
  const [codigo, setCodigo] = useState("");

  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleEntrar() {
    setErro("");
    if (modo === "email") {
      if (!email.trim() || !senha.trim()) return;
    } else {
      if (!codigo.trim()) return;
    }
    setCarregando(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    const ok = await login(modo === "email" ? { email, senha } : { code: codigo });
    setCarregando(false);
    if (!ok) {
      setErro(modo === "email" ? "Email ou senha inválidos." : "Código inválido. Tente novamente.");
      if (modo === "codigo") setCodigo("");
      inputRef.current?.focus();
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleEntrar();
    if (erro) setErro("");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center mb-10"
      >
        <div className="bg-white rounded-2xl p-4 shadow-2xl mb-5">
          <img
            src="/logo-castor.webp"
            alt="Castor"
            className="h-14 w-auto object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <p className="text-white/50 text-xs font-semibold tracking-[0.2em] uppercase">
          Sistema de Gestão Interno
        </p>
        <h1 className="text-white text-2xl font-black mt-1 tracking-tight">Castor Cabo Frio</h1>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-sm bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-500/20 rounded-xl p-2.5">
            <Lock className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Acesso Restrito</p>
            <p className="text-white/40 text-xs">Apenas equipe autorizada</p>
          </div>
        </div>

        {/* Toggle modo */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 mb-5">
          <button
            onClick={() => { setModo("email"); setErro(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all ${
              modo === "email" ? "bg-red-600 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email + Senha
          </button>
          <button
            onClick={() => { setModo("codigo"); setErro(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all ${
              modo === "codigo" ? "bg-red-600 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> Código
          </button>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {modo === "email" ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3"
              >
                <div>
                  <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">
                    Email
                  </label>
                  <input
                    ref={inputRef}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErro(""); }}
                    onKeyDown={handleKey}
                    placeholder="seu@email.com"
                    autoFocus
                    className="w-full bg-white/10 border border-white/20 focus:border-red-400 focus:bg-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-semibold focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={mostrar ? "text" : "password"}
                      value={senha}
                      onChange={e => { setSenha(e.target.value); setErro(""); }}
                      onKeyDown={handleKey}
                      placeholder="Sua senha"
                      className="w-full bg-white/10 border border-white/20 focus:border-red-400 focus:bg-white/15 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 text-sm font-semibold focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrar(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="codigo"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-1.5">
                  Código de acesso
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={mostrar ? "text" : "password"}
                    value={codigo}
                    onChange={e => { setCodigo(e.target.value.toUpperCase()); setErro(""); }}
                    onKeyDown={handleKey}
                    placeholder="Digite seu código"
                    autoFocus
                    className="w-full bg-white/10 border border-white/20 focus:border-red-400 focus:bg-white/15 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 text-base font-semibold tracking-widest focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {erro && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-xs font-semibold"
              >
                ❌ {erro}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleEntrar}
            disabled={carregando || (modo === "email" ? !email.trim() || !senha.trim() : !codigo.trim())}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all text-base shadow-lg shadow-red-900/40 mt-1"
          >
            {carregando ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <><LogIn className="w-4 h-4" /> Entrar no sistema</>
            )}
          </motion.button>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 text-white/20 text-xs text-center"
      >
        🔒 Sistema privado · Castor Cabo Frio · Av. Júlia Kubitschek, 64
      </motion.p>
    </div>
  );
}
