import { pgTable, serial, integer, text, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  customerProfileId: integer("customer_profile_id"),

  nome: text("nome").notNull(),
  whatsapp: text("whatsapp"),
  email: text("email"),

  estagio: text("estagio").notNull().default("novo"),
  // valores: novo | contato | proposta | negociacao | ganho | perdido

  origem: text("origem").notNull().default("loja"),
  // valores: chat | indicacao | loja | instagram | google | whatsapp_direto

  tags: jsonb("tags").notNull().default([]),
  observacoes: text("observacoes"),
  vendedorAtribuido: text("vendedor_atribuido"),

  perfilBiomecanico: jsonb("perfil_biomecanico").default({}),
  // {peso?, altura?, posicaoDormir?, dorAtual?, colchaoAtual?, firme: 1-5,
  //  regioesDor: string[], comorbidades: string[], orcamento?}

  pontuacao: real("pontuacao").default(0),

  ultimoContato: timestamp("ultimo_contato"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type Lead = typeof leadsTable.$inferSelect;
export type LeadInsert = typeof leadsTable.$inferInsert;

export const leadInteracoesTable = pgTable("lead_interacoes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  lojaId: integer("loja_id").notNull(),

  tipo: text("tipo").notNull(),
  // valores: mensagem_wa | ligacao | orcamento | visita | nota | email | handoff

  conteudo: text("conteudo").notNull(),
  autorId: text("autor_id"),
  autorNome: text("autor_nome"),

  criadoEm: timestamp("criado_em").defaultNow(),
});

export type LeadInteracao = typeof leadInteracoesTable.$inferSelect;
export type LeadInteracaoInsert = typeof leadInteracoesTable.$inferInsert;

export const leadTarefasTable = pgTable("lead_tarefas", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  lojaId: integer("loja_id").notNull(),

  descricao: text("descricao").notNull(),
  tipo: text("tipo").notNull().default("follow_up"),
  // valores: follow_up | ligar | enviar_proposta | outro

  prazo: timestamp("prazo"),
  concluso: boolean("concluso").notNull().default(false),
  responsavel: text("responsavel"),

  criadoEm: timestamp("criado_em").defaultNow(),
});

export type LeadTarefa = typeof leadTarefasTable.$inferSelect;
export type LeadTarefaInsert = typeof leadTarefasTable.$inferInsert;
