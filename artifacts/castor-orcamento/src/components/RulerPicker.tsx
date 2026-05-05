import { useLayoutEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ITEM_W = 18;

interface RulerPickerProps {
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}

export default function RulerPicker({
  min,
  max,
  step,
  unit,
  value,
  onChange,
}: RulerPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(value);
  const count = Math.round((max - min) / step) + 1;

  // Correct formula: spacer = clientWidth/2, so scrollLeft = i * ITEM_W + ITEM_W/2
  const scrollToIndex = useCallback((i: number, smooth = false) => {
    const el = containerRef.current;
    if (!el) return;
    const target = i * ITEM_W + ITEM_W / 2;
    if (smooth) el.scrollTo({ left: target, behavior: "smooth" });
    else el.scrollLeft = target;
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!el || !left || !right) return;
    const half = el.clientWidth / 2;
    left.style.minWidth = `${half}px`;
    right.style.minWidth = `${half}px`;
    const i = Math.round((value - min) / step);
    el.scrollLeft = i * ITEM_W + ITEM_W / 2;
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // Inverse of scrollLeft = i * ITEM_W + ITEM_W/2
    const i = Math.max(
      0,
      Math.min(count - 1, Math.round((el.scrollLeft - ITEM_W / 2) / ITEM_W))
    );
    const v = Number((min + i * step).toFixed(4));
    setDisplay(v);
    onChange(v);
  }, [min, step, count, onChange]);

  const stepBy = (delta: number) => {
    const el = containerRef.current;
    if (!el) return;
    const i = Math.round((el.scrollLeft - ITEM_W / 2) / ITEM_W);
    const next = Math.max(0, Math.min(count - 1, i + delta));
    scrollToIndex(next, true);
    const v = Number((min + next * step).toFixed(4));
    setDisplay(v);
    onChange(v);
  };

  const fmt = (v: number) =>
    unit === "m" ? v.toFixed(2).replace(".", ",") : String(Math.round(v));

  return (
    <div className="relative w-full select-none">
      {/* Value display + arrows */}
      <div className="flex items-center justify-center gap-8 mb-5">
        <button
          onClick={() => stepBy(-1)}
          className="text-white/30 hover:text-white/70 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <span className="text-4xl font-black text-white tabular-nums">
          {fmt(display)}{" "}
          <span className="text-xl font-bold text-white/50">{unit}</span>
        </span>
        <button
          onClick={() => stepBy(1)}
          className="text-white/30 hover:text-white/70 active:scale-95 transition-all"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>

      {/* Ruler area */}
      <div className="relative" style={{ height: 90 }}>
        {/* Red center indicator */}
        <div
          className="absolute top-0 z-20 pointer-events-none rounded-full"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            width: 2,
            height: 56,
            background: "#ff0000",
          }}
        />

        {/* Fade edges */}
        <div
          className="absolute inset-y-0 left-0 z-10 pointer-events-none"
          style={{
            width: "28%",
            background: "linear-gradient(to right, #0d0d0d 40%, transparent)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 z-10 pointer-events-none"
          style={{
            width: "28%",
            background: "linear-gradient(to left, #0d0d0d 40%, transparent)",
          }}
        />

        {/* Scrollable ruler */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex absolute inset-0"
          style={{
            alignItems: "flex-start",
            paddingTop: 12,
            overflowX: "scroll",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            overscrollBehaviorX: "contain",
          }}
        >
          <div ref={leftRef} style={{ flexShrink: 0, height: 1 }} />

          {Array.from({ length: count }, (_, i) => {
            const isMajor = i % 10 === 0;
            const isMedium = !isMajor && i % 5 === 0;
            const v = Number((min + i * step).toFixed(4));
            const label =
              unit === "m"
                ? v.toFixed(2).replace(".", ",")
                : String(Math.round(v));
            return (
              <div
                key={i}
                style={{
                  width: ITEM_W,
                  flexShrink: 0,
                  scrollSnapAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: isMajor ? 2 : 1.5,
                    height: isMajor ? 38 : isMedium ? 24 : 14,
                    background: isMajor
                      ? "rgba(255,255,255,0.75)"
                      : isMedium
                      ? "rgba(255,255,255,0.4)"
                      : "rgba(255,255,255,0.18)",
                    borderRadius: 2,
                  }}
                />
                {isMajor && (
                  <span
                    style={{
                      position: "absolute",
                      top: 44,
                      fontSize: 9,
                      color: "rgba(255,255,255,0.35)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      userSelect: "none",
                    }}
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}

          <div ref={rightRef} style={{ flexShrink: 0, height: 1 }} />
        </div>
      </div>
    </div>
  );
}
