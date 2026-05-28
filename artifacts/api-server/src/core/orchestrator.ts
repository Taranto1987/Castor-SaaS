import { classificarMensagem } from "./classifier.js";
import { validarResposta, sanitizarEntrada } from "./guardrails.js";
import { escolherModelo } from "../services/model-router.js";
import { executarAgente } from "../services/agente.js";
import { buscarProdutos } from "../services/produtos.js";
import { criarOrcamento } from "../services/orcamento.js";
import { enviarWhatsApp } from "../services/whatsapp.js";
import { getLeadContext, buildLeadMemoryBlock, generateAndSaveLeadContext } from "../services/lead-context.js";
import type { TenantKey } from "../config/tenants.js";

const TENANT_LOJA: Record<TenantKey, number> = {
  "cabo-frio": 1,
  araruama: 2,
  default: 1,
};

interface OrquestrarParams {
  mensagem: string;
  telefone: string;
  tenant: TenantKey;
}

export async function orquestrarMensagem({
  mensagem,
  telefone,
  tenant,
}: OrquestrarParams): Promise<void> {
  const mensagemLimpa = sanitizarEntrada(mensagem);
  const tipo = classificarMensagem(mensagemLimpa);
  const lojaId = TENANT_LOJA[tenant] ?? 1;

  if (tipo === "saudacao") {
    await enviarWhatsApp(
      telefone,
      "Olá! Seja bem-vindo à Castor. Me diz: é para casal ou solteiro? 😊"
    );
    return;
  }

  const [produtos, leadCtx] = await Promise.all([
    buscarProdutos(tenant),
    getLeadContext(telefone, lojaId),
  ]);

  if (produtos.length === 0) {
    await enviarWhatsApp(
      telefone,
      "Olá! Nosso catálogo está sendo atualizado. Entre em contato por telefone para mais informações."
    );
    return;
  }

  const modelo = escolherModelo(tipo);
  const memoriaLead = leadCtx ? buildLeadMemoryBlock(leadCtx) : null;

  let resposta: string;
  try {
    resposta = await executarAgente({
      mensagem: mensagemLimpa,
      contexto: { produtos, tipo, tenant, ...(memoriaLead ? { memoriaLead } : {}) },
      modelo,
    });
    resposta = validarResposta(resposta);
  } catch (_err) {
    // Fail-safe: API instável ou guardrail ativado
    resposta =
      "Desculpe, tive um problema ao processar sua mensagem. Um vendedor entrará em contato em breve!";
  }

  if (resposta.includes("RECOMENDAR_PRODUTO")) {
    const orcamento = await criarOrcamento({ tenant, telefone, produtos: [] });
    await enviarWhatsApp(
      telefone,
      `Preparei um orçamento para você:\n${JSON.stringify(orcamento, null, 2)}`
    );
    // fire-and-forget context update
    setImmediate(() => {
      const msgs = [{ role: "user", content: mensagemLimpa }];
      generateAndSaveLeadContext(telefone, lojaId, leadCtx?.nome ?? null, msgs).catch(
        (err) => console.error("[LeadContext] Save failed:", err)
      );
    });
    return;
  }

  await enviarWhatsApp(telefone, resposta);

  // fire-and-forget context update after every exchange
  setImmediate(() => {
    const msgs = [
      { role: "user", content: mensagemLimpa },
      { role: "assistant", content: resposta },
    ];
    generateAndSaveLeadContext(telefone, lojaId, leadCtx?.nome ?? null, msgs).catch(
      (err) => console.error("[LeadContext] Save failed:", err)
    );
  });
}
