CREATE TYPE "public"."delivery_strategy" AS ENUM('pronta_entrega', 'sob_encomenda');--> statement-breakpoint
CREATE TYPE "public"."sales_mode" AS ENUM('showroom', 'outlet', 'hidden', 'seasonal');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"modelo" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_tokens" integer DEFAULT 0 NOT NULL,
	"custo_estimado" numeric(10, 6),
	"contexto" text,
	"request_id" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "automation_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"loja_id" integer NOT NULL,
	"rule_id" text NOT NULL,
	"score" real,
	"category" text,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"destination" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"disparado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"session_id" text,
	"loja_id" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "colaboradores" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"papel" text DEFAULT 'vendedor' NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"operacao" text DEFAULT 'cabo_frio' NOT NULL,
	"wa" text,
	"wa_raw" text,
	"tom" text DEFAULT 'direto',
	"header" text,
	"assinatura" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_acesso" timestamp,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "colaboradores_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"anonymous_id" text NOT NULL,
	"phone" text,
	"name" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "customer_profiles_anon_loja_uq" UNIQUE("anonymous_id","loja_id")
);
--> statement-breakpoint
CREATE TABLE "diagnosticos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"customer_id" integer,
	"nome" text,
	"whatsapp" text,
	"produto_recomendado" text,
	"confianca" numeric(4, 2),
	"flag_calibracao" text,
	"respostas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"perfil_biomecanico" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"perfil_comportamental" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entradas_estoque" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"fornecedor" text,
	"imagem_nota" text,
	"numero_nf" text,
	"cnpj_fornecedor" text,
	"total_itens" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "itens_entrada_estoque" (
	"id" serial PRIMARY KEY NOT NULL,
	"entrada_id" integer NOT NULL,
	"produto_id" integer,
	"nome_extraido" text NOT NULL,
	"sku_extraido" text,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"preco_custo" text,
	"custo_unitario" numeric(12, 2),
	"markup_percent" numeric(5, 2),
	"preco_sugerido" numeric(12, 2),
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entregas" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"orcamento_id" integer,
	"cliente" text NOT NULL,
	"whatsapp" text,
	"endereco" text,
	"produtos" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"vendedor" text,
	"observacoes" text,
	"data_entrega" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "eventos_operacionais" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loja_id" integer NOT NULL,
	"correlation_id" text,
	"request_id" text,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"acao" text NOT NULL,
	"ator_id" integer,
	"ator_tipo" text DEFAULT 'sistema' NOT NULL,
	"payload" jsonb,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comissoes_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"vendedor" text NOT NULL,
	"percentual" numeric(5, 2) DEFAULT '2.00' NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "comissoes_vendedor_loja_uq" UNIQUE("vendedor","loja_id")
);
--> statement-breakpoint
CREATE TABLE "despesas_recorrentes" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"valor" numeric(12, 2) NOT NULL,
	"categoria" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"dia_vencimento" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "despesas" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"valor" numeric(12, 2) NOT NULL,
	"categoria" text NOT NULL,
	"descricao" text,
	"comprovante" text,
	"recorrente" boolean DEFAULT false NOT NULL,
	"recorrente_id" integer,
	"confirmada" boolean DEFAULT true NOT NULL,
	"data" timestamp DEFAULT now() NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "metas" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"operacao" text DEFAULT 'cabo_frio' NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"orcamento_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"mensagem" text NOT NULL,
	"wa_link" text,
	"gerado_em" timestamp DEFAULT now() NOT NULL,
	"executado_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "lojas" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"operacao" text NOT NULL,
	"responsavel" text,
	"whatsapp_numero" text,
	"whatsapp_display" text,
	"cidades_json" jsonb,
	"endereco" text,
	"cidade" text,
	"prompt_delta" text,
	"config_json" jsonb,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "lojas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "crawler_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"status" text DEFAULT 'idle' NOT NULL,
	"mensagem" text DEFAULT '' NOT NULL,
	"total_produtos" text DEFAULT '0',
	"produtos_coletados" text DEFAULT '0',
	"erros" text DEFAULT '0',
	"iniciado_em" timestamp,
	"finalizado_em" timestamp,
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outlet_interesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"produto_id" integer NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"nome" text NOT NULL,
	"sku" text,
	"slug" text,
	"preco" text,
	"preco_pix" text,
	"parcelamento" text,
	"medidas" text,
	"altura" text,
	"categoria" text NOT NULL,
	"imagem" text,
	"link" text,
	"disponivel" boolean DEFAULT true NOT NULL,
	"encomenda" boolean DEFAULT false NOT NULL,
	"custo_brl" text,
	"prazo_encomenda" text,
	"estoque" integer,
	"preco_base" numeric(12, 2),
	"factory_cost" numeric(12, 2),
	"outlet_markup_percent" numeric(5, 2),
	"outlet_price" numeric(12, 2),
	"family_slug" text,
	"family_name" text,
	"size" text,
	"sales_mode" "sales_mode" DEFAULT 'showroom',
	"delivery_strategy" "delivery_strategy" DEFAULT 'pronta_entrega',
	"criado_em" timestamp DEFAULT now(),
	"sincronizado_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "orcamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1,
	"cliente" text NOT NULL,
	"whatsapp" text,
	"produtos_json" jsonb NOT NULL,
	"observacoes" text,
	"desconto_pix" integer DEFAULT 0,
	"total_pix" text,
	"total_prazo" text,
	"texto" text NOT NULL,
	"vendedor" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"preco_base_total" text,
	"desconto_aplicado" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer,
	"usuario_id" integer,
	"acao" text NOT NULL,
	"detalhes" jsonb,
	"ip" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "convites" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"loja_id" integer DEFAULT 1 NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"usado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "convites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "reset_senha_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"loja_id" integer DEFAULT 1 NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"usado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "reset_senha_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer DEFAULT 1 NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text,
	"cargo" text DEFAULT 'VENDEDOR' NOT NULL,
	"operacao" text DEFAULT 'cabo_frio' NOT NULL,
	"wa" text,
	"wa_raw" text,
	"tom" text DEFAULT 'direto',
	"header" text,
	"assinatura" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_login" timestamp,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "relational_capsules" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"loja_id" integer NOT NULL,
	"capsule" text NOT NULL,
	"session_count" integer DEFAULT 1 NOT NULL,
	"last_contact_at" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "relational_capsules_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "lead_score_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"loja_id" integer NOT NULL,
	"score" real NOT NULL,
	"category" text NOT NULL,
	"delta" real DEFAULT 0 NOT NULL,
	"trigger_event" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"loja_id" integer NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"category" text DEFAULT 'frio' NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"closing_probability" real DEFAULT 0 NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp DEFAULT now(),
	"first_seen_at" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"image_url" text,
	"ranking" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"available_sizes" jsonb DEFAULT '["Solteiro","Casal","Queen","King"]'::jsonb NOT NULL,
	"semantic_tags" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"usuario_id" integer NOT NULL,
	"loja_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"instance_id" text NOT NULL,
	"provider" text DEFAULT 'evolution' NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"phone" text,
	"connected_at" timestamp,
	"last_seen_at" timestamp,
	"session_metadata" jsonb,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_instances_instance_id_unique" UNIQUE("instance_id")
);
--> statement-breakpoint
CREATE TABLE "tool_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"tool_name" text NOT NULL,
	"source" text DEFAULT 'chat' NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"input_summary" jsonb,
	"error_message" text,
	"correlation_id" text,
	"request_id" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_contexts" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"telefone" text NOT NULL,
	"nome" text,
	"ultimo_interesse" text,
	"ultima_categoria" text,
	"ultimo_orcamento_id" integer,
	"faixa_preco" text,
	"tags" jsonb,
	"temperatura" text,
	"ultimo_contato_em" timestamp,
	"ultimo_resumo_ia" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "lead_ctx_tenant_phone" UNIQUE("telefone","loja_id")
);
--> statement-breakpoint
CREATE TABLE "lead_interacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"loja_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"conteudo" text NOT NULL,
	"autor_id" text,
	"autor_nome" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_tarefas" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"loja_id" integer NOT NULL,
	"descricao" text NOT NULL,
	"tipo" text DEFAULT 'follow_up' NOT NULL,
	"prazo" timestamp,
	"concluso" boolean DEFAULT false NOT NULL,
	"responsavel" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"customer_profile_id" integer,
	"nome" text NOT NULL,
	"whatsapp" text,
	"email" text,
	"estagio" text DEFAULT 'novo' NOT NULL,
	"origem" text DEFAULT 'loja' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observacoes" text,
	"vendedor_atribuido" text,
	"perfil_biomecanico" jsonb DEFAULT '{}'::jsonb,
	"pontuacao" real DEFAULT 0,
	"ultimo_contato" timestamp,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversas_whatsapp" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"phone" text NOT NULL,
	"nome" text,
	"lead_id" integer,
	"status" text DEFAULT 'bot' NOT NULL,
	"atendente" text,
	"ultima_mensagem_em" timestamp DEFAULT now(),
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mensagens_whatsapp" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"conversa_id" integer NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"body" text,
	"tipo" text DEFAULT 'text' NOT NULL,
	"media_url" text,
	"direcao" text NOT NULL,
	"status" text DEFAULT 'enviado' NOT NULL,
	"atendente" text,
	"lida" boolean DEFAULT false NOT NULL,
	"waha_message_id" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduler_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheduler_id" text NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"locked_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_run_at" timestamp,
	"last_run_ok" boolean,
	CONSTRAINT "scheduler_locks_scheduler_id_unique" UNIQUE("scheduler_id")
);
--> statement-breakpoint
CREATE TABLE "sleep_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"diagnostico_id" integer NOT NULL,
	"customer_id" integer,
	"loja_id" integer DEFAULT 1,
	"vendeu" boolean,
	"produto_vendido" text,
	"ticket" numeric(12, 2),
	"registrado_em" timestamp,
	"satisfacao_30d" integer,
	"satisfacao_90d" integer,
	"dor_melhorou" boolean,
	"satisfacao_180d" integer,
	"satisfacao_365d" integer,
	"indicou" boolean,
	"nps" integer,
	"trocou" boolean,
	"motivo_troca" text,
	"sleep_success_score" numeric(5, 2),
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"orcamento_id" integer NOT NULL,
	"customer_id" integer,
	"lead_id" integer,
	"diagnostico_id" integer,
	"cliente" text NOT NULL,
	"whatsapp" text,
	"status" text DEFAULT 'NOVO' NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"closing_probability" real DEFAULT 0 NOT NULL,
	"valor_numerico" real DEFAULT 0 NOT NULL,
	"valor_brl" text,
	"dias_sem_resposta" integer DEFAULT 0 NOT NULL,
	"proxima_acao" text,
	"motivo" text,
	"responsavel" text,
	"ultimo_contato_em" timestamp,
	"proximo_contato_em" timestamp,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_entrada_estoque" ADD CONSTRAINT "itens_entrada_estoque_entrada_id_entradas_estoque_id_fk" FOREIGN KEY ("entrada_id") REFERENCES "public"."entradas_estoque"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_entrada_estoque" ADD CONSTRAINT "itens_entrada_estoque_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_orcamento_id_orcamentos_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convites" ADD CONSTRAINT "convites_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reset_senha_tokens" ADD CONSTRAINT "reset_senha_tokens_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_log_loja_disparado_idx" ON "automation_log" USING btree ("loja_id","disparado_em");--> statement-breakpoint
CREATE INDEX "automation_log_customer_idx" ON "automation_log" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "chat_events_loja_created_idx" ON "chat_events" USING btree ("loja_id","criado_em");--> statement-breakpoint
CREATE INDEX "chat_events_session_idx" ON "chat_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "colaboradores_loja_idx" ON "colaboradores" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "colaboradores_wa_raw_idx" ON "colaboradores" USING btree ("wa_raw") WHERE "colaboradores"."wa_raw" is not null;--> statement-breakpoint
CREATE INDEX "despesas_recorrentes_loja_ativo_idx" ON "despesas_recorrentes" USING btree ("loja_id","ativo") WHERE "despesas_recorrentes"."ativo" = true;--> statement-breakpoint
CREATE INDEX "despesas_loja_data_idx" ON "despesas" USING btree ("loja_id","data");--> statement-breakpoint
CREATE INDEX "follow_ups_orcamento_tipo_idx" ON "follow_ups" USING btree ("orcamento_id","tipo");--> statement-breakpoint
CREATE INDEX "follow_ups_pendentes_idx" ON "follow_ups" USING btree ("executado_em") WHERE "follow_ups"."executado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_sku_loja_unique" ON "produtos" USING btree ("sku","loja_id") WHERE "produtos"."sku" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_slug_loja_unique" ON "produtos" USING btree ("slug","loja_id") WHERE "produtos"."slug" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orcamentos_loja_status_criado_idx" ON "orcamentos" USING btree ("loja_id","status","criado_em");--> statement-breakpoint
CREATE INDEX "usuarios_loja_idx" ON "usuarios" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "lead_scores_customer_loja_idx" ON "lead_scores" USING btree ("customer_id","loja_id");--> statement-breakpoint
CREATE INDEX "lead_scores_loja_score_idx" ON "lead_scores" USING btree ("loja_id","score");--> statement-breakpoint
CREATE INDEX "lead_scores_customer_idx" ON "lead_scores" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sessions_loja_expires_idx" ON "sessions" USING btree ("loja_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tool_executions_loja_created_idx" ON "tool_executions" USING btree ("loja_id","criado_em");--> statement-breakpoint
CREATE INDEX "tool_executions_correlation_idx" ON "tool_executions" USING btree ("correlation_id") WHERE "tool_executions"."correlation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_waha_msg" ON "mensagens_whatsapp" USING btree ("loja_id","waha_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_opp_loja_orcamento_uq" ON "sales_opportunities" USING btree ("loja_id","orcamento_id");--> statement-breakpoint
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "vendido_em" timestamp;
CREATE INDEX "sales_opp_loja_status_score_idx" ON "sales_opportunities" USING btree ("loja_id","status","score");
--> statement-breakpoint
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "customer_id" integer;
--> statement-breakpoint
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "lead_id" integer;
--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD COLUMN IF NOT EXISTS "lead_id" integer;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "motivo_perda" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "motivo_ganho" text;
--> statement-breakpoint
ALTER TABLE "conversas_whatsapp" ADD COLUMN IF NOT EXISTS "customer_id" integer;
--> statement-breakpoint
ALTER TABLE "entregas" ADD COLUMN IF NOT EXISTS "customer_id" integer;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "descricao" text;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "ficha_tecnica" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "motivo_troca" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "prazo_compra" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "score_intencao" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "status_funil" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "produto_final_vendido" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "motivo_nao_venda" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "satisfacao_pos_venda" integer;--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD COLUMN IF NOT EXISTS "resultado" jsonb;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "largura" integer;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "comprimento" integer;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "medida" text;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "categoria_interna" text DEFAULT 'NAO_MAPEADA';--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "status_medida" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "produtos_loja_categoria_interna_idx" ON "produtos" USING btree ("loja_id","categoria_interna");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meta_catalogo_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"catalog_id" text NOT NULL,
	"feed_id" text,
	"access_token" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meta_produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"meta_product_id" text NOT NULL,
	"retailer_id" text,
	"produto_id" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_catalogo_config_loja_unique" ON "meta_catalogo_config" USING btree ("loja_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_produtos_meta_id_loja_unique" ON "meta_produtos" USING btree ("meta_product_id","loja_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_produtos_produto_loja_unique" ON "meta_produtos" USING btree ("produto_id","loja_id");
