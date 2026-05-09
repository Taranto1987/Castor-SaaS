import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
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
});

export type FollowUp = typeof followUpsTable.$inferSelect;
