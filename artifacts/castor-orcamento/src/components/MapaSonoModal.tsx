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
            className="relative z-10 w-full max-w-[420px] max-h-[88vh] bg-white rounded-3xl shadow-2xl flex flex-col outline-none overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header fixo */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src="/thalles-avatar.jpg"
                    alt="Especialista"
                    className="w-9 h-9 rounded-full object-cover object-top border-2 border-red-100"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 leading-tight">Mapa do Sono · Castor</p>
                  <p className="text-[10px] text-green-600 font-bold">● Online agora · Diagnóstico gratuito</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 transition-all active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              <MapaSono embedded />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
