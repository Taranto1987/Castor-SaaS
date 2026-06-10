import { pgTable, serial, integer, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const conversasWhatsappTable = pgTable("conversas_whatsapp", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),

  phone: text("phone").notNull(),
  nome: text("nome"),
  leadId: integer("lead_id"),
  customerId: integer("customer_id"),

  status: text("status").notNull().default("bot"),
  // valores: bot | aguardando_humano | humano | resolvido

  atendente: text("atendente"),

  ultimaMensagemEm: timestamp("ultima_mensagem_em").defaultNow(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type ConversaWhatsapp = typeof conversasWhatsappTable.$inferSelect;
export type ConversaWhatsappInsert = typeof conversasWhatsappTable.$inferInsert;

export const mensagensWhatsappTable = pgTable("mensagens_whatsapp", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  conversaId: integer("conversa_id").notNull(),

  from: text("from").notNull(),
  to: text("to").notNull(),
  body: text("body"),

  tipo: text("tipo").notNull().default("text"),
  // valores: text | image | audio | document

  mediaUrl: text("media_url"),

  direcao: text("direcao").notNull(),
  // valores: inbound | outbound

  status: text("status").notNull().default("enviado"),
  // valores: enviado | entregue | lido

  atendente: text("atendente"),
  // null = IA, string = nome do vendedor

  lida: boolean("lida").notNull().default(false),

  wahaMessageId: text("waha_message_id"),
  // ID único do evento WAHA — usado para deduplicação de webhooks duplicados

  criadoEm: timestamp("criado_em").defaultNow(),
}, (t) => [
  uniqueIndex("uq_waha_msg").on(t.lojaId, t.wahaMessageId),
]);

export type MensagemWhatsapp = typeof mensagensWhatsappTable.$inferSelect;
export type MensagemWhatsappInsert = typeof mensagensWhatsappTable.$inferInsert;
