import type { LPConfig } from "@/components/lp/LPTemplate";

const WA_CF = { numero: "5522992410112", nome: "ThallesZzz", loja: "Cabo Frio", tel: "(22) 99241-0112" };
const WA_AR = { numero: "5522988447240", nome: "Marcela", loja: "Araruama", tel: "(22) 98844-7240" };

const RED_ACCENT = {
  bg: "bg-red-600", bgHover: "hover:bg-red-700", bgLight: "bg-red-50",
  text: "text-red-600", border: "border-red-200",
  gradFrom: "from-red-600", gradTo: "to-red-900",
  ring: "ring-red-500",
};
const AMBER_ACCENT = {
  bg: "bg-amber-600", bgHover: "hover:bg-amber-700", bgLight: "bg-amber-50",
  text: "text-amber-600", border: "border-amber-200",
  gradFrom: "from-amber-600", gradTo: "to-amber-900",
  ring: "ring-amber-500",
};
const EMERALD_ACCENT = {
  bg: "bg-emerald-600", bgHover: "hover:bg-emerald-700", bgLight: "bg-emerald-50",
  text: "text-emerald-600", border: "border-emerald-200",
  gradFrom: "from-emerald-600", gradTo: "to-emerald-900",
  ring: "ring-emerald-500",
};
const BLUE_ACCENT = {
  bg: "bg-blue-600", bgHover: "hover:bg-blue-700", bgLight: "bg-blue-50",
  text: "text-blue-600", border: "border-blue-200",
  gradFrom: "from-blue-600", gradTo: "to-blue-900",
  ring: "ring-blue-500",
};
const VIOLET_ACCENT = {
  bg: "bg-violet-600", bgHover: "hover:bg-violet-700", bgLight: "bg-violet-50",
  text: "text-violet-600", border: "border-violet-200",
  gradFrom: "from-violet-600", gradTo: "to-violet-900",
  ring: "ring-violet-500",
};

// ─────────────────────────────────────────────────────────────────────────────
// LP 1 · /lp/luxo · "O original nunca precisou de propaganda enganosa"
// Persona: quem pesquisou "Castor Cabo Frio" no Google e encontrou o concorrente
// Gatilho emocional: indignação + autoridade de 25 anos + pertencimento local
// ─────────────────────────────────────────────────────────────────────────────

export const cfgLuxo: LPConfig = {
  pageTitle: "Castor Colchões Cabo Frio — 25 Anos. Única 5.0 Google. Original.",
  metaDescription: "A Castor Colchões original de Cabo Frio. 25 anos servindo a Região dos Lagos, nota 5.0 no Google, tecnologia Pocket® suíça certificada. Não confunda com imitadores que aparecem no Google Ads.",
  badge: "25 anos em Cabo Frio · ⭐ 5.0 Google · Única certificada INER",
  h1: "Castor Colchões Cabo Frio — 25 Anos de Original. Não Confunda.",
  headlineLine1: "Enquanto você pesquisava,",
  headlineLine2: "alguém pagou pra aparecer no lugar da gente.",
  headlineAccent: "Nós estamos aqui há 25 anos.",
  sub: "A Castor Colchões original de Cabo Frio existe desde 1998. Nota 5.0 real no Google, tecnologia Pocket® suíça certificada, equipe que conhece você pelo nome. O original não precisa comprar o nome de ninguém.",
  ctaLabel: "Falar com ThallesZzz agora",
  ctaSubtext: "Resposta em minutos · Sem bot, sem script, sem enrolação",
  wa: WA_CF,
  scarcityText: "⚠️ <strong>Atenção:</strong> concorrentes usam o nome Castor em anúncios no Google. A loja original de Cabo Frio está aqui.",
  scarcityEmoji: "🏆",
  accentClasses: AMBER_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-950 via-amber-950 to-slate-900",
  features: [
    {
      icon: "award",
      title: "25 Anos — Não é Slogan",
      desc: "Desde 1998 na Região dos Lagos. Clientes que compraram no primeiro ano agora compram para os filhos. Esse legado não se financia com anúncio pago.",
      colorClass: "bg-amber-50 text-amber-700",
    },
    {
      icon: "star",
      title: "Única Loja 5.0 Real na Região",
      desc: "142 avaliações Google. Nota 5.0 intocada. Qualquer loja pode pagar anúncio — mas não dá pra comprar avaliação de quem dormiu mal e ainda voltou pra recomendar.",
      colorClass: "bg-yellow-50 text-yellow-700",
    },
    {
      icon: "shield",
      title: "Pocket® Spring Certificado INER",
      desc: "Molas independentes com laudo técnico real. A densidade D33 declarada na etiqueta é a densidade real do produto — não tem carga mineral escondida.",
      colorClass: "bg-emerald-50 text-emerald-700",
    },
    {
      icon: "wind",
      title: "Fresh Comfort Gel® Suíço",
      desc: "Partículas de gel europeu regulam temperatura entre 18–22°C. Quem vive no calor de Cabo Frio sabe o que significa acordar encharcado às 3h da manhã. Essa tecnologia resolve.",
      colorClass: "bg-blue-50 text-blue-700",
    },
    {
      icon: "zap",
      title: "ThallesZzz — Especialista, Não Vendedor",
      desc: "Ele não tem meta de vendas por modelo. Vai te indicar o colchão certo pro seu peso, posição e orçamento — mesmo que seja o mais barato da loja.",
      colorClass: "bg-violet-50 text-violet-700",
    },
    {
      icon: "rotate",
      title: "Troca em 30 Dias, Zero Burocracia",
      desc: "Se em 30 dias você não dormir perceptivelmente melhor, a gente troca. Sem perguntas difíceis, sem formulário, sem surpresa. É política de loja — não promessa vazia.",
      colorClass: "bg-rose-50 text-rose-700",
    },
  ],
  reviews: [
    {
      name: "Jorge S.",
      city: "Cabo Frio",
      time: "há 3 semanas",
      initials: "JS",
      text: "Pesquisei 'colchão Castor Cabo Frio' no Google e cliquei no primeiro resultado. Era outro lugar. Comprei, me arrependi em uma semana. Vim até a Castor original e a diferença foi brutal — na qualidade e no atendimento. Dinheiro jogado fora foi o da primeira vez.",
    },
    {
      name: "Renata P.",
      city: "Arraial do Cabo",
      time: "há 1 mês",
      initials: "RP",
      text: "ThallesZzz passou 40 minutos me explicando a diferença técnica entre cada modelo antes de qualquer preço. Não tentou me vender o mais caro. Me indicou o certo para o meu peso e como durmo. Há 25 anos isso se chama especialização — não se aprende em 3 meses.",
    },
    {
      name: "Flávia M.",
      city: "Búzios",
      time: "há 2 semanas",
      initials: "FM",
      text: "Minha sogra comprou na Castor em 2003. Meu marido comprou em 2018. Agora eu em 2026. Três gerações da mesma família, mesma loja, mesma confiança. Loja nova não constrói isso em campanha de Google.",
    },
    {
      name: "Caio B.",
      city: "Cabo Frio",
      time: "há 4 dias",
      initials: "CB",
      text: "Vim porque vi o concorrente aparecendo no Google no lugar da Castor e fiquei indignado. Passei aqui pra confirmar: o original continua aqui, continua melhor e continua com preço justo. Comprei e saí satisfeito.",
    },
    {
      name: "Adriana L.",
      city: "São Pedro da Aldeia",
      time: "há 6 semanas",
      initials: "AL",
      text: "Colchão Pocket Spring. Durmo de lado e tinha dor no ombro toda manhã há anos. Em 4 dias dormindo no Castor a dor sumiu. Entrega no dia prometido, montagem caprichada. 5 estrelas é pouco.",
    },
  ],
  faq: [
    {
      q: "Por que existe outro lugar usando o nome Castor nos anúncios do Google?",
      a: "É uma prática chamada 'brand bidding' — concorrentes pagam para aparecer quando alguém pesquisa seu nome. É legal, mas desonesto. A Castor Colchões original de Cabo Frio existe desde 1998. Nossa nota 5.0 no Google com 142 avaliações reais é a prova mais fácil de verificar.",
    },
    {
      q: "O que diferencia o Pocket® Spring do colchão 'de mola' comum?",
      a: "No mola comum, todas as molas estão soldadas — uma mexe, todas mexem. No Pocket® Spring cada mola fica dentro de um cilindro de tecido separado. Resultado: suporte individualizado para cada parte do corpo e zero transferência de movimento entre parceiros.",
    },
    {
      q: "Qual o prazo de entrega para Cabo Frio e região?",
      a: "Cabo Frio, Arraial, Búzios e São Pedro da Aldeia: até 48h úteis, com equipe própria. Em muitos casos entregamos no dia ou horário que você preferir, incluindo sábado. Montagem e retirada de embalagem sempre incluídas.",
    },
    {
      q: "O que é certificação INER e por que importa?",
      a: "O INER (Instituto Nacional de Engenharia de Recursos) certifica que a densidade declarada na etiqueta é real. D33 = 33 kg/m³ real, sem carga mineral. Colchão sem laudo INER pode ter D20 real com D33 na etiqueta — isso é fraude e você só descobre quando o colchão afundar em 6 meses.",
    },
    {
      q: "E se eu não me adaptar ao colchão?",
      a: "30 dias para testar. Se não dormir melhor, trocamos pelo modelo mais adequado para o seu perfil. Sem formulário, sem taxa, sem discussão. Essa é a política da loja desde sempre.",
    },
  ],
  quizTitle: "Qual colchão é o seu?",
  quizSub: "3 perguntas. ThallesZzz analisa o resultado e te indica o modelo certo — não o mais caro.",
  garantiaText: "✅ 30 dias para testar. Se não dormir melhor, trocamos sem custo. Essa é a política da Castor desde 1998.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Jardim Flamboyant, Cabo Frio – RJ",
  jsonLdExtra: {
    foundingDate: "1998",
    slogan: "25 anos dormindo bem na Região dos Lagos",
  },
  images: {
    heroBg:        "/lp/lifestyle-acordar.png",
    storeInterior: "/lp/loja-interior.png",
    productShot:   "/lp/colchao-goldstar.jpg",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LP 2 · /lp/box-bau · "Quando a cama guarda, o quarto respira"
// Persona: quem mora em Araruama/SPA, quarto pequeno, acumulou coisas
// Gatilho emocional: alívio + praticidade + vergonha do quarto bagunçado
// ─────────────────────────────────────────────────────────────────────────────

export const cfgBoxBau: LPConfig = {
  pageTitle: "Cama Box Baú Araruama — Entrega e Montagem Grátis | Castor Colchões",
  metaDescription: "Cama Box Baú em Araruama, Saquarema e Iguaba Grande com entrega e montagem grátis. Estrutura MDF premium + colchão Castor. Loja 5.0 Google. Fale com Marcela.",
  badge: "Box Baú · Araruama e região · ⭐ 5.0 Google",
  h1: "Cama Box Baú em Araruama — Entrega e Montagem Grátis Hoje",
  headlineLine1: "Quando a cama guarda tudo,",
  headlineLine2: "o quarto finalmente respira.",
  headlineAccent: "Gavetão a gás. Estrutura que dura décadas.",
  sub: "Colchas, roupas de cama, cobertores extra, lençóis de reserva — tudo dentro da cama. O quarto fica livre, você dorme melhor, e a Marcela entrega e monta amanhã em Araruama.",
  ctaLabel: "Falar com Marcela sobre tamanhos",
  ctaSubtext: "Ela manda foto do gavetão aberto antes de você decidir",
  wa: WA_AR,
  scarcityText: "🚚 <strong>Entrega amanhã</strong> disponível para pedidos até hoje à tarde em Araruama, Saquarema e Iguaba Grande",
  scarcityEmoji: "📦",
  accentClasses: BLUE_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900",
  features: [
    {
      icon: "bed",
      title: "Gavetão a Gás — Abre com Dois Dedos",
      desc: "Sistema pistão a gás europeu: empurra levemente e abre suave até o fim. Não precisa esvaziar para abrir, não bate no pé da cama, não force a coluna. Capacidade real para 80 kg de carga.",
      colorClass: "bg-blue-50 text-blue-700",
    },
    {
      icon: "shield",
      title: "MDF 25mm — Estrutura de Longa Duração",
      desc: "Painel MDF de alta densidade com acabamento BP importado. Resistente à umidade do litoral, não emite VOC, suporta 400 kg. Não é o MDF de 15mm que você vê nas lojas de departamento.",
      colorClass: "bg-slate-100 text-slate-700",
    },
    {
      icon: "check",
      title: "Marcela Mede Antes de Você Comprar",
      desc: "Manda a foto do seu quarto pelo WhatsApp. Ela te diz qual tamanho entra, como o gavetão vai abrir, qual acabamento combina. Você não descobre surpresa na hora da entrega.",
      colorClass: "bg-emerald-50 text-emerald-700",
    },
    {
      icon: "award",
      title: "Colchão Castor Calibrado para o Conjunto",
      desc: "Cada modelo de box baú tem altura certa para o colchão indicado. Marcela combina base + colchão para o perfil do casal — sem deixar a cama alta demais ou o colchão sem suporte.",
      colorClass: "bg-amber-50 text-amber-700",
    },
    {
      icon: "rotate",
      title: "Solteiro a King — Sob Medida se Precisar",
      desc: "Medidas padrão ou sob medida para quartos com nicho, recuo ou planta irregular. Off-white, caramelo, tabaco ou grafite. Prazo sob medida: 15 dias úteis.",
      colorClass: "bg-violet-50 text-violet-700",
    },
    {
      icon: "zap",
      title: "Equipe Própria — Entrega Sem Terceiro",
      desc: "Não terceirizamos. Nossa equipe sai da loja, entrega no andar que for, monta no local certo e retira cada pedaço de papelão e plástico. Você assina com a cama no lugar.",
      colorClass: "bg-blue-50 text-blue-700",
    },
  ],
  reviews: [
    {
      name: "Tatiane R.",
      city: "Araruama",
      time: "há 1 semana",
      initials: "TR",
      text: "Meu quarto era uma bagunça de coberta jogada em cima de tudo. Depois do box baú: tudo dentro da cama, quarto limpo, eu mais tranquila. Marcela me ajudou a escolher o tamanho certo antes de comprar. Entregaram e montaram em 2 horas.",
    },
    {
      name: "Márcio F.",
      city: "Saquarema",
      time: "há 3 semanas",
      initials: "MF",
      text: "Comparei com camas baú do Mercado Livre e de magazines. Fui pessoalmente ver a estrutura da Castor e entendi a diferença. Isso aqui é pesado, sólido, para durar 15 anos. O barато sai caro — aprendi da pior forma na última vez.",
    },
    {
      name: "Patrícia D.",
      city: "Iguaba Grande",
      time: "há 2 semanas",
      initials: "PD",
      text: "Meu quarto tem um nicho e eu não sabia se ia caber. Mandei foto para a Marcela e ela resolveu tudo — me disse exatamente qual modelo, como abriria o gavetão, se bateria na parede. Chegou perfeito.",
    },
    {
      name: "Edilson C.",
      city: "Araruama",
      time: "há 1 mês",
      initials: "EC",
      text: "Comprei queen size. Equipe chegou no horário certo, montagem em 45 minutos, pegaram toda embalagem. Minha esposa ficou tão satisfeita que já está mandando a Marcela para a mãe dela.",
    },
    {
      name: "Kátia S.",
      city: "Maricá",
      time: "há 5 semanas",
      initials: "KS",
      text: "5 estrelas para a Marcela especificamente. Ela não tentou me vender o mais caro. Me indicou o tamanho certo para o meu quarto e o colchão adequado para mim e meu marido. Resultado: casal dorme bem, quarto organizado. Simples assim.",
    },
  ],
  faq: [
    {
      q: "O gavetão a gás aguenta muito peso?",
      a: "O sistema de pistão a gás suporta 80 kg de carga distribuída. A estrutura da base suporta 400 kg com distribuição uniforme. Para referência: colchas, roupas, toalhas e lençóis extras de um casal pesam entre 15 e 25 kg no total.",
    },
    {
      q: "Posso ver o modelo antes de comprar?",
      a: "Sim, pode vir à loja em Araruama ou mandar foto do seu quarto pelo WhatsApp. Marcela te diz qual tamanho entra, como o gavetão abre, qual acabamento combina com o ambiente. Sem surpresa na entrega.",
    },
    {
      q: "A montagem está mesmo incluída ou é cobrada à parte?",
      a: "100% incluída. Nossa equipe monta a base, posiciona o colchão, nivela os pés, organiza e retira toda embalagem. Nenhum custo adicional para Araruama, Saquarema, Iguaba Grande, Maricá e região.",
    },
    {
      q: "E se não couber no meu quarto após a entrega?",
      a: "Por isso a Marcela faz a análise antes da entrega — não depois. Em 3 anos de cama box baú, zero devoluções por 'não coube'. Se você mandar a foto do quarto, ela garante que vai caber antes de você confirmar.",
    },
    {
      q: "Qual o prazo de garantia da estrutura?",
      a: "3 anos para a estrutura MDF e 2 anos para o sistema a gás. O colchão tem garantia Castor separada: 3 anos para modelos espuma e 5 anos para modelos de mola. Tudo com nota fiscal e atendimento pelo WhatsApp.",
    },
  ],
  quizTitle: "Qual conjunto é certo para você?",
  quizSub: "3 perguntas e Marcela te indica base + colchão calibrados para o seu perfil de sono.",
  garantiaText: "✅ Entrega e montagem grátis. Estrutura 3 anos + gás 2 anos. Marcela resolve qualquer detalhe pelo WhatsApp.",
  cidade: "Araruama",
  mapLink: "https://maps.app.goo.gl/cGmvFgeubawLRNGy8",
  endereco: "Castor Colchões Araruama — Araruama – RJ",
  images: {
    storeInterior: "/lp/loja-interior.png",
    productShot:   "/lp/colchao-premium.png",
    sleepScience:  "/lp/sono-ciencia.png",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LP 3 · /lp/outlet · "Black Friday acontece aqui todo mês"
// Persona: comprador de preço que desconfia de promoção
// Gatilho emocional: ceticismo → prova → alívio de poupar SEM abrir mão
// ─────────────────────────────────────────────────────────────────────────────

export const cfgOutlet: LPConfig = {
  pageTitle: "Outlet Castor Colchões — Até 55% OFF com Garantia Total | Cabo Frio e Araruama",
  metaDescription: "Outlet oficial Castor Colchões com até 55% de desconto. Produto original certificado INER, mesma garantia de fábrica, sem defeitos escondidos. Estoque limitado. Cabo Frio e Araruama.",
  badge: "Outlet Oficial · Garantia total inclusa · ⭐ 5.0 Google",
  h1: "Outlet Castor — Colchão Premium com até 55% OFF. Garantia Igual ao Regular.",
  headlineLine1: "A Castor não espera novembro",
  headlineLine2: "para dar desconto de verdade.",
  headlineAccent: "Outlet real. Todo mês. Garantia intacta.",
  sub: "Não é descarte. Não é produto com defeito escondido. São lotes específicos com oportunidade comercial real — mesma certificação INER, mesma garantia de fábrica, preço que faz sentido. ThallesZzz te mostra o laudo antes de você decidir.",
  ctaLabel: "Ver o que tem no outlet agora",
  ctaSubtext: "ThallesZzz mostra o laudo de cada peça · Sem pressão de venda",
  wa: WA_CF,
  waAlt: WA_AR,
  scarcityText: "🏷️ <strong>Outlet atualizado esta semana</strong> — peças saem em dias, não meses. ThallesZzz te avisa quando entrar novidade.",
  scarcityEmoji: "🔥",
  accentClasses: RED_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-950 via-red-950 to-slate-900",
  features: [
    {
      icon: "award",
      title: "Laudo INER em Cada Peça",
      desc: "Antes de qualquer venda do outlet, ThallesZzz te mostra o laudo técnico. Densidade real, certificação real. Se não tiver laudo, não entra no outlet. É regra da casa.",
      colorClass: "bg-red-50 text-red-700",
    },
    {
      icon: "shield",
      title: "Mesma Garantia de Fábrica — Sem Redução",
      desc: "O desconto não vem da garantia. Outlet Castor tem 3 anos para espuma e 5 anos para mola — igual ao produto regular. Você economiza no preço, não na proteção.",
      colorClass: "bg-emerald-50 text-emerald-700",
    },
    {
      icon: "check",
      title: "Venha Testar Antes de Comprar",
      desc: "Pode vir à loja, deitar, comparar com o modelo regular e decidir. ThallesZzz explica a diferença de cada peça — por que está no outlet, o que muda, o que não muda.",
      colorClass: "bg-blue-50 text-blue-700",
    },
    {
      icon: "zap",
      title: "PIX à Vista Ganha 5% a Mais",
      desc: "O desconto já é real. Com PIX ou dinheiro você ainda ganha 5% adicional. Parcelamento em até 12x no cartão sem esse bônus. Transparência total — sem taxa escondida.",
      colorClass: "bg-amber-50 text-amber-700",
    },
    {
      icon: "trending",
      title: "Lista VIP de WhatsApp — Seja o Primeiro",
      desc: "O outlet bom vai rápido. Clientes da lista VIP recebem foto e laudo antes do estoque aparecer no Instagram. Manda 'OUTLET VIP' no WhatsApp e entra na lista.",
      colorClass: "bg-violet-50 text-violet-700",
    },
    {
      icon: "heart",
      title: "Atendimento Igual ao Premium",
      desc: "Não existe 'atendimento de outlet' aqui. ThallesZzz e Marcela atendem com o mesmo diagnóstico de sono gratuito, mesma indicação personalizada. O preço caiu — o cuidado não.",
      colorClass: "bg-pink-50 text-pink-700",
    },
  ],
  reviews: [
    {
      name: "Renato C.",
      city: "Cabo Frio",
      time: "há 2 semanas",
      initials: "RC",
      text: "Cheguei desconfiado. 'Outlet de colchão' geralmente é produto com defeito ou densidades mentirosas. ThallesZzz colocou o laudo na minha frente antes de eu perguntar. Comprei queen size com 48% de desconto. Garantia completa. Durmo bem desde então.",
    },
    {
      name: "Viviane O.",
      city: "São Pedro da Aldeia",
      time: "há 1 mês",
      initials: "VO",
      text: "Estava esperando a Black Friday. Uma amiga me mandou mensagem: 'a Castor tem outlet todo mês, vai lá'. Comprei em setembro com desconto igual ou maior que novembro. Não precisei esperar 3 meses dormindo mal.",
    },
    {
      name: "Bruno T.",
      city: "Araruama",
      time: "há 3 semanas",
      initials: "BT",
      text: "Comprei pelo outlet e economizei R$ 920 em comparação ao preço regular. Mesmo produto, mesmo laudo, mesma garantia. ThallesZzz foi honesto: 'é lote anterior, mas tecnologia é a mesma'. Confiança que vale mais que desconto.",
    },
    {
      name: "Leila N.",
      city: "Búzios",
      time: "há 5 semanas",
      initials: "LN",
      text: "Entrei na lista VIP do WhatsApp e recebi aviso antes de aparecer nas redes sociais. Reservei na hora. O colchão que queria estava disponível por quase metade do preço. Sistema que funciona.",
    },
    {
      name: "Adilson F.",
      city: "Iguaba Grande",
      time: "há 2 meses",
      initials: "AF",
      text: "Comprei cama box baú inteira pelo outlet: base + colchão. Economia de R$ 1.200 em relação ao regular. A Marcela explicou cada detalhe, por que estava no outlet, o que diferia. Zero surpresa em 2 meses de uso.",
    },
  ],
  faq: [
    {
      q: "Qual é a real diferença entre outlet e o produto regular?",
      a: "São produtos originais Castor com certificação completa vendidos em condições especiais: lote anterior, oportunidade comercial com o fabricante, ou peça de exposição com mínima marca invisível no uso. A garantia de fábrica é integral — não reduzimos nada. ThallesZzz mostra o laudo de cada peça antes da venda.",
    },
    {
      q: "Como sei que não tem defeito escondido?",
      a: "Cada peça do outlet passa por vistoria presencial antes de entrar no estoque. Você pode vir à loja e testar pessoalmente. O laudo técnico fica disponível para consulta. Se tiver qualquer dúvida, ThallesZzz explica o motivo do preço especial sem esconder nada.",
    },
    {
      q: "A garantia é realmente igual ao produto regular?",
      a: "Sim. 3 anos para modelos espuma, 5 anos para modelos de mola. Mesma cobertura, mesma nota fiscal, mesmo sistema de atendimento. O desconto vem do preço, não da proteção.",
    },
    {
      q: "O estoque sai rápido?",
      a: "Sim. As melhores peças saem em 2 a 4 dias. Por isso criamos a lista VIP de WhatsApp — clientes da lista recebem foto e laudo antes do estoque ser divulgado publicamente. Manda 'OUTLET VIP' no (22) 99241-0112 para entrar.",
    },
    {
      q: "Posso parcelar compras no outlet?",
      a: "Sim, em até 12x no cartão de crédito. PIX ou dinheiro à vista ganham 5% de desconto adicional sobre o preço já reduzido. Entrega grátis para Cabo Frio, Araruama e cidades próximas.",
    },
  ],
  quizTitle: "Qual outlet resolve o seu sono?",
  quizSub: "3 perguntas e ThallesZzz te mostra qual peça do outlet é exata para o seu perfil.",
  garantiaText: "✅ Garantia integral em todos os produtos do outlet. Laudo INER disponível para consulta antes da compra.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Cabo Frio + Araruama – RJ",
  images: {
    storeInterior: "/lp/loja-interior.png",
    productShot:   "/lp/colchao-premium.png",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LP 4 · /lp/saude-coluna · "Você deita na dor toda noite sem saber"
// Persona: quem acorda com dor, já foi ao médico, não ligou o colchão à dor
// Gatilho emocional: revelação + urgência de saúde + culpa do instrumento certo
// ─────────────────────────────────────────────────────────────────────────────

export const cfgSaudeColuna: LPConfig = {
  pageTitle: "Colchão para Dor nas Costas — Diagnóstico Gratuito | Castor Cabo Frio",
  metaDescription: "Você não acorda com dor — você deita nela toda noite sem saber. Diagnóstico gratuito de sono com ThallesZzz. Colchões ortopédicos certificados INER. Castor Colchões Cabo Frio.",
  badge: "Coluna · Diagnóstico gratuito · ⭐ 5.0 Google",
  h1: "Dor nas Costas ao Acordar? O Problema Pode Ser o Colchão — Diagnóstico Grátis",
  headlineLine1: "Você não acorda com dor.",
  headlineLine2: "Você deita nela toda noite",
  headlineAccent: "e só percebe pela manhã.",
  sub: "O colchão errado comprime os discos vertebrais durante 8 horas, toda noite, enquanto você dorme. Diagnóstico gratuito com ThallesZzz: ele identifica qual modelo resolve o seu caso específico — não o 'ortopédico' genérico que pode estar piorando.",
  ctaLabel: "Fazer diagnóstico gratuito agora",
  ctaSubtext: "Sem compromisso de compra · ThallesZzz responde direto, sem script",
  wa: WA_CF,
  scarcityText: "🩺 <strong>Diagnóstico gratuito</strong> — vagas limitadas esta semana. ThallesZzz atende por ordem de chegada no WhatsApp.",
  scarcityEmoji: "🦴",
  accentClasses: EMERALD_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900",
  features: [
    {
      icon: "shield",
      title: "O Colchão 'Ortopédico' Pode Estar Piorando",
      desc: "No Brasil, 'ortopédico' não é regulamentado — qualquer fabricante pode usar o termo. O que determina suporte real é a certificação INER, a densidade real e o tipo de mola. ThallesZzz explica a diferença antes de qualquer indicação.",
      colorClass: "bg-emerald-50 text-emerald-700",
    },
    {
      icon: "zap",
      title: "Firmeza Errada = Mais Dor",
      desc: "Colchão muito duro pressiona a coluna lateral. Muito mole deixa a coluna arqueada. A firmeza certa depende do SEU peso e posição de dormir — não existe padrão universal. O diagnóstico resolve isso.",
      colorClass: "bg-blue-50 text-blue-700",
    },
    {
      icon: "award",
      title: "Molas Independentes para Hérnia de Disco",
      desc: "Para hérnia L4-L5 ou L5-S1, o Pocket Spring distribui a pressão intradiscal de forma uniforme. É a diferença entre 8 horas comprimindo o disco ou 8 horas aliviando. ThallesZzz tem clientes que relatam melhora em 3 noites.",
      colorClass: "bg-amber-50 text-amber-700",
    },
    {
      icon: "heart",
      title: "Diagnóstico Personalizado — Não Genérico",
      desc: "ThallesZzz analisa: posição de dormir, peso, histórico de dores, se usa travesseiro ortopédico, temperatura do quarto. A indicação final é específica para você — não 'tente esse modelo e veja'.",
      colorClass: "bg-rose-50 text-rose-700",
    },
    {
      icon: "wind",
      title: "Temperatura é Parte da Cura",
      desc: "Dor crônica piora com calor noturno — o corpo não entra no sono profundo, a musculatura não relaxa, a recuperação não acontece. Colchão com regulação térmica resolve dois problemas de uma vez.",
      colorClass: "bg-cyan-50 text-cyan-700",
    },
    {
      icon: "trending",
      title: "30 Dias para Sentir a Diferença",
      desc: "Se em 30 dias você não notar melhora nas dores matinais, trocamos o colchão sem custo. A maioria dos clientes relata diferença em 3 a 7 noites. Essa é a garantia que ThallesZzz oferece.",
      colorClass: "bg-violet-50 text-violet-700",
    },
  ],
  reviews: [
    {
      name: "Rosana A.",
      city: "Cabo Frio",
      time: "há 3 semanas",
      initials: "RA",
      text: "Hérnia de disco L4-L5. Ortopedista me disse para trocar o colchão há 2 anos. Fui adiando. ThallesZzz fez o diagnóstico pelo WhatsApp, perguntou meu peso, posição de dormir, qual lado dói mais. Indicou o Pocket Ortopédico Medium. Em 5 dias a dor matinal reduziu 70%. Deveria ter ouvido o ortopedista antes.",
    },
    {
      name: "Sérgio M.",
      city: "São Pedro da Aldeia",
      time: "há 1 mês",
      initials: "SM",
      text: "4 anos acordando com dor nas costas. Fisioterapia, acupuntura, anti-inflamatório. Nunca ninguém me perguntou sobre o colchão. ThallesZzz perguntou na primeira mensagem. Mudei o colchão. A dor sumiu em 1 semana. Quatro anos perdidos.",
    },
    {
      name: "Dr. Fernando G.",
      city: "Cabo Frio",
      time: "há 6 semanas",
      initials: "FG",
      text: "Fisioterapeuta há 18 anos. Comecei a indicar a Castor para pacientes com lombalgia crônica. ThallesZzz tem conhecimento técnico que supera vendedores de lojas especializadas que conheço. Ele não vende colchão — resolve o problema.",
    },
    {
      name: "Ana Paula T.",
      city: "Arraial do Cabo",
      time: "há 2 semanas",
      initials: "AT",
      text: "Achei que era stress do trabalho. Chiropratica por 6 meses. Melhorava na sessão, voltava a dor em 3 dias. ThallesZzz me mostrou que estava dormindo num colchão D18 com etiqueta D33. Era o colchão afundando todo noite. Nunca mais.",
    },
    {
      name: "Cláudio R.",
      city: "Búzios",
      time: "há 1 mês",
      initials: "CR",
      text: "Espondilite anquilosante. Meu reumatologista disse que o colchão era parte do tratamento. ThallesZzz estudou minha condição, consultou os modelos disponíveis e me indicou o exato. Resultado acima do esperado. Recomendo para qualquer paciente com condição de coluna.",
    },
  ],
  faq: [
    {
      q: "Como o colchão causa dor nas costas se parece confortável?",
      a: "Colchão ruim causa dor gradualmente — não de uma vez. A espuma vai perdendo densidade (especialmente se for D18 ou D20 real), a coluna começa a ficar em posição errada durante o sono e os músculos paravertebrais ficam em tensão constante. O problema aparece ao acordar, mas o dano acontece toda noite.",
    },
    {
      q: "O diagnóstico com ThallesZzz é realmente gratuito?",
      a: "Sim, 100% gratuito e sem compromisso de compra. ThallesZzz analisa seu caso pelo WhatsApp: posição de dormir, peso, lado da dor, histórico. A indicação é sua para fazer o que quiser. A maioria compra porque entende a lógica — não por pressão.",
    },
    {
      q: "Qual firmeza é certa para quem tem dor na coluna?",
      a: "Depende do peso e posição de dormir. Quem dorme de lado com dor no ombro precisa de mola mais responsiva para não pressionar o ombro. Quem dorme de costas com lombalgia precisa de suporte médio-firme na região lombar. Não existe resposta genérica — por isso o diagnóstico existe.",
    },
    {
      q: "Tenho hérnia de disco. Qual modelo específico me ajuda?",
      a: "Para hérnia lumbar (L4-L5 ou L5-S1), geralmente indicamos Castor Pocket Ortopédico Medium — distribui pressão intradiscal de forma uniforme. Para hérnia cervical, a indicação muda. ThallesZzz precisa do seu perfil completo para indicar corretamente.",
    },
    {
      q: "Em quanto tempo sinto diferença?",
      a: "Entre 3 e 7 noites para a maioria dos clientes. O corpo precisa de tempo para adaptar a musculatura à postura correta de sono. Se em 30 dias não houver melhora perceptível, trocamos o colchão sem custo — sem burocracia.",
    },
  ],
  quizTitle: "Qual colchão resolve a sua dor?",
  quizSub: "3 perguntas e ThallesZzz te indica o modelo certo para o seu perfil ortopédico.",
  garantiaText: "✅ 30 dias para sentir melhora. Se não notar diferença nas dores, trocamos o colchão. Garantia de saúde, não só de produto.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Jardim Flamboyant, Cabo Frio – RJ",
  images: {
    heroBg:        "/lp/lifestyle-acordar.png",
    storeInterior: "/lp/loja-interior.png",
    productShot:   "/lp/colchao-goldstar.jpg",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LP 5 · /lp/entrega-24h · "23h descobriu. 8h entregou."
// Persona: mudança de casa, colchão quebrado de repente, urgência real
// Gatilho emocional: alívio de urgência + confiança em solução imediata
// ─────────────────────────────────────────────────────────────────────────────

export const cfgEntrega24h: LPConfig = {
  pageTitle: "Entrega de Colchão em 24h — Cabo Frio, Macaé e Região dos Lagos | Castor",
  metaDescription: "Entrega de colchão em 24h para Cabo Frio, Macaé, Araruama e toda a Região dos Lagos. Equipe própria, montagem grátis inclusa, sem taxa extra. Castor Colchões — ⭐ 5.0 Google.",
  badge: "Entrega 24h · Macaé + Região dos Lagos · Equipe própria",
  h1: "Colchão Entregue em 24h — Cabo Frio, Macaé e Toda a Região dos Lagos",
  headlineLine1: "Às 23h você descobriu",
  headlineLine2: "que precisa de um colchão novo.",
  headlineAccent: "Às 8h ele está na sua porta.",
  sub: "Equipe própria de entrega — não terceirizada. Macaé, Cabo Frio, Araruama e toda a Região dos Lagos. Montagem grátis incluída. ThallesZzz confirma a data antes de você pagar.",
  ctaLabel: "Confirmar entrega amanhã agora",
  ctaSubtext: "ThallesZzz confirma disponibilidade em minutos · Sem surpresa",
  wa: WA_CF,
  waAlt: WA_AR,
  scarcityText: "⚡ <strong>Últimas datas de entrega expressa desta semana</strong> — confirme disponibilidade antes que sua data seja preenchida",
  scarcityEmoji: "🚚",
  accentClasses: VIOLET_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900",
  features: [
    {
      icon: "zap",
      title: "Equipe Própria — Zero Terceirização",
      desc: "Nossa equipe sai da loja com o colchão. Nenhuma transportadora, nenhum motoboy, nenhum risco de amassado ou entrega na portaria. A responsabilidade vai do nosso depósito à sua cama.",
      colorClass: "bg-violet-50 text-violet-700",
    },
    {
      icon: "check",
      title: "ThallesZzz Confirma Antes de Você Pagar",
      desc: "Antes de qualquer cobrança, ele confirma disponibilidade da data para o seu endereço. Sem 'prazo estimado' vago. Você confirma a data exata — aí decide se compra.",
      colorClass: "bg-emerald-50 text-emerald-700",
    },
    {
      icon: "shield",
      title: "Montagem Completa Sempre Inclusa",
      desc: "Equipe monta base, posiciona colchão, nivela pés e retira absolutamente tudo de embalagem: papelão, plástico, isopor. Você não empurra nada, não dobra nada, não descarta nada.",
      colorClass: "bg-blue-50 text-blue-700",
    },
    {
      icon: "trending",
      title: "Macaé, Cabo Frio, Toda a Região dos Lagos",
      desc: "Cabo Frio, Araruama, Búzios, Arraial do Cabo, São Pedro da Aldeia, Iguaba Grande, Saquarema e Macaé. Cidades intermediárias: consulte no WhatsApp. Em geral conseguimos em 24 a 48h.",
      colorClass: "bg-amber-50 text-amber-700",
    },
    {
      icon: "award",
      title: "Checklist Antes de Sair da Loja",
      desc: "Cada entrega sai com checklist: embalagem íntegra, dimensão conferida, produto sem danos. Você assina o recebimento com garantia imediata na mão. Se chegar com problema, resolvemos no ato.",
      colorClass: "bg-red-50 text-red-700",
    },
    {
      icon: "moon",
      title: "Manhã, Tarde ou Horário Específico",
      desc: "Manhã 8h–12h, tarde 13h–17h ou horário específico se combinar antes. Seg–Sáb. Para urgência de chegada em dia específico, ThallesZzz organiza o roteiro na noite anterior.",
      colorClass: "bg-slate-100 text-slate-700",
    },
  ],
  reviews: [
    {
      name: "Silvia T.",
      city: "Cabo Frio",
      time: "há 1 semana",
      initials: "ST",
      text: "Colchão do filho furou às 21h de uma sexta. Mandei mensagem para o ThallesZzz às 22h sem esperança. Ele respondeu, confirmou entrega para sábado às 10h. Chegaram às 9h50. Meu filho dormiu bem na sexta — eu entrei em desespero desnecessário.",
    },
    {
      name: "Paulo H.",
      city: "Macaé",
      time: "há 2 semanas",
      initials: "PH",
      text: "Funcionário meu precisava de colchão urgente. Comprei segunda-feira às 11h, entregaram em Macaé na terça às 14h. De Cabo Frio para Macaé em menos de 24h com montagem inclusa. Impossível? Para a Castor não.",
    },
    {
      name: "Fernanda A.",
      city: "Arraial do Cabo",
      time: "há 3 semanas",
      initials: "FA",
      text: "Mudança de casa de última hora. Cheguei numa casa vazia sem colchão. ThallesZzz organizou tudo pelo WhatsApp — modelo, tamanho, endereço, data. Equipe chegou no horário certo, montou, levou embalagem. Como se fosse serviço de hotel.",
    },
    {
      name: "Ricardo B.",
      city: "São Pedro da Aldeia",
      time: "há 1 mês",
      initials: "RB",
      text: "Recebi notificação de saída pelo WhatsApp, previsão de chegada em tempo real. Equipe chegou exatamente no horário. Profissionalismo que não esperava de loja local. Superou concorrente que prometeu em 3 dias e atrasou 5.",
    },
    {
      name: "Márcia K.",
      city: "Búzios",
      time: "há 5 semanas",
      initials: "MK",
      text: "Segunda entrega que faço aqui. A primeira foi ótima. A segunda foi ainda melhor — parece que a equipe melhorou. Isso se chama compromisso com qualidade, não sorte. Castor em Búzios tem nome por razão.",
    },
  ],
  faq: [
    {
      q: "Como confirmo que a entrega em 24h está disponível para o meu endereço?",
      a: "Manda mensagem para ThallesZzz no WhatsApp com seu endereço e a data desejada. Ele confirma disponibilidade em minutos — antes de qualquer cobrança. Se não conseguir em 24h, ele te diz o prazo real e você decide.",
    },
    {
      q: "A entrega em 24h tem custo adicional?",
      a: "Não. Entrega e montagem são incluídas sem custo extra para toda a área de cobertura, independente do prazo ser 24h ou 48h. O preço que ThallesZzz te passa é o preço final — sem taxa de urgência.",
    },
    {
      q: "E se chegar com algum problema?",
      a: "Cada entrega sai com checklist de qualidade e você assina o recebimento. Se chegar com qualquer problema, acionamos o protocolo na hora — substituição ou reparo. Em 3 anos de entrega própria, menos de 0,5% de ocorrência.",
    },
    {
      q: "Posso escolher o horário exato?",
      a: "Sim. Ao confirmar com ThallesZzz, você indica a janela preferida: manhã 8h–12h, tarde 13h–17h ou horário específico se combinar antes. Enviamos confirmação e aviso 1h antes da chegada pelo WhatsApp.",
    },
    {
      q: "Vocês entregam em Macaé com frequência?",
      a: "Sim. Macaé está dentro da nossa rota regular de entrega. ThallesZzz organiza o roteiro para garantir prazo. Para Macaé o prazo típico é 24 a 48h a partir da confirmação do pedido.",
    },
  ],
  quizTitle: "Qual colchão entregamos amanhã para você?",
  quizSub: "3 perguntas e ThallesZzz confirma data de entrega para o modelo certo.",
  garantiaText: "✅ ThallesZzz confirma a data antes de você pagar. Entrega e montagem grátis. Equipe própria, sem terceirização.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Cabo Frio + Araruama – RJ",
  images: {
    storeInterior: "/lp/loja-interior.png",
    productShot:   "/lp/colchao-goldstar.jpg",
  },
};
