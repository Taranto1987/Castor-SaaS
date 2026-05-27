import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { orcamentosTable } from "./orcamentos";

export const followUpsTable = pgTable("follow_ups", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
  orcamentoId: integer("orcamento_id").notNull().references(() => orcamentosTable.id),
  tipo: text("tipo").notNull(), // "dia3" | "dia7" | "dia14"
  mensagem: text("mensagem").notNull(),
  waLink: text("wa_link"),
  geradoEm: timestamp("gerado_em").defaultNow().notNull(),
  executadoEm: timestamp("executado_em"),
}, (t) => [
  index("follow_ups_orcamento_tipo_idx").on(t.orcamentoId, t.tipo),
  index("follow_ups_pendentes_idx").on(t.executadoEm).where(sql`${t.executadoEm} IS NULL`),
]);

export type FollowUp = typeof followUpsTable.$inferSelect;
