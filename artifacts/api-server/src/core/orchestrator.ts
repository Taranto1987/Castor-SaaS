import { classificarMensagem } from "./classifier.js";
import { validarResposta, sanitizarEntrada } from "./guardrails.js";
import { escolherModelo } from "../services/model-router.js";
import { executarAgente } from "../services/agente.js";
import { buscarProdutos } from "../services/produtos.js";
import { criarOrcamento } from "../services/orcamento.js";
import { enviarWhatsApp } from "../services/whatsapp.js";
import type { TenantKey } from "../config/tenants.js";

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

  if (tipo === "saudacao") {
    await enviarWhatsApp(
      telefone,
      "Olá! Seja bem-vindo à Castor. Me diz: é para casal ou solteiro? 😊"
    );
    return;
  }

  const produtos = await buscarProdutos(tenant);

  if (produtos.length === 0) {
    await enviarWhatsApp(
      telefone,
      "Olá! Nosso catálogo está sendo atualizado. Entre em contato por telefone para mais informações."
    );
    return;
  }

  const modelo = escolherModelo(tipo);

  let resposta: string;
  try {
    resposta = await executarAgente({
      mensagem: mensagemLimpa,
      contexto: { produtos, tipo, tenant },
      modelo,
    });
    resposta = validarResposta(resposta);
  } catch (err) {
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
    return;
  }

  await enviarWhatsApp(telefone, resposta);
}
