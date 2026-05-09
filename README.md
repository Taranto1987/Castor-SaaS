# CASTOR-SAAS — AI NATIVE COMMERCE OPERATING SYSTEM

## VISÃO

O Castor-SaaS NÃO é um site de colchões.

É uma infraestrutura operacional AI Native para redes comerciais físicas e digitais.

O sistema foi concebido para transformar operações tradicionais de varejo em plataformas inteligentes, automatizadas, distribuídas e multi-tenant.

O objetivo final NÃO é apenas vender colchões.

O objetivo é:

* automatizar decisão comercial
* padronizar operação
* reduzir dependência humana
* transformar atendimento em sistema
* conectar IA + vendas + logística + financeiro + CRM
* operar centenas de lojas simultaneamente
* criar uma infraestrutura nacional de franquias orientada por IA

---

# PRINCÍPIO CENTRAL

O ativo principal NÃO é o produto.

O ativo principal é:

```txt
operação inteligente
```

O sistema existe para:

* eliminar improviso
* eliminar perda operacional
* reduzir retrabalho
* transformar conhecimento humano em execução escalável

---

# O QUE SIGNIFICA “AI NATIVE”

AI Native NÃO significa “adicionar chatbot”.

Significa:

```txt
IA é parte estrutural da arquitetura
```

A IA participa de:

* diagnóstico
* recomendação
* contexto regional
* automação comercial
* follow-up
* atendimento
* análise operacional
* roteamento
* recuperação de vendas
* qualificação
* tomada de decisão

A IA NÃO é camada superficial.

Ela é parte do núcleo operacional.

---

# FILOSOFIA ARQUITETURAL

## 1. SISTEMA DISTRIBUÍDO

O sistema deve operar como múltiplos serviços independentes.

Falha em um serviço NÃO pode derrubar o restante da operação.

Arquitetura desejada:

```txt
frontend
api-server
worker
crawler
whatsapp-service
analytics-service
ai-service
```

---

## 2. ANTI-MONÓLITO

NUNCA centralizar lógica.

Arquivos gigantes são proibidos.

Se um arquivo começa a virar “cérebro do sistema”:
→ dividir imediatamente.

Problemas causados por centralização:

* merge destrutivo
* contexto excessivo
* IA errando
* typecheck instável
* deploy cascata
* dificuldade de manutenção

---

## 3. DOMAIN-FIRST ARCHITECTURE

Toda lógica deve ser separada por domínio operacional.

Estrutura esperada:

```txt
/services
  /chat
  /sleepmap
  /catalog
  /tenant
  /finance
  /logistics
  /followup
  /whatsapp
  /analytics
```

Cada domínio deve conter:

```txt
orchestrator.ts
validation.ts
types.ts
repository.ts
service.ts
utils.ts
```

---

# MULTI-TENANT

O sistema foi projetado para múltiplas lojas operando simultaneamente.

Toda entidade importante deve ser tenant-aware.

Toda operação deve receber contexto explícito:

```ts
type RequestContext = {
  tenantId: number;
  tenantSlug: string;
  cidade: string;
  whatsapp: string;

  branding: {
    nome: string;
    avatar: string;
  };
};
```

A IA nunca deve “descobrir” tenant.

O contexto deve chegar resolvido.

---

# GEO-DISTRIBUTED EXPERIENCE

O frontend deve adaptar automaticamente experiência, branding e operação conforme a localização do usuário.

Fluxo esperado:

```txt
IP
↓
resolver região
↓
resolver tenant
↓
inject tenant context
↓
site muda
↓
IA muda
↓
WhatsApp muda
↓
estoque muda
↓
follow-up muda
```

---

# FRONTEND PRINCIPLES

Frontend deve ser fail-safe.

Toda API é considerada instável por definição.

Obrigatório:

* loading states
* empty states
* error states
* fallback visual
* proteção null/undefined
* map seguro
* ErrorBoundary global

Nenhum componente pode quebrar a aplicação inteira.

---

# BACKEND PRINCIPLES

Routes NÃO contêm regra de negócio.

ERRADO:

```txt
route decidindo produto, IA, agrupamento e fallback
```

CERTO:

```txt
route → orchestrator → services → response
```

Toda lógica deve existir em serviços isolados e testáveis.

---

# IA / AGENTES

Agentes operam melhor com:

* contexto pequeno
* tarefa específica
* arquivos pequenos
* contratos claros

Evitar:

* prompts gigantes
* contexto excessivo
* arquivos procedural gigantes
* refatoração global sem isolamento

Modelo correto:

```txt
1 domínio por vez
1 responsabilidade por vez
1 escopo por vez
```

---

# OBJETIVO OPERACIONAL

Transformar o Castor-SaaS em:

* plataforma resiliente
* modular
* escalável
* observável
* segura
* automatizada
* AI Native
* preparada para centenas de lojas

---

# O QUE ESTE PROJETO NÃO É

NÃO é:

* template React
* chatbot genérico
* CRM simples
* landing page
* MVP improvisado

É uma infraestrutura operacional comercial AI Native.

---

# REGRA FINAL

Toda decisão técnica deve responder:

```txt
isso reduz acoplamento?
isso melhora resiliência?
isso facilita escala?
isso evita caos futuro?
isso permite operação multi-tenant?
isso mantém IA utilizável em produção?
```

Se a resposta for “não”:
→ repensar implementação.
