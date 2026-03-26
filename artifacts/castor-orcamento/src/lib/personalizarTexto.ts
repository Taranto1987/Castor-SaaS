import type { AuthUser, Tom } from "@/contexts/AuthContext";

// Saudações personalizadas por tom
const SAUDACOES: Record<Tom, (nome: string, nomeColaborador: string) => string> = {
  especialista: (c, _col) =>
    `Fala, ${c}! Aqui é o ThallesZzz, especialista em engenharia do sono da Castor Cabo Frio. 🎯\nPreparei um orçamento completo e exclusivo para você:`,
  acolhedor: (c, col) =>
    `Olá, ${c}! Aqui é a ${col.split(" ")[0]} da Castor Cabo Frio. 😊\nPreparei seu orçamento com muito cuidado:`,
  direto: (c, col) =>
    `Boa, ${c}! Aqui é o ${col.split(" ")[0]} da Castor Cabo Frio.\nSegue seu orçamento direto ao ponto:`,
  proximo: (c, col) =>
    `Olá, ${c}! 💙 Aqui é a ${col.split(" ")[0]} da Castor Araruama.\nPreparei seu orçamento com muito carinho:`,
  tecnico: (c, col) =>
    `Olá, ${c}! Aqui é o ${col.split(" ")[0]} da Castor Araruama.\nSegue seu orçamento completo com todos os detalhes:`,
};

const SEPARADOR = "━━━━━━━━━━━━━━━━━━━━━━";

export function personalizarTexto(textoApi: string, user: AuthUser, cliente: string): string {
  let t = textoApi;

  // 1. Substituir cabeçalho genérico pelo do colaborador
  t = t.replace("🇧🇷 CASTOR CABO FRIO", user.header);

  // 2. Inserir saudação personalizada após a linha "Cliente: ..."
  const clienteLine = `Cliente: ${cliente}`;
  const saudacao = SAUDACOES[user.tom](cliente, user.nome);
  if (t.includes(clienteLine)) {
    t = t.replace(clienteLine, `${clienteLine}\n\n${saudacao}`);
  }

  // 3. Substituir rodapé com WA, endereço e links da loja corretos
  const rodape = [
    `📞 ${user.assinatura}`,
    user.wa,
    `📍 ${user.endereco}`,
    `🗺️ ${user.mapsLink}`,
    `⭐ ${user.lojaLink}`,
  ].join("\n");

  t = t.replace(
    `📞 WhatsApp Loja\n${SEPARADOR.slice(0, 0)}(22) 99241-0112`,
    rodape
  );

  // Fallback: se o replace acima não achou o padrão exato
  if (t.includes("📞 WhatsApp Loja")) {
    t = t
      .replace("📞 WhatsApp Loja", `📞 ${user.assinatura}`)
      .replace("(22) 99241-0112", `${user.wa}\n📍 ${user.endereco}\n🗺️ ${user.mapsLink}\n⭐ ${user.lojaLink}`);
  }

  return t;
}
