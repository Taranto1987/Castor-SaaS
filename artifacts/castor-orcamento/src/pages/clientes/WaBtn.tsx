import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { makeWaUrl } from "./helpers";

export function WaBtn({ whatsapp, nome, size = "md" }: { whatsapp: string; nome: string; size?: "sm" | "md" }) {
  return (
    <a
      href={makeWaUrl(whatsapp, nome)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex items-center justify-center rounded-full bg-[#25D366] hover:bg-[#1ebe5a] text-white transition-all active:scale-95 shadow-sm shrink-0",
        size === "sm" ? "w-7 h-7" : "w-9 h-9",
      )}
      title={`WhatsApp — ${nome}`}
    >
      <MessageCircle className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
    </a>
  );
}
