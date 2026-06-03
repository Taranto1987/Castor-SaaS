import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { orcamentosTable } from "./orcamentos";
import { isNull } from "drizzle-orm";

export const followUpsTable = pgTable("follow_ups", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
  orcamentoId: integer("orcamento_id").notNull().references(() => orcamentosTable.id),
  tipo: text("tipo").notNull(), // cadência COCA: FOLLOWUP_D2 | FOLLOWUP_D5 | FOLLOWUP_D10 | REATIVACAO_D30 | RECUPERACAO_D60
  mensagem: text("mensagem").notNull(),
  waLink: text("wa_link"),
  geradoEm: timestamp("gerado_em").defaultNow().notNull(),
  executadoEm: timestamp("executado_em"),
}, (t) => [
  index("follow_ups_orcamento_tipo_idx").on(t.orcamentoId, t.tipo),
  index("follow_ups_pendentes_idx").on(t.executadoEm).where(isNull(t.executadoEm)),
]);

export type FollowUp = typeof followUpsTable.$inferSelect;
