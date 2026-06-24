import { Flame, Thermometer, Snowflake } from "lucide-react";
import { parseBRL } from "@/utils/currency";
import type { Lead } from "./constants";

export function scoreIcon(score: number) {
  if (score >= 70) return <Flame className="w-3.5 h-3.5 text-red-500" />;
  if (score >= 40) return <Thermometer className="w-3.5 h-3.5 text-amber-500" />;
  return <Snowflake className="w-3.5 h-3.5 text-slate-400" />;
}

export function scoreLabel(score: number) {
  if (score >= 70) return { label: "Quente", color: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 40) return { label: "Morno",  color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Frio", color: "bg-slate-100 text-slate-500 border-slate-200" };
}

export function diasDesde(iso?: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function getDias(lead: Lead): number {
  if ((lead.oppDiasSemResposta ?? 0) > 0) return lead.oppDiasSemResposta!;
  return diasDesde(lead.ultimoContato);
}

export function diasBadge(dias: number) {
  if (dias === 0) return { text: "hoje",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (dias === 1) return { text: "ontem", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  if (dias <= 3)  return { text: `${dias}d`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (dias <= 7)  return { text: `${dias}d`, cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { text: `${dias}d`, cls: "bg-red-50 text-red-700 border-red-200" };
}

export function makeWaUrl(whatsapp: string, nome: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = encodeURIComponent(`Olá, *${nome}*! 😊 Aqui é da *Castor Exclusiva*. Podemos continuar?`);
  return `https://wa.me/${num}?text=${msg}`;
}

export function getLeadValue(lead: Lead): number {
  if ((lead.valorNumerico ?? 0) > 0) return lead.valorNumerico!;
  if (lead.valorBrl) return parseBRL(lead.valorBrl);
  return 0;
}

export function origemLabel(o: string): string {
  const map: Record<string, string> = {
    loja: "Loja", chat: "Chat", indicacao: "Indicação",
    instagram: "Instagram", google: "Google", whatsapp_direto: "WhatsApp",
    mapa_sono: "Mapa do Sono", orcamento: "Orçamento", diagnostico: "Diagnóstico",
  };
  return map[o] ?? o;
}
