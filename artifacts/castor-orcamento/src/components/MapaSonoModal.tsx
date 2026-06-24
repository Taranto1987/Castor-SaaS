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
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Painel — sem header, só conteúdo + botão fechar flutuante */}
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
            {/* Botão fechar flutuante */}
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", backdropFilter: "blur(12px)" }}
            >
              <X className="w-4 h-4" />
            </button>

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
