import { pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const orcamentosTable = pgTable("orcamentos", {
  id: serial("id").primaryKey(),
  cliente: text("cliente").notNull(),
  whatsapp: text("whatsapp"),
  produtosJson: jsonb("produtos_json").notNull(),
  observacoes: text("observacoes"),
  descontoPix: integer("desconto_pix").default(0),
  totalPix: text("total_pix"),
  totalPrazo: text("total_prazo"),
  texto: text("texto").notNull(),
  vendedor: text("vendedor"),
  status: text("status").notNull().default("pendente"),
  // Auditoria de precificação hierárquica
  precoBaseTotal: text("preco_base_total"),   // soma dos preços cheios (formatted BRL)
  descontoAplicado: text("desconto_aplicado"), // valor total descontado (formatted BRL)
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type Orcamento = typeof orcamentosTable.$inferSelect;
