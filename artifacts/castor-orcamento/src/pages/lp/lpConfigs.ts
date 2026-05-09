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

// ── LP 1: Colchões de Luxo — Cabo Frio ────────────────────────────────────────

export const cfgLuxo: LPConfig = {
  pageTitle: "Colchões Premium em Cabo Frio | Castor Colchões ⭐ 5.0 Google",
  metaDescription: "A melhor loja de colchões de luxo em Cabo Frio. Tecnologia Pocket® Spring suíça, gel térmico e 25 anos de especialização. Única loja com nota 5.0 no Google. Entrega grátis.",
  badge: "Colchões Premium · Cabo Frio · ⭐ 5.0 Google",
  h1: "Colchões de Luxo em Cabo Frio — Tecnologia Suíça, Entrega Grátis",
  headlineLine1: "Não troque de colchão.",
  headlineLine2: "Invista no sono.",
  headlineAccent: "Tecnologia suíça em Cabo Frio.",
  sub: "O único showroom com Pocket® Spring autêntico, gel térmico suíço e molas Tecnopedic® na Região dos Lagos. Diagnóstico gratuito, entrega e montagem incluídos.",
  ctaLabel: "Ver modelos premium",
  ctaSubtext: "Sem compromisso · Resposta imediata de ThallesZzz",
  wa: WA_CF,
  scarcityText: "🔥 <strong>Estoque limitado</strong> — apenas 4 unidades dos modelos premium disponíveis esta semana em Cabo Frio",
  scarcityEmoji: "👑",
  accentClasses: AMBER_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900",
  features: [
    { icon: "zap", title: "Pocket® Spring Autêntico", desc: "Molas pré-comprimidas de aço temperado: quando um parceiro se move, o outro não sente. Suporte individualizado real, não simulado.", colorClass: "bg-amber-50 text-amber-600" },
    { icon: "wind", title: "Fresh Comfort Gel®", desc: "Partículas de gel suíço dissipam o calor e mantêm 18–22°C durante toda a noite. Acabou o calor noturno que te acorda.", colorClass: "bg-blue-50 text-blue-600" },
    { icon: "shield", title: "Actigard® Anti-ácaros", desc: "Tratamento suíço permanente que elimina ácaros, fungos e bactérias. Essencial para rinite e alergias — diferencial técnico real.", colorClass: "bg-emerald-50 text-emerald-600" },
    { icon: "award", title: "ISO 9001 Certificado INER", desc: "A única certificação que garante que a densidade declarada na etiqueta é real. D33 = 33 kg/m³ real, sem carga mineral.", colorClass: "bg-red-50 text-red-600" },
    { icon: "rotate", title: "Double Face Life+", desc: "Rotacionar dos dois lados distribui o desgaste e aumenta a durabilidade em até 50%. Projetado para durar 12+ anos.", colorClass: "bg-violet-50 text-violet-600" },
    { icon: "star", title: "Molas Tecnopedic®", desc: "Aço carbono com alto teor de manganês, temperado eletronicamente. Mantém o suporte ortopédico sem afundar ao longo dos anos.", colorClass: "bg-amber-50 text-amber-600" },
  ],
  reviews: [
    { name: "Ana Beatriz S.", city: "Cabo Frio", time: "há 2 semanas", initials: "AB", text: "Investi no modelo premium e foi a melhor decisão da minha vida. A qualidade das molas é incomparável com tudo que testei antes. ThallesZzz conhece cada detalhe técnico. Não tem como comparar com loja genérica." },
    { name: "Roberto M.", city: "Búzios", time: "há 1 mês", initials: "RM", text: "Pesquisei 3 meses antes de comprar. Visitei 6 lojas diferentes. Nenhuma tinha o nível de conhecimento técnico do Thalles. Ele explicou diferença de espuma, mola, densidades. Comprei com total confiança." },
    { name: "Fernanda L.", city: "Arraial do Cabo", time: "há 3 semanas", initials: "FL", text: "Dormia mal há anos, achava que era insônia. Era o colchão. O Castor Premium com gel térmico mudou tudo — acordo descansada pela primeira vez em muito tempo. Vale cada centavo." },
    { name: "Gustavo P.", city: "Cabo Frio", time: "há 5 dias", initials: "GP", text: "Entrega impecável, montagem incluída. Equipe cuidadosa. O colchão chegou embalado a vácuo, expandiu perfeitamente em 24h. Superou minhas expectativas de uma loja local." },
    { name: "Mariana C.", city: "São Pedro da Aldeia", time: "há 2 meses", initials: "MC", text: "Comprei o Pocket Spring e meu marido parou de acordar com minhas viradas. As molas independentes realmente funcionam. Diferença imediata na primeira noite." },
  ],
  faq: [
    { q: "O que diferencia o Pocket® Spring dos outros colchões de mola?", a: "O Pocket® Spring usa molas individuais embaladas separadamente. Cada mola se move de forma independente, sem conectar-se com as vizinhas. Isso elimina 100% a transferência de movimento entre parceiros e proporciona suporte personalizado para cada parte do corpo." },
    { q: "Qual é o prazo de entrega para Cabo Frio?", a: "Para Cabo Frio e região imediata, trabalhamos com entrega em até 48 horas úteis. Em muitos casos conseguimos fazer na data que você preferir, incluindo sábados. A montagem e retirada da embalagem são incluídas sem custo adicional." },
    { q: "O gel térmico realmente funciona ou é marketing?", a: "É tecnologia real, certificada. As micropartículas de gel inseridas no tecido de cobertura absorvem o calor corporal por condução e o dissipam para o ambiente. Isso mantém a temperatura da superfície entre 18–22°C, ideal para o sono REM. Testado e certificado pelo fabricante suíço." },
    { q: "Qual a garantia dos colchões Castor premium?", a: "Os modelos premium têm garantia de 5 anos contra defeitos de fabricação. Se você não se adaptar ao colchão nos primeiros 30 dias, podemos trocar pelo modelo mais adequado ao seu perfil. Zero burocracia — só trazemos e levamos." },
    { q: "Preciso de nota fiscal para garantia?", a: "Sim, toda compra na Castor inclui nota fiscal eletrônica. Você recebe por e-mail automaticamente e também em papel na entrega. Nossa garantia é registrada em sistema — basta nos contatar pelo WhatsApp com o número do pedido." },
  ],
  quizTitle: "Qual é o seu colchão ideal?",
  quizSub: "Responda 3 perguntas e receba uma indicação personalizada para o seu perfil de sono.",
  garantiaText: "✅ Garantia Castor: se você não dormir melhor em 30 dias, trocamos o colchão. Sem burocracia, sem perguntas difíceis.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Jardim Flamboyant, Cabo Frio – RJ",
};

// ── LP 2: Cama Box Baú — Araruama ─────────────────────────────────────────────

export const cfgBoxBau: LPConfig = {
  pageTitle: "Cama Box Baú em Araruama | Castor Colchões — Entrega e Montagem Grátis",
  metaDescription: "Cama Box Baú em Araruama com entrega e montagem grátis. Base premium com gavetão + colchão Castor. Única loja 5.0 no Google da região. Fale com a Marcela agora.",
  badge: "Cama Box Baú · Araruama · ⭐ 5.0 Google",
  h1: "Cama Box Baú em Araruama — Mais Espaço, Mais Conforto, Entrega Grátis",
  headlineLine1: "Organize o seu quarto.",
  headlineLine2: "Durma melhor.",
  headlineAccent: "Box Baú com entrega em Araruama.",
  sub: "Base premium com gavetão de alta capacidade + colchão Castor de alto desempenho. Entrega e montagem grátis em Araruama, Saquarema e Iguaba Grande.",
  ctaLabel: "Ver modelos Box Baú",
  ctaSubtext: "Sem compromisso · Marcela responde na hora",
  wa: WA_AR,
  scarcityText: "🚚 <strong>Entrega e montagem grátis</strong> disponível apenas para os próximos 5 pedidos em Araruama esta semana",
  scarcityEmoji: "📦",
  accentClasses: BLUE_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900",
  features: [
    { icon: "bed", title: "Gavetão de Alta Capacidade", desc: "Base baú com abertura a gás — abre suavemente sem esforço. Capacidade para colchas, roupas extras e qualquer item que precisa de espaço no quarto.", colorClass: "bg-blue-50 text-blue-600" },
    { icon: "shield", title: "Estrutura MDF 25mm", desc: "Painel MDF de alta densidade com acabamento BP. Não emite VOC, resiste à umidade típica do litoral. Estrutura testada para 400 kg de carga.", colorClass: "bg-slate-100 text-slate-600" },
    { icon: "check", title: "Montagem Profissional", desc: "Nossa equipe de montagem vai até você, monta a cama no local certo, nivela os pés e retira toda embalagem. Você só precisa aproveitar.", colorClass: "bg-emerald-50 text-emerald-600" },
    { icon: "award", title: "Colchão Castor Incluso", desc: "Cada conjunto vem com o colchão Castor compatível com o perfil do casal. Combinação testada para durabilidade e suporte ortopédico.", colorClass: "bg-amber-50 text-amber-600" },
    { icon: "rotate", title: "Disponível em Todos os Tamanhos", desc: "Solteiro, solteiro king, casal, queen e king. Medidas exatas ou sob encomenda para quartos especiais. Consulte disponibilidade de cores.", colorClass: "bg-violet-50 text-violet-600" },
    { icon: "zap", title: "Entrega Expressa na Região", desc: "Araruama, Saquarema, Iguaba Grande e Maricá: entregamos em até 72h com equipe própria — não terceirizado, sem danos.", colorClass: "bg-blue-50 text-blue-600" },
  ],
  reviews: [
    { name: "Carlos E.", city: "Araruama", time: "há 1 semana", initials: "CE", text: "A cama box baú resolveu o problema crônico de espaço no nosso quarto. A Marcela foi super atenciosa, me ajudou a escolher o tamanho correto. Montagem foi rápida e caprichada. Estou muito satisfeito." },
    { name: "Juliana P.", city: "Iguaba Grande", time: "há 3 semanas", initials: "JP", text: "Precisava de espaço e qualidade ao mesmo tempo. A Marcela me orientou perfeito — até fez uma simulação de como o gavetão abriria no meu quarto antes de comprar. Atendimento diferenciado!" },
    { name: "Marcos A.", city: "Saquarema", time: "há 1 mês", initials: "MA", text: "Entrega foi no dia prometido, montagem incluída sem custo adicional. Equipe profissional e cuidadosa. O gavetão a gás é uma mão na roda — nunca mais minha esposa reclama de falta de espaço." },
    { name: "Priscila T.", city: "Araruama", time: "há 2 semanas", initials: "PT", text: "Box baú da Castor é diferente dos genéricos da internet. Estrutura sólida, acabamento impecável. Já faz 2 meses de uso intenso e está igual ao dia que chegou. Recomendo sem dúvida." },
    { name: "Felipe M.", city: "Maricá", time: "há 5 semanas", initials: "FM", text: "Pesquisei muito online mas optei por comprar aqui pelo atendimento presencial. Diferença enorme. A Marcela conhece cada modelo a fundo. Chegou no prazo, montagem perfeita. 5 estrelas merece mais." },
  ],
  faq: [
    { q: "O gavetão do Box Baú suporta quanto peso?", a: "O gavetão com sistema a gás suporta até 80 kg de carga distribuída. A base completa (estrutura) é projetada para suportar até 400 kg com distribuição uniforme, adequada para casal com até 200 kg somados." },
    { q: "Qual o prazo de entrega para Araruama?", a: "Para Araruama, o prazo padrão é de 48 a 72 horas úteis. Em muitos casos conseguimos na data e horário da sua preferência. A entrega é feita com equipe própria — não terceirizamos — garantindo cuidado no transporte." },
    { q: "Posso escolher a cor da base?", a: "Sim. Trabalhamos com acabamentos em BP nas cores: off-white, caramelo, tabaco e grafite. Para outras cores, podemos verificar disponibilidade sob encomenda com prazo de até 15 dias úteis." },
    { q: "Preciso assinar algum documento na entrega?", a: "Sim, a nota fiscal acompanha o pedido e pedimos assinatura no comprovante de recebimento. Isso protege tanto você quanto a loja. A montagem é documentada com foto no nosso sistema." },
    { q: "A entrega inclui subir escadas?", a: "Sim, nossa equipe realiza o serviço completo: desce pelo elevador ou escadas, monta no local desejado e retira toda a embalagem. Para andares acima do 10° em edifícios sem elevador de serviço, podemos verificar a viabilidade." },
  ],
  quizTitle: "Qual Box Baú é ideal para você?",
  quizSub: "Responda 3 perguntas sobre seu perfil de sono e receba a indicação do conjunto certo.",
  garantiaText: "✅ Garantia estrutural 3 anos + sistema a gás 2 anos. Entrega e montagem grátis em toda a região.",
  cidade: "Araruama",
  mapLink: "https://maps.app.goo.gl/cGmvFgeubawLRNGy8",
  endereco: "Castor Colchões Araruama — Araruama – RJ",
};

// ── LP 3: Outlet / Promoção ────────────────────────────────────────────────────

export const cfgOutlet: LPConfig = {
  pageTitle: "Outlet de Colchões Castor — Até 50% OFF | Região dos Lagos RJ",
  metaDescription: "Outlet Castor Colchões com até 50% de desconto. Mesma qualidade premium, mesmo atendimento especializado, preço de outlet. Estoque limitado. Cabo Frio e Araruama.",
  badge: "Outlet Oficial · Cabo Frio + Araruama · ⭐ 5.0",
  h1: "Outlet Castor — Colchões Premium com até 50% OFF, Estoque Limitado",
  headlineLine1: "Qualidade Castor.",
  headlineLine2: "No seu orçamento.",
  headlineAccent: "Outlet com garantia total.",
  sub: "Estoque selecionado de colchões premium com condições especiais. Mesma garantia, mesmo atendimento especializado, mesmo certificado INER — preço de outlet real.",
  ctaLabel: "Ver ofertas do outlet",
  ctaSubtext: "Estoque esgota rápido · Garantia total inclusa",
  wa: WA_CF,
  waAlt: WA_AR,
  scarcityText: "🔥 <strong>Últimas unidades!</strong> Outlet atualizado esta semana — estoque se esgota em dias, não em meses",
  scarcityEmoji: "🏷️",
  accentClasses: RED_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-900 via-red-950 to-slate-900",
  features: [
    { icon: "award", title: "Mesmo Certificado INER", desc: "Produtos do outlet mantêm certificação ISO 9001 e laudo INER. Não é descarte de fábrica — são lotes específicos com aproveitamento de oportunidade comercial.", colorClass: "bg-red-50 text-red-600" },
    { icon: "shield", title: "Garantia Integral Mantida", desc: "A garantia de fábrica não é reduzida no outlet. Você tem a mesma cobertura do produto pelo preço de lançamento — negociamos diretamente com o fabricante.", colorClass: "bg-emerald-50 text-emerald-600" },
    { icon: "check", title: "Conferência Presencial", desc: "Cada peça do outlet é conferida presencialmente antes da venda. Você pode vir à loja e testar antes de comprar. Transparência total, sem surpresas.", colorClass: "bg-blue-50 text-blue-600" },
    { icon: "zap", title: "Condições de Pagamento", desc: "Outlet com parcelamento em até 12x no cartão. PIX e dinheiro à vista ganham desconto adicional de até 5%. Sem taxa extra de entrega.", colorClass: "bg-amber-50 text-amber-600" },
    { icon: "trending", title: "Atualizado Semanalmente", desc: "O estoque do outlet é atualizado toda semana com novas oportunidades. Assine nossa lista de WhatsApp e seja o primeiro a saber quando entrar novidade.", colorClass: "bg-violet-50 text-violet-600" },
    { icon: "heart", title: "Mesmo Atendimento Premium", desc: "ThallesZzz e Marcela atendem o outlet com o mesmo cuidado da linha premium. Diagnóstico de sono gratuito, indicação personalizada — nada muda.", colorClass: "bg-pink-50 text-pink-600" },
  ],
  reviews: [
    { name: "Patricia N.", city: "São Pedro da Aldeia", time: "há 3 semanas", initials: "PN", text: "Encontrei um colchão de primeira linha com 40% de desconto no outlet. Mesma garantia, tudo certinho. O ThallesZzz foi honesto sobre a condição do produto. Compra totalmente segura." },
    { name: "Diego F.", city: "Cabo Frio", time: "há 1 mês", initials: "DF", text: "Não acreditei quando vi o preço. Pensei que tivesse algum defeito escondido. Fui pessoalmente, o Thalles me mostrou o laudo e a garantia completa. É produto premium mesmo, só preço especial." },
    { name: "Camila R.", city: "Araruama", time: "há 2 semanas", initials: "CR", text: "Fui indicada por uma amiga. O outlet da Castor é diferente — não é 'produto com defeito', são oportunidades reais. Comprei queen size por preço de solteiro. Melhor indicação que recebi." },
    { name: "Leonardo S.", city: "Iguaba Grande", time: "há 1 semana", initials: "LS", text: "Estava esperando Black Friday para comprar colchão. Encontrei o outlet da Castor antes e comprei com desconto equivalente ou maior. Não precisei esperar meses e ainda recebi em 3 dias." },
    { name: "Beatriz O.", city: "Búzios", time: "há 5 semanas", initials: "BO", text: "Comprei colchão e box no outlet e economizei quase R$ 800 em comparação ao preço regular. Qualidade idêntica. Marcela foi excelente, sem pressão nenhuma. Recomendo e já indiquei 3 amigas." },
  ],
  faq: [
    { q: "Qual é a diferença entre outlet e o produto regular?", a: "Os produtos do outlet são originais Castor com certificação completa, mas vendidos em condições especiais. Podem ser modelos de coleção anterior, lotes de oportunidade ou produtos com pequenas marcas de exposição (invisíveis no uso). A garantia de fábrica é integral, sem qualquer redução." },
    { q: "Posso ver o produto antes de comprar?", a: "Sim, recomendamos que venha até a loja para testar pessoalmente. Nossos especialistas vão te mostrar cada produto, explicar o motivo do preço especial e fazer o diagnóstico de sono gratuitamente. Transparência total, sem pressão." },
    { q: "A garantia do outlet é a mesma do produto regular?", a: "Sim. Os produtos do outlet mantêm a garantia integral do fabricante — 3 anos para espuma e 5 anos para mola. Cada produto vem com nota fiscal e termo de garantia. Nenhuma condição é reduzida no outlet." },
    { q: "O estoque do outlet é atualizado frequentemente?", a: "Sim, atualizamos toda semana com novas oportunidades. As peças saem rápido — por isso recomendamos entrar na nossa lista do WhatsApp para ser avisado primeiro. Envie 'OUTLET' no WhatsApp para (22) 99241-0112." },
    { q: "Posso parcelar compras no outlet?", a: "Sim, parcelamos em até 12x no cartão de crédito. PIX e dinheiro à vista recebem desconto adicional de 3% a 5%. Não cobramos taxa de entrega para Cabo Frio, Araruama e cidades próximas." },
  ],
  quizTitle: "Qual outlet é certo para você?",
  quizSub: "Descubra qual colchão do nosso outlet mais combina com o seu perfil de sono.",
  garantiaText: "✅ Garantia integral em todos os produtos do outlet. Mesma cobertura do produto regular, sem exceções.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Cabo Frio + Araruama – RJ",
};

// ── LP 4: Saúde da Coluna ─────────────────────────────────────────────────────

export const cfgSaudeColuna: LPConfig = {
  pageTitle: "Colchão para Coluna — Indicado por Fisioterapeutas | Castor Região dos Lagos RJ",
  metaDescription: "Colchão ortopédico para dor na coluna na Região dos Lagos. Certificado INER, molas independentes, suporte lombar real. Diagnóstico gratuito com especialista. Único 5.0 Google.",
  badge: "Ortopédico · Recomendado · ⭐ 5.0 Google",
  h1: "Colchão Ortopédico para Dor na Coluna — Especialistas na Região dos Lagos",
  headlineLine1: "Acorde sem dor.",
  headlineLine2: "Durma de verdade.",
  headlineAccent: "Indicado por fisioterapeutas.",
  sub: "Tecnologia de suporte ortopédico certificada pelo INER. Molas independentes que distribuem a pressão corporal e alinham a coluna vertebral durante toda a noite. Diagnóstico gratuito com ThallesZzz.",
  ctaLabel: "Fazer diagnóstico gratuito",
  ctaSubtext: "Especialista em engenharia do sono · Diagnóstico sem custo",
  wa: WA_CF,
  scarcityText: "🩺 <strong>Vagas limitadas</strong> para diagnóstico gratuito de sono esta semana — apenas 6 vagas restantes",
  scarcityEmoji: "🦴",
  accentClasses: EMERALD_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900",
  features: [
    { icon: "shield", title: "Suporte Lombar Certificado", desc: "Aprovado pelo INER com laudo técnico de resistência e durabilidade. A certificação garante que o suporte ortopédico real se mantém ao longo dos anos, não só nos primeiros meses.", colorClass: "bg-emerald-50 text-emerald-600" },
    { icon: "zap", title: "Molas Independentes", desc: "Cada mola responde individualmente ao peso do corpo. Isso distribui a pressão de forma uniforme e evita os pontos de compressão que causam dor nos quadris, ombros e coluna.", colorClass: "bg-blue-50 text-blue-600" },
    { icon: "award", title: "Firmeza Calibrada por Peso", desc: "O nível de firmeza certo depende do seu peso e posição de dormir. ThallesZzz faz esse diagnóstico gratuitamente — o colchão 'ortopédico' genérico pode estar piorando sua coluna.", colorClass: "bg-amber-50 text-amber-600" },
    { icon: "heart", title: "Indicado para Hérnia de Disco", desc: "Colchões com suporte inadequado aumentam a pressão intradiscal durante o sono. Nossos modelos ortopédicos são especificamente calibrados para reduzir essa pressão.", colorClass: "bg-red-50 text-red-600" },
    { icon: "wind", title: "Regulação Térmica para Sono Reparador", desc: "Dor causa insônia. Insônia piora a percepção de dor. O ciclo precisa ser quebrado pela raiz: temperatura do sono e suporte postural correto combinados.", colorClass: "bg-cyan-50 text-cyan-600" },
    { icon: "trending", title: "Diagnóstico de Engenharia do Sono", desc: "ThallesZzz analisa seu perfil de sono completo: posição, peso, histórico de dores, ambiente do quarto. A indicação é personalizada, não genérica.", colorClass: "bg-violet-50 text-violet-600" },
  ],
  reviews: [
    { name: "Dr. Pedro A.", city: "Cabo Frio", time: "há 1 mês", initials: "PA", text: "Como fisioterapeuta, comecei a indicar Castor para meus pacientes com lombalgia crônica após perceber resultados clinicamente relevantes. O ThallesZzz tem conhecimento técnico que supera muitos vendedores especializados que conheço." },
    { name: "Rosana T.", city: "Búzios", time: "há 3 semanas", initials: "RT", text: "Tenho hérnia de disco L4-L5. Meu médico me disse para investir num colchão de qualidade. Depois do diagnóstico com o Thalles, escolhi o modelo certo para meu peso e posição. Em 2 semanas, a dor matinal reduziu 80%." },
    { name: "Augusto L.", city: "Araruama", time: "há 2 meses", initials: "AL", text: "Acordava com dor nas costas todos os dias há 4 anos. Já tentei fisioterapia, acupuntura, tudo. Era o colchão. Com o Castor Ortopédico correto para meu perfil, a dor acabou em menos de 1 semana. Não tem como explicar a diferença." },
    { name: "Cristina V.", city: "Arraial do Cabo", time: "há 5 semanas", initials: "CV", text: "O diagnóstico gratuito do ThallesZzz foi revelador. Eu estava dormindo num colchão completamente errado para o meu peso e posição. Com o modelo certo, acordo disposta pela primeira vez em anos." },
    { name: "Roberto F.", city: "São Pedro da Aldeia", time: "há 1 mês", initials: "RF", text: "Espondilite anquilosante diagnosticada. Meu reumatologista falou para investir no colchão como prioridade. ThallesZzz entendeu minha condição, consultou o laudo técnico dos modelos e me indicou o exato. Resultado acima do esperado." },
  ],
  faq: [
    { q: "Qual é a firmeza correta para quem tem dor na coluna?", a: "Depende do seu peso e posição de dormir. Firmeza errada — muito macia ou muito dura — piora a dor. Quem dorme de lado precisa de colchão mais macio para acomodar quadril e ombro. Quem dorme de costas precisa de suporte lombar médio-firme. ThallesZzz faz esse diagnóstico gratuitamente." },
    { q: "Colchão ortopédico genérico de loja de departamento funciona?", a: "O termo 'ortopédico' não é regulamentado no Brasil — qualquer fabricante pode usar. O que garante suporte real é a certificação INER, densidade real D33+ e o tipo de mola ou espuma. Colchão ortopédico sem laudo pode estar piorando sua coluna." },
    { q: "Tenho hérnia de disco. Qual modelo me ajuda mais?", a: "Para hérnia de disco, geralmente indicamos o Castor Pocket Ortopédico com firmeza média, que distribui a pressão intradiscal de forma uniforme. Mas o diagnóstico presencial ou via WhatsApp com ThallesZzz é fundamental — não existe solução genérica para hérnia." },
    { q: "Em quanto tempo vou sentir a diferença?", a: "A maioria dos clientes relata diferença perceptível nas primeiras 2 a 7 noites. O corpo precisa de tempo para adaptar a musculatura à nova postura de sono. Se em 30 dias você não sentir melhora, trocamos o colchão sem custo." },
    { q: "O diagnóstico de sono com ThallesZzz é realmente gratuito?", a: "Sim, 100% gratuito e sem compromisso de compra. ThallesZzz vai analisar seu perfil completo: posição preferida, peso, histórico de dores, ambiente do quarto. A indicação é sua, independente de você comprar ou não." },
  ],
  quizTitle: "Qual colchão alivia sua dor?",
  quizSub: "Diagnóstico em 3 perguntas: receba a indicação ortopédica personalizada para o seu caso.",
  garantiaText: "✅ Se você não sentir melhora nas dores em 30 dias, trocamos o colchão. Garantia de saúde, não só de produto.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Jardim Flamboyant, Cabo Frio – RJ",
};

// ── LP 5: Entrega 24h ─────────────────────────────────────────────────────────

export const cfgEntrega24h: LPConfig = {
  pageTitle: "Entrega de Colchão em 24h — Cabo Frio, Macaé, Região dos Lagos | Castor",
  metaDescription: "Entrega expressa de colchões em 24h para Cabo Frio, Macaé, Araruama e toda a Região dos Lagos. Montagem grátis inclusa. Castor Colchões — única 5.0 no Google.",
  badge: "Entrega 24h · Região dos Lagos + Macaé · ⭐ 5.0",
  h1: "Entrega de Colchão em 24h — Cabo Frio, Macaé e Toda a Região dos Lagos",
  headlineLine1: "Compra hoje.",
  headlineLine2: "Entrega amanhã.",
  headlineAccent: "Com montagem grátis inclusa.",
  sub: "Logística própria para toda a Região dos Lagos e Macaé. Entrega expressa com equipe treinada, montagem inclusa, sem custo adicional. Dorme no seu colchão novo amanhã.",
  ctaLabel: "Garantir entrega amanhã",
  ctaSubtext: "Confirme disponibilidade de data agora · Vagas limitadas",
  wa: WA_CF,
  waAlt: WA_AR,
  scarcityText: "⚡ <strong>Últimas datas de entrega expressa</strong> — apenas 4 vagas restantes esta semana para toda a região",
  scarcityEmoji: "🚚",
  accentClasses: VIOLET_ACCENT,
  heroGradient: "bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900",
  features: [
    { icon: "zap", title: "Entrega Própria — Não Terceirizada", desc: "Transportamos com nossa própria equipe treinada. Sem transportadora, sem terceiro. Isso significa menos danos, mais pontualidade e responsabilidade direta da loja.", colorClass: "bg-violet-50 text-violet-600" },
    { icon: "check", title: "Montagem Incluída Sempre", desc: "Nossa equipe monta a cama no local que você indicar, nivela, posiciona e retira toda a embalagem de papelão, isopor e plástico. Zero esforço para você.", colorClass: "bg-emerald-50 text-emerald-600" },
    { icon: "shield", title: "Rastreamento em Tempo Real", desc: "Você recebe confirmação de saída, chegada estimada e notificação no WhatsApp. Nunca fique em dúvida sobre onde está sua entrega.", colorClass: "bg-blue-50 text-blue-600" },
    { icon: "trending", title: "Cobertura Região dos Lagos + Macaé", desc: "Cabo Frio, Araruama, Búzios, Arraial, São Pedro da Aldeia, Iguaba, Saquarema, Macaé e cidades intermediárias. Consulte sua cidade no WhatsApp.", colorClass: "bg-amber-50 text-amber-600" },
    { icon: "award", title: "Produto Conferido Antes de Sair", desc: "Cada entrega sai da loja com checklist de qualidade: embalagem íntegra, produto sem danos, dimensões conferidas. Você assina o recebimento com garantia imediata.", colorClass: "bg-red-50 text-red-600" },
    { icon: "moon", title: "Horários Flexíveis", desc: "Manhã, tarde ou pré-agendado para um horário específico. Trabalhamos Seg–Sáb, incluindo horários especiais para quem tem rotina apertada.", colorClass: "bg-slate-100 text-slate-600" },
  ],
  reviews: [
    { name: "Thiago B.", city: "Macaé", time: "há 1 semana", initials: "TB", text: "Comprei na terça e recebi na quarta de manhã em Macaé. Equipe pontual, montagem incluída, retiraram toda embalagem. Incrível para uma loja de Cabo Frio entregar em Macaé com essa qualidade." },
    { name: "Silvia M.", city: "Cabo Frio", time: "há 2 semanas", initials: "SM", text: "Mudei de casa de última hora e precisava de colchão urgente. Comprei às 10h da manhã, recebi às 17h do mesmo dia. Impossível? Não para a Castor. Melhor atendimento de urgência que já vi." },
    { name: "Lucas R.", city: "Arraial do Cabo", time: "há 3 semanas", initials: "LR", text: "Logística impecável. Recebi notificação de saída, previsão de chegada e confirmação pelo WhatsApp. Equipe chegou no horário exato prometido. Profissionalismo que não esperava numa loja local." },
    { name: "Vanessa K.", city: "São Pedro da Aldeia", time: "há 1 mês", initials: "VK", text: "Meu colchão antigo quebrou na quinta-feira à noite. Comprei na sexta de manhã e recebi na sexta à tarde. Dormi bem pela primeira vez em muito tempo. Serviço de emergência impecável." },
    { name: "André C.", city: "Búzios", time: "há 2 semanas", initials: "AC", text: "Pensava que entrega rápida significava serviço ruim. Castor provou o contrário: entregaram antes do prazo, montaram com cuidado, explicaram tudo. Preço justo e entrega premium. Recomendo muito." },
  ],
  faq: [
    { q: "Quais cidades têm entrega em 24h?", a: "Cabo Frio, Araruama, Búzios, Arraial do Cabo, São Pedro da Aldeia, Iguaba Grande, Saquarema e Macaé. Para cidades intermediárias e outras regiões, consulte disponibilidade diretamente pelo WhatsApp — em geral conseguimos em até 48h." },
    { q: "A entrega expressa tem custo adicional?", a: "Não. Entrega e montagem são incluídas sem custo adicional para toda a área de cobertura, independente de ser entrega padrão ou expressa. O preço que você vê é o preço final." },
    { q: "Posso escolher o horário de entrega?", a: "Sim. Ao confirmar o pedido, você indica a janela de horário preferida: manhã (8h–12h), tarde (13h–17h) ou horário específico. Trabalhamos de segunda a sábado para atender sua agenda." },
    { q: "E se eu não estiver em casa no momento da entrega?", a: "Você pode indicar um responsável para receber. Também avisamos por WhatsApp 1h antes da chegada para você se organizar. Se precisar remarcar, fazemos sem custo." },
    { q: "A montagem está mesmo incluída?", a: "Sim, 100% incluída. Nossa equipe monta a cama (box ou estrutura), posiciona o colchão, nivela os pés e retira absolutamente toda a embalagem. Você só precisa indicar onde quer a cama." },
  ],
  quizTitle: "Qual colchão entregamos amanhã para você?",
  quizSub: "3 perguntas e já preparamos tudo para entrega expressa com a indicação certa.",
  garantiaText: "✅ Entrega no prazo prometido ou negociamos condição especial. Nossa reputação 5.0 depende disso.",
  cidade: "Cabo Frio",
  mapLink: "https://maps.app.goo.gl/UuF6w1nAvTgXockS6",
  endereco: "Av. Júlia Kubitschek, 64 — Cabo Frio + Araruama – RJ",
};
