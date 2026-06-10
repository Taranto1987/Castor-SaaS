import { pgTable, serial, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";

export const orcamentosTable = pgTable("orcamentos", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
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
  // Data em que o orçamento foi efetivamente fechado como venda. Usada para
  // atribuição correta no Financeiro — sem isso, vendas fechadas num mês posterior
  // ao da criação do orçamento não aparecem no relatório do mês de fechamento.
  vendidoEm: timestamp("vendido_em"),
  customerId: integer("customer_id"),
  leadId: integer("lead_id"),
}, (t) => [
  index("orcamentos_loja_status_criado_idx").on(t.lojaId, t.status, t.criadoEm),
]);

export type Orcamento = typeof orcamentosTable.$inferSelect;
