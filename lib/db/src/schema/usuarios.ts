import { pgTable, serial, text, boolean, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const CARGOS = ["ADMIN", "GERENTE", "VENDEDOR", "FINANCEIRO", "ENTREGA"] as const;
export type Cargo = typeof CARGOS[number];

export const usuariosTable = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull().default(1),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash"),
  cargo: text("cargo").notNull().default("VENDEDOR"),
  // Campos de integração WhatsApp/negócio (migrados de colaboradoresTable)
  operacao: text("operacao").notNull().default("cabo_frio"),
  wa: text("wa"),
  waRaw: text("wa_raw"),
  tom: text("tom").default("direto"),
  header: text("header"),
  assinatura: text("assinatura"),
  // Status
  ativo: boolean("ativo").notNull().default(true),
  ultimoLogin: timestamp("ultimo_login"),
  criadoEm: timestamp("criado_em").defaultNow(),
}, (t) => [
  index("usuarios_loja_idx").on(t.lojaId),
]);

export const convitesTable = pgTable("convites", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").notNull().references(() => usuariosTable.id, { onDelete: "cascade" }),
  lojaId: integer("loja_id").notNull().default(1),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usado: boolean("usado").notNull().default(false),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export const resetSenhaTokensTable = pgTable("reset_senha_tokens", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").notNull().references(() => usuariosTable.id, { onDelete: "cascade" }),
  lojaId: integer("loja_id").notNull().default(1),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usado: boolean("usado").notNull().default(false),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id"),
  usuarioId: integer("usuario_id"),
  acao: text("acao").notNull(),
  detalhes: jsonb("detalhes"),
  ip: text("ip"),
  criadoEm: timestamp("criado_em").defaultNow(),
});
