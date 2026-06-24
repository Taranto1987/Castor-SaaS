import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import MapaSono from "@/pages/MapaSono";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MapaSonoModal({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-label="Mapa do Sono"
        >
          {/* Backdrop — clique fecha */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Painel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="relative z-10 w-full max-w-[420px] max-h-[88vh] rounded-3xl shadow-2xl flex flex-col outline-none overflow-hidden"
            style={{ background: "#0d0d0d" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header fixo — dark theme */}
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(13,13,13,0.95)" }}>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src="/thalles-avatar.webp"
                    alt="Especialista"
                    className="w-9 h-9 rounded-full object-cover object-top"
                    style={{ border: "2px solid rgba(230,51,41,0.3)" }}
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full" style={{ border: "2px solid #0d0d0d" }} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white leading-tight">Mapa do Sono · Castor</p>
                  <p className="text-[10px] text-green-400 font-bold">● Online agora · Diagnóstico gratuito</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
              <MapaSono embedded />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
