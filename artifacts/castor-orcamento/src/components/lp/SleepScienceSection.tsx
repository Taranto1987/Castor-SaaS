import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface SleepScienceSectionProps {
  imageSrc?: string;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING = { type: "spring" as const, stiffness: 400, damping: 22 };

const LABELS = [
  { id: 1, text: "regenera a pele",              side: "left"  as const, top: 30 },
  { id: 2, text: "libera hormônios",              side: "right" as const, top: 27 },
  { id: 3, text: "elimina toxinas",               side: "left"  as const, top: 50 },
  { id: 4, text: "regula o sistema\nimunológico", side: "right" as const, top: 55 },
  { id: 5, text: "constrói músculos",             side: "left"  as const, top: 70 },
  { id: 6, text: "fortalece a memória",           side: "right" as const, top: 76 },
];

export default function SleepScienceSection({ imageSrc }: SleepScienceSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="relative bg-[#0a0305] overflow-hidden"
      aria-label="O que acontece enquanto você dorme"
    >
      <div className="relative w-full" style={{ aspectRatio: "3/4" }}>

        {/* ── Background photo ───────────────────────────────────────────── */}
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            role="presentation"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0810] via-[#0d0308] to-[#150209]" />
        )}

        {/* ── Cinematic overlay ──────────────────────────────────────────── */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <motion.div
          className="absolute top-0 inset-x-0 pt-10 text-center px-6 z-10"
          initial={{ opacity: 0, y: -18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.3em] mb-3">
            A ciência do sono
          </p>
          <h2 className="text-white text-3xl sm:text-5xl font-extralight leading-[1.1] tracking-tight">
            Enquanto você{" "}
            <em className="font-black not-italic">dorme,</em>
            <br />
            o seu corpo…
          </h2>
        </motion.div>

        {/* ── Animated labels ───────────────────────────────────────────── */}
        {LABELS.map((label, i) => {
          const isLeft = label.side === "left";
          const delay = 0.45 + i * 0.22;

          return (
            <div
              key={label.id}
              className="absolute z-10"
              style={{
                top: `${label.top}%`,
                ...(isLeft ? { left: "5%" } : { right: "5%" }),
              }}
            >
              <motion.div
                className={`flex items-center gap-2 ${isLeft ? "flex-row" : "flex-row-reverse"}`}
                initial={{ opacity: 0, x: isLeft ? -28 : 28 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay, ease: EASE }}
              >
                {/* dot */}
                <motion.span
                  className="block w-2 h-2 rounded-full bg-white flex-shrink-0"
                  initial={{ scale: 0 }}
                  animate={inView ? { scale: 1 } : {}}
                  transition={{ ...SPRING, delay: delay + 0.25 }}
                />

                {/* horizontal tick line */}
                <motion.span
                  className="block h-px bg-white/50 flex-shrink-0"
                  style={{
                    width: 20,
                    transformOrigin: isLeft ? "left center" : "right center",
                  }}
                  initial={{ scaleX: 0 }}
                  animate={inView ? { scaleX: 1 } : {}}
                  transition={{ duration: 0.25, delay: delay + 0.15 }}
                />

                {/* label text */}
                <span
                  className={`text-white text-xs sm:text-sm font-light leading-tight whitespace-pre-line ${isLeft ? "text-left" : "text-right"}`}
                >
                  {label.text}
                </span>
              </motion.div>
            </div>
          );
        })}

        {/* ── Bottom payoff line ────────────────────────────────────────── */}
        <motion.p
          className="absolute bottom-7 inset-x-0 text-center text-white/45 text-[11px] uppercase tracking-[0.22em] font-light z-10 px-4"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.45 + LABELS.length * 0.22 + 0.3 }}
        >
          O colchão certo potencializa cada um desses processos
        </motion.p>
      </div>
    </section>
  );
}
