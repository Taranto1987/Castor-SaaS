import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const colaboradoresTable = pgTable("colaboradores", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
  // O código É a senha de acesso (login). Admin pode alterá-lo para trocar a senha.
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  papel: text("papel").notNull().default("vendedor"), // dono | vendedor | entrega | financeiro
  operacao: text("operacao").notNull().default("cabo_frio"), // cabo_frio | araruama
  wa: text("wa"),                    // "(22) 99241-0112"
  waRaw: text("wa_raw"),             // "5522992410112"
  tom: text("tom").default("direto"), // especialista | acolhedor | direto | proximo | tecnico
  header: text("header"),            // cabeçalho do orçamento
  assinatura: text("assinatura"),    // linha de assinatura final
  ativo: boolean("ativo").notNull().default(true),
  ultimoAcesso: timestamp("ultimo_acesso"),
  criadoEm: timestamp("criado_em").defaultNow(),
});
