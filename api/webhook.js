const GRAPH_VERSION = "v26.0";

const CARNES = [
  { id: "COS_SU", nome: "Costela Suína", precoKg: 174.0 },
  { id: "COS_BO", nome: "Costela de Boi", precoKg: 165.0 },
  { id: "COS_BBQ", nome: "Costela Suína c/ Barbecue", precoKg: 184.0 },
  { id: "CUP", nome: "Cupim", precoKg: 184.0 },
  { id: "FRA", nome: "Fraldinha", precoKg: 184.0 },
  { id: "MAM", nome: "Maminha", precoKg: 184.0 },
  { id: "PIC", nome: "Picanha", precoKg: 209.0 },
  { id: "FIL", nome: "Filé Mignon", precoKg: 209.0 },
  { id: "FIL_MUS", nome: "Filé c/ Mussarela", precoKg: 218.0 },
];

const EXTRAS = [
  { id: "TRO_200", categoria: "tropeiro", nome: "Feijão tropeiro", tamanho: "200 ml", preco: 12.0 },
  { id: "TRO_500", categoria: "tropeiro", nome: "Feijão tropeiro", tamanho: "500 ml", preco: 25.0 },
  { id: "TRO_750", categoria: "tropeiro", nome: "Feijão tropeiro", tamanho: "750 ml", preco: 36.0 },
  { id: "VIN_200", categoria: "vinagrete", nome: "Vinagrete", tamanho: "200 ml", preco: 14.0 },
  { id: "VIN_500", categoria: "vinagrete", nome: "Vinagrete", tamanho: "500 ml", preco: 31.0 },
  { id: "VIN_750", categoria: "vinagrete", nome: "Vinagrete", tamanho: "750 ml", preco: 38.0 },
  { id: "ARR_200", categoria: "arroz", nome: "Arroz", tamanho: "200 ml", preco: 9.0 },
  { id: "ARR_500", categoria: "arroz", nome: "Arroz", tamanho: "500 ml", preco: 18.0 },
  { id: "ARR_750", categoria: "arroz", nome: "Arroz", tamanho: "750 ml", preco: 25.0 },
  { id: "BAR_140", categoria: "barbecue", nome: "Molho barbecue", tamanho: "140 ml", preco: 16.0 },
  { id: "BAR_200", categoria: "barbecue", nome: "Molho barbecue", tamanho: "200 ml", preco: 22.0 },
  { id: "BAR_500", categoria: "barbecue", nome: "Molho barbecue", tamanho: "500 ml", preco: 40.0 },
  { id: "FAR_200", categoria: "farofa", nome: "Farofa", tamanho: "200 ml", preco: 8.0 },
  { id: "FAR_500", categoria: "farofa", nome: "Farofa", tamanho: "500 ml", preco: 15.0 },
  { id: "FAR_750", categoria: "farofa", nome: "Farofa", tamanho: "750 ml", preco: 23.0 },
];

const ZONAS = [
  { id: "atalaia", nome: "Atalaia", taxa: 7 },
  { id: "coroa", nome: "Coroa do Meio", taxa: 10 },
  { id: "farolandia", nome: "Farolândia", taxa: 10 },
  { id: "jardins", nome: "Jardins / Suíça / Luzia / Grageru", taxa: 14 },
  { id: "centro", nome: "São José / Centro e região", taxa: 16 },
  { id: "aruana", nome: "Aruana", taxa: 12 },
  { id: "aeroporto", nome: "Aeroporto", taxa: 10 },
  { id: "robalo", nome: "Robalo", taxa: 16 },
  { id: "mosqueiro", nome: "Mosqueiro", taxa: 16 },
];

const FRETE_GRATIS = new Set(["atalaia", "coroa", "farolandia", "aeroporto"]);
const GUARNICOES_INCLUSAS = "feijão tropeiro, arroz, farofa e vinagrete";
const PIX_CHAVE_EXIBICAO = "(79) 98125-8250";
const PIX_BANCO = "Banese";
const PIX_TITULAR = "João Carlos Ramos Bandeira";
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER || "5579981258250";

const sessions = globalThis.__BOI_NO_BAFO_SESSIONS__ || new Map();
globalThis.__BOI_NO_BAFO_SESSIONS__ = sessions;

function novaSessao() {
  return {
    stage: "menu",
    cart: [],
    selectedMeatId: null,
    fulfillment: "",
    requestedTime: "",
    deliveryZoneId: "",
    deliveryFee: 0,
    address: "",
    payment: "",
    changeFor: "",
    pixOrderCode: "",
    updatedAt: Date.now(),
  };
}

function getSession(numero) {
  const agora = Date.now();
  for (const [k, s] of sessions.entries()) {
    if (agora - (s.updatedAt || 0) > 6 * 60 * 60 * 1000) sessions.delete(k);
  }
  if (!sessions.has(numero)) sessions.set(numero, novaSessao());
  const s = sessions.get(numero);
  s.updatedAt = agora;
  return s;
}

function resetSession(numero) {
  const s = novaSessao();
  sessions.set(numero, s);
  return s;
}

const dinheiro = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function normalizarPeso(textoOriginal) {
  const t = String(textoOriginal || "").trim().toLowerCase().replace(",", ".");
  if (!t) return null;
  let g = null;
  const kg = t.match(/^([0-9]+(?:\.[0-9]+)?)\s*kg$/i);
  if (kg) g = Number(kg[1]) * 1000;
  else {
    const gramas = t.match(/^([0-9]+(?:\.[0-9]+)?)\s*g?(?:ramas?)?$/i);
    if (gramas) g = Number(gramas[1]);
  }
  if (!Number.isFinite(g)) return null;
  return Math.round(g);
}

function baseUrl(req) {
  const host = req.headers.host || "boi-no-bafo-webhook.vercel.app";
  const protocolo = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${protocolo}://${host}`;
}

function subtotal(s) {
  return s.cart.reduce((acc, item) => acc + Number(item.valor || 0) * Number(item.qtd || 1), 0);
}

function totalCarneGramas(s) {
  return s.cart
    .filter((x) => x.tipo === "carne")
    .reduce((acc, x) => acc + Number(x.peso || 0) * Number(x.qtd || 1), 0);
}

function calcularFrete(s, zonaId = s.deliveryZoneId) {
  if (s.fulfillment !== "Entrega") return 0;
  const zona = ZONAS.find((z) => z.id === zonaId);
  if (!zona) return 0;
  // Regra do Boi no Bafo: nas áreas promocionais, a partir de 500 g de carne o frete é grátis.
  if (FRETE_GRATIS.has(zona.id) && totalCarneGramas(s) >= 500) return 0;
  return Number(zona.taxa || 0);
}

function totalPedido(s) {
  return subtotal(s) + calcularFrete(s);
}

function resumoCarrinho(s) {
  if (!s.cart.length) return "🛒 *Seu carrinho está vazio.*";

  const linhas = s.cart.map((item) => {
    const detalhe = item.tipo === "carne" ? (item.peso === 1000 ? "1 kg" : item.peso + " g") : item.tamanho;
    return `• ${item.qtd}x ${item.nome} — ${detalhe} — ${dinheiro(item.valor * item.qtd)}`;
  });

  return (
    "🛒 *Seu pedido*\n\n" +
    linhas.join("\n") +
    "\n\n*Subtotal:* " +
    dinheiro(subtotal(s))
  );
}

async function enviarWhatsApp(phoneNumberId, accessToken, destinatario, payload) {
  const resposta = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: destinatario,
        ...payload,
      }),
    }
  );

  const resultado = await resposta.json();
  console.log("Resposta da Meta:", JSON.stringify(resultado));

  if (!resposta.ok) {
    console.error("Erro ao enviar resposta:", JSON.stringify(resultado));
  }

  return { ok: resposta.ok, resultado };
}

async function enviarTexto(phoneNumberId, accessToken, destinatario, texto) {
  return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
    type: "text",
    text: { body: texto },
  });
}

async function enviarImagem(phoneNumberId, accessToken, destinatario, link, legenda = "") {
  return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
    type: "image",
    image: {
      link,
      ...(legenda ? { caption: legenda } : {}),
    },
  });
}

async function encaminharComprovante(phoneNumberId, accessToken, destinatario, message, codigo) {
  if (message?.type === "image" && message.image?.id) {
    return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
      type: "image",
      image: {
        id: message.image.id,
        caption: `📎 Comprovante recebido — Pedido ${codigo}`,
      },
    });
  }

  if (message?.type === "document" && message.document?.id) {
    return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
      type: "document",
      document: {
        id: message.document.id,
        filename: message.document.filename || `comprovante-${codigo}.pdf`,
        caption: `📎 Comprovante recebido — Pedido ${codigo}`,
      },
    });
  }
}

async function enviarLista(phoneNumberId, accessToken, destinatario, {
  header,
  body,
  button,
  rows,
  footer = "Digite VOLTAR para retornar.",
}) {
  return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: header },
      body: { text: body },
      footer: { text: footer },
      action: {
        button,
        sections: [{ title: header, rows }],
      },
    },
  });
}

async function enviarBotoes(phoneNumberId, accessToken, destinatario, {
  body,
  buttons,
  footer = "Boi no Bafo",
}) {
  return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

async function enviarMenuPrincipal(phoneNumberId, accessToken, destinatario) {
  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: "BOI NO BAFO",
    body:
      "Olá! 👋 Bem-vindo ao Boi no Bafo.\n\n" +
      "1 kg serve até 5 pessoas.\n" +
      "As carnes acompanham " + GUARNICOES_INCLUSAS + ".\n\n" +
      "Escolha uma opção:",
    button: "Ver opções",
    footer: "Atendimento automático Boi no Bafo",
    rows: [
      { id: "menu_pedido", title: "🥩 Fazer pedido", description: "Começar um novo pedido" },
      { id: "menu_cardapio", title: "📋 Ver cardápio", description: "Carnes e preços" },
      { id: "menu_entrega", title: "🛵 Taxa / entrega", description: "Regiões e frete" },
      { id: "menu_atendimento", title: "👤 Atendimento", description: "Falar com a equipe" },
    ],
  });
}

async function enviarMenuCarnes(phoneNumberId, accessToken, destinatario) {
  const rows = CARNES.map((c) => ({
    id: `carne_${c.id}`,
    title: c.nome.slice(0, 24),
    description: `${dinheiro(c.precoKg)}/kg`,
  }));
  rows.push({ id: "menu_voltar", title: "↩️ Voltar ao menu", description: "Menu principal" });

  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: "🥩 Carnes",
    body:
      "Escolha a carne.\n\n" +
      "Todas acompanham " + GUARNICOES_INCLUSAS + ".",
    button: "Escolher carne",
    rows,
  });
}

async function pedirPesoLivre(phoneNumberId, accessToken, destinatario, carne, s) {
  s.stage = "weight_free";
  return enviarTexto(
    phoneNumberId,
    accessToken,
    destinatario,
    `⚖️ *Quanto você deseja de ${carne.nome}?*\n\n` +
      `Preço: *${dinheiro(carne.precoKg)}/kg*\n\n` +
      "Digite o peso desejado. Pedido mínimo: *250 g*.\n" +
      "Exemplos: *250*, *375*, *620*, *1 kg*, *1,5 kg*.\n\n" +
      "Digite *VOLTAR* para escolher outra carne."
  );
}

async function enviarAposAdicionar(phoneNumberId, accessToken, destinatario, s, item) {
  return enviarBotoes(phoneNumberId, accessToken, destinatario, {
    body:
      `✅ *${item.nome}* — ${item.peso === 1000 ? "1 kg" : item.peso + " g"} adicionado.\n` +
      `Valor: *${dinheiro(item.valor)}*\n\n` +
      `🛒 Total acumulado: *${dinheiro(subtotal(s))}*`,
    buttons: [
      { id: "cart_continue", title: "Outra carne" },
      { id: "cart_view", title: "Ver carrinho" },
      { id: "checkout", title: "Finalizar" },
    ],
  });
}

async function enviarOpcoesCarrinho(phoneNumberId, accessToken, destinatario, s) {
  await enviarTexto(phoneNumberId, accessToken, destinatario, resumoCarrinho(s));
  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: "🛒 Carrinho",
    body: "O que deseja fazer agora?",
    button: "Opções do pedido",
    rows: [
      { id: "checkout", title: "✅ Finalizar", description: "Ir para entrega e pagamento" },
      { id: "cart_continue", title: "🥩 Mais carnes", description: "Continuar comprando" },
      { id: "extras_menu", title: "🍚 Extras", description: "Adicionar guarnições extras" },
      { id: "cart_clear", title: "🗑️ Limpar carrinho", description: "Remover todos os itens" },
      { id: "menu_voltar", title: "↩️ Menu principal", description: "Voltar ao início" },
    ],
  });
}

async function enviarMenuExtras(phoneNumberId, accessToken, destinatario) {
  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: "🍚 Guarnições extras",
    body: "Escolha o tipo de extra:",
    button: "Escolher extra",
    rows: [
      { id: "extra_cat_tropeiro", title: "Feijão tropeiro", description: "200, 500 ou 750 ml" },
      { id: "extra_cat_vinagrete", title: "Vinagrete", description: "200, 500 ou 750 ml" },
      { id: "extra_cat_arroz", title: "Arroz", description: "200, 500 ou 750 ml" },
      { id: "extra_cat_barbecue", title: "Molho barbecue", description: "140, 200 ou 500 ml" },
      { id: "extra_cat_farofa", title: "Farofa", description: "200, 500 ou 750 ml" },
      { id: "cart_view", title: "↩️ Voltar ao carrinho", description: "Revisar pedido" },
    ],
  });
}

async function enviarTamanhosExtra(phoneNumberId, accessToken, destinatario, categoria) {
  const itens = EXTRAS.filter((e) => e.categoria === categoria);
  const nome = itens[0]?.nome || "Extra";
  const rows = itens.map((e) => ({
    id: `extra_${e.id}`,
    title: e.tamanho,
    description: dinheiro(e.preco),
  }));
  rows.push({ id: "extras_menu", title: "↩️ Voltar", description: "Outros extras" });

  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: nome.slice(0, 24),
    body: "Escolha o tamanho:",
    button: "Ver tamanhos",
    rows,
  });
}

async function enviarRecebimento(phoneNumberId, accessToken, destinatario) {
  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: "📦 Recebimento",
    body: "Como você quer receber o pedido?",
    button: "Escolher",
    rows: [
      { id: "fulfill_retirada", title: "🛍️ Retirada", description: "Retirar no Boi no Bafo" },
      { id: "fulfill_entrega", title: "🛵 Entrega", description: "Receber no endereço" },
      { id: "cart_view", title: "↩️ Voltar ao carrinho", description: "Revisar pedido" },
    ],
  });
}

async function pedirHorario(phoneNumberId, accessToken, destinatario, s) {
  s.stage = "schedule";
  return enviarTexto(
    phoneNumberId,
    accessToken,
    destinatario,
    "🕐 *Qual o horário?*\n\nDigite no formato *HH:MM* (ex.: 19:30) ou escreva *AGORA*.\n\nDigite *VOLTAR* para retornar."
  );
}

async function enviarZonas(phoneNumberId, accessToken, destinatario, s) {
  s.stage = "delivery_zone";
  const gramas = totalCarneGramas(s);
  const rows = ZONAS.map((z) => {
    const gratis = FRETE_GRATIS.has(z.id) && gramas >= 500;
    return {
      id: `zona_${z.id}`,
      title: z.nome.slice(0, 24),
      description: gratis ? "Frete grátis neste pedido" : `Frete ${dinheiro(z.taxa)}`,
    };
  });
  rows.push({ id: "checkout_voltar", title: "↩️ Voltar", description: "Alterar recebimento" });

  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: "🛵 Região de entrega",
    body:
      "Escolha a região.\n\n" +
      "Frete grátis para Atalaia, Aeroporto, Coroa do Meio e Farolândia em pedidos com mais de 500 g de carne.",
    button: "Escolher região",
    rows,
  });
}

async function enviarPagamento(phoneNumberId, accessToken, destinatario, s) {
  s.stage = "payment";
  return enviarLista(phoneNumberId, accessToken, destinatario, {
    header: "💳 Pagamento",
    body: "Como você prefere pagar?",
    button: "Escolher pagamento",
    rows: [
      { id: "pay_pix", title: "💠 Pix", description: "Pagamento por Pix" },
      { id: "pay_cartao", title: "💳 Cartão", description: s.fulfillment === "Entrega" ? "Motoboy leva a maquininha" : "Pagamento no local" },
      { id: "pay_dinheiro", title: "💵 Dinheiro", description: "Informe o troco em seguida" },
      { id: "payment_voltar", title: "↩️ Voltar", description: "Etapa anterior" },
    ],
  });
}

async function enviarConfirmacao(phoneNumberId, accessToken, destinatario, s) {
  s.stage = "confirm";
  const zona = ZONAS.find((z) => z.id === s.deliveryZoneId);
  s.deliveryFee = calcularFrete(s, s.deliveryZoneId);
  let detalhes =
    "✅ *Confira seu pedido*\n\n" +
    resumoCarrinho(s) +
    "\n\n📦 *Recebimento:* " + s.fulfillment +
    "\n🕐 *Horário:* " + (s.requestedTime === "ASAP" ? "O mais rápido possível" : s.requestedTime);

  if (s.fulfillment === "Entrega") {
    detalhes +=
      "\n📍 *Região:* " + (zona?.nome || "") +
      "\n🏠 *Endereço:* " + s.address +
      "\n🛵 *Frete:* " + (s.deliveryFee === 0 ? "GRÁTIS" : dinheiro(s.deliveryFee));
  }

  detalhes += "\n💳 *Pagamento:* " + s.payment;

  if (s.payment === "Dinheiro") {
    detalhes += "\n💵 *Troco:* " + (s.changeFor === "SEM TROCO" ? "Não precisa" : "para " + dinheiro(s.changeFor));
  }

  detalhes += "\n\n💰 *TOTAL: " + dinheiro(totalPedido(s)) + "*";

  await enviarTexto(phoneNumberId, accessToken, destinatario, detalhes);

  return enviarBotoes(phoneNumberId, accessToken, destinatario, {
    body: "Está tudo certo com o pedido?",
    buttons: [
      { id: "confirm_order", title: "✅ Confirmar" },
      { id: "cart_view", title: "✏️ Alterar" },
      { id: "cancel_order", title: "❌ Cancelar" },
    ],
  });
}

function obterInteracao(message) {
  return (
    message?.interactive?.list_reply?.id ||
    message?.interactive?.button_reply?.id ||
    ""
  );
}

function obterTexto(message) {
  return (message?.text?.body || "").trim();
}

function base64Url(texto) {
  return Buffer.from(texto, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function gerarLinkImpressao(req, order) {
  const host = req.headers.host || "boi-no-bafo-webhook.vercel.app";
  const protocolo = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const payload = base64Url(JSON.stringify(order));
  return `${protocolo}://${host}/pedido.html?o=${payload}`;
}

async function voltar(phoneNumberId, accessToken, destinatario, s) {
  if (["weight_free", "weight_range", "weight_list"].includes(s.stage)) {
    s.stage = "meats";
    return enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
  }
  if (["extras", "extra_sizes"].includes(s.stage)) {
    s.stage = "cart";
    return enviarOpcoesCarrinho(phoneNumberId, accessToken, destinatario, s);
  }
  if (s.stage === "schedule") {
    s.stage = "fulfillment";
    return enviarRecebimento(phoneNumberId, accessToken, destinatario);
  }
  if (s.stage === "delivery_zone") {
    s.stage = "fulfillment";
    return enviarRecebimento(phoneNumberId, accessToken, destinatario);
  }
  if (s.stage === "address") {
    return enviarZonas(phoneNumberId, accessToken, destinatario, s);
  }
  if (s.stage === "pix_wait") {
    return enviarPagamento(phoneNumberId, accessToken, destinatario, s);
  }
  if (s.stage === "payment" || s.stage === "change" || s.stage === "confirm") {
    if (s.fulfillment === "Entrega") {
      s.stage = "address";
      return enviarTexto(phoneNumberId, accessToken, destinatario, "🏠 Digite novamente o endereço completo de entrega:");
    }
    return pedirHorario(phoneNumberId, accessToken, destinatario, s);
  }
  return enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Falha na verificação");
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).send("Método não permitido");
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("Webhook recebido:", JSON.stringify(body));

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) return res.status(200).send("EVENT_RECEIVED");

    const destinatario = message.from;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.error("Variáveis do WhatsApp não configuradas");
      return res.status(200).send("EVENT_RECEIVED");
    }

    let s = getSession(destinatario);
    const interacao = obterInteracao(message);
    const textoOriginal = obterTexto(message);
    const texto = textoOriginal.toLowerCase();

    if (["oi", "olá", "ola", "menu", "início", "inicio", "0"].includes(texto)) {
      s.stage = "menu";
      if (texto !== "menu" && texto !== "0") {
        try {
          await enviarImagem(
            phoneNumberId,
            accessToken,
            destinatario,
            `${baseUrl(req)}/api/logo`
          );
        } catch (e) {
          console.error("Falha ao enviar logomarca:", e);
        }
      }
      await enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
      return res.status(200).send("EVENT_RECEIVED");
    }

    if (texto === "voltar") {
      await voltar(phoneNumberId, accessToken, destinatario, s);
      return res.status(200).send("EVENT_RECEIVED");
    }

    const acao = interacao || "";

    if (s.stage === "pix_wait" && (message?.type === "image" || message?.type === "document")) {
      const ehImagem = message?.type === "image" && message.image?.id;
      const ehPdf =
        message?.type === "document" &&
        message.document?.id &&
        message.document?.mime_type === "application/pdf";

      if (!ehImagem && !ehPdf) {
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          "📎 Envie o comprovante como *foto/imagem* ou *arquivo PDF*."
        );
        return res.status(200).send("EVENT_RECEIVED");
      }

      const codigo =
        s.pixOrderCode ||
        ("BB" + String(Math.floor(1000 + Math.random() * 9000)));

      s.deliveryFee = calcularFrete(s, s.deliveryZoneId);
      const total = totalPedido(s);
      const zona = ZONAS.find((z) => z.id === s.deliveryZoneId);
      const order = {
        code: codigo,
        createdAt: new Date().toISOString(),
        items: s.cart.map((x) => ({ ...x })),
        subtotal: subtotal(s),
        deliveryFee: s.deliveryFee,
        total,
        fulfillment: s.fulfillment,
        requestedTime: s.requestedTime,
        address: s.address,
        deliveryZone: zona?.nome || "",
        payment: "Pix",
        changeFor: "",
        customerPhone: destinatario,
        status: "Comprovante recebido",
        proofReceived: true,
      };

      const payloadPedido = base64Url(JSON.stringify(order));
      const linkImpressao = gerarLinkImpressao(req, order);
      const linkPedidos = `${baseUrl(req)}/pedidos.html?o=${payloadPedido}`;

      await enviarTexto(
        phoneNumberId,
        accessToken,
        destinatario,
        `✅ *Comprovante recebido.*\n\nPedido *${codigo}*. Seu pedido foi encaminhado para confirmação.`
      );

      try {
        if (ADMIN_WHATSAPP && ADMIN_WHATSAPP !== destinatario) {
          await encaminharComprovante(
            phoneNumberId,
            accessToken,
            ADMIN_WHATSAPP,
            message,
            codigo
          );

          await enviarTexto(
            phoneNumberId,
            accessToken,
            ADMIN_WHATSAPP,
            `📋 *NOVO PEDIDO ${codigo}*\n\n` +
              "💠 *PIX — COMPROVANTE RECEBIDO*\n" +
              `💰 Total: *${dinheiro(total)}*\n` +
              `Cliente: ${destinatario}\n\n` +
              "🖨️ *IMPRIMIR 2 VIAS*\n" +
              linkImpressao +
              "\n\n📋 *ABRIR CENTRAL DE PEDIDOS*\n" +
              linkPedidos
          );
        }
      } catch (e) {
        console.error("Falha ao encaminhar comprovante/pedido ao vendedor:", e);
      }

      resetSession(destinatario);
      return res.status(200).send("EVENT_RECEIVED");
    }

    if (s.stage === "pix_wait" && textoOriginal && texto !== "voltar") {
      await enviarTexto(
        phoneNumberId,
        accessToken,
        destinatario,
        "📎 Para concluir o Pix, envie aqui o *comprovante como foto ou PDF*."
      );
      return res.status(200).send("EVENT_RECEIVED");
    }

    if (acao === "menu_pedido") {
      s = resetSession(destinatario);
      s.stage = "meats";
      await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
    } else if (acao === "menu_cardapio") {
      const cardapio =
        "🥩 *Cardápio Boi no Bafo*\n\n" +
        CARNES.map((c) => `• ${c.nome}: *${dinheiro(c.precoKg)}/kg*`).join("\n") +
        "\n\n🍽️ 1 kg serve até 5 pessoas." +
        "\nTodas as carnes acompanham " + GUARNICOES_INCLUSAS + "." +
        "\n\nDigite *MENU* para voltar.";
      await enviarTexto(phoneNumberId, accessToken, destinatario, cardapio);
    } else if (acao === "menu_entrega") {
      const fretes =
        "🛵 *Entrega Boi no Bafo*\n\n" +
        "Frete grátis para *Atalaia, Aeroporto, Coroa do Meio e Farolândia* em pedidos com mais de 500 g de carne.\n\n" +
        "Demais valores de referência:\n" +
        ZONAS.map((z) => `• ${z.nome}: ${dinheiro(z.taxa)}`).join("\n") +
        "\n\nDigite *MENU* para voltar.";
      await enviarTexto(phoneNumberId, accessToken, destinatario, fretes);
    } else if (acao === "menu_atendimento") {
      await enviarTexto(
        phoneNumberId,
        accessToken,
        destinatario,
        "👤 Sua solicitação de atendimento foi registrada. A equipe do Boi no Bafo continuará o atendimento por aqui.\n\nDigite *MENU* para retornar ao robô."
      );
    } else if (acao === "menu_voltar") {
      s.stage = "menu";
      await enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
    } else if (acao.startsWith("carne_")) {
      const id = acao.replace("carne_", "");
      const carne = CARNES.find((c) => c.id === id);
      if (!carne) {
        await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
      } else {
        s.selectedMeatId = id;
        await pedirPesoLivre(phoneNumberId, accessToken, destinatario, carne, s);
      }
    } else if (acao === "cart_continue") {
      s.stage = "meats";
      await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
    } else if (acao === "cart_view") {
      s.stage = "cart";
      await enviarOpcoesCarrinho(phoneNumberId, accessToken, destinatario, s);
    } else if (acao === "cart_clear") {
      s.cart = [];
      s.stage = "meats";
      await enviarTexto(phoneNumberId, accessToken, destinatario, "🗑️ Carrinho limpo.");
      await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
    } else if (acao === "extras_menu") {
      s.stage = "extras";
      await enviarMenuExtras(phoneNumberId, accessToken, destinatario);
    } else if (acao.startsWith("extra_cat_")) {
      const categoria = acao.replace("extra_cat_", "");
      s.stage = "extra_sizes";
      await enviarTamanhosExtra(phoneNumberId, accessToken, destinatario, categoria);
    } else if (acao.startsWith("extra_")) {
      const id = acao.replace("extra_", "");
      const extra = EXTRAS.find((e) => e.id === id);
      if (extra) {
        const key = `extra-${extra.id}`;
        const existente = s.cart.find((x) => x.key === key);
        if (existente) existente.qtd += 1;
        else {
          s.cart.push({
            key,
            tipo: "extra",
            nome: extra.nome,
            tamanho: extra.tamanho,
            valor: extra.preco,
            qtd: 1,
          });
        }
        s.stage = "extras";
        await enviarBotoes(phoneNumberId, accessToken, destinatario, {
          body:
            `✅ ${extra.nome} ${extra.tamanho} adicionado.\n\n` +
            `🛒 Total acumulado: *${dinheiro(subtotal(s))}*`,
          buttons: [
            { id: "extras_menu", title: "Mais extras" },
            { id: "cart_view", title: "Carrinho" },
            { id: "cart_continue", title: "Carnes" },
          ],
        });
      } else {
        await enviarMenuExtras(phoneNumberId, accessToken, destinatario);
      }
    } else if (acao === "checkout") {
      if (!s.cart.length) {
        await enviarTexto(phoneNumberId, accessToken, destinatario, "Seu carrinho está vazio.");
        await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
      } else {
        s.stage = "fulfillment";
        await enviarRecebimento(phoneNumberId, accessToken, destinatario);
      }
    } else if (acao === "checkout_voltar") {
      s.stage = "fulfillment";
      await enviarRecebimento(phoneNumberId, accessToken, destinatario);
    } else if (acao === "fulfill_retirada" || acao === "fulfill_entrega") {
      s.fulfillment = acao === "fulfill_retirada" ? "Retirada" : "Entrega";
      s.deliveryZoneId = "";
      s.deliveryFee = 0;
      s.address = "";
      await pedirHorario(phoneNumberId, accessToken, destinatario, s);
    } else if (acao.startsWith("zona_")) {
      const zonaId = acao.replace("zona_", "");
      const zona = ZONAS.find((z) => z.id === zonaId);
      if (zona) {
        s.deliveryZoneId = zona.id;
        s.deliveryFee = calcularFrete(s, zona.id);
        s.stage = "address";
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          `📍 *${zona.nome}* — Frete: *${s.deliveryFee === 0 ? "GRÁTIS" : dinheiro(s.deliveryFee)}*\n\nAgora digite o *endereço completo* (rua, número e referência).\n\nDigite *VOLTAR* para retornar.`
        );
      } else {
        await enviarZonas(phoneNumberId, accessToken, destinatario, s);
      }
    } else if (acao === "pay_pix") {
      s.payment = "Pix";
      s.pixOrderCode = s.pixOrderCode || ("BB" + String(Math.floor(1000 + Math.random() * 9000)));
      s.stage = "pix_wait";

      await enviarTexto(
        phoneNumberId,
        accessToken,
        destinatario,
        "💠 *PAGAMENTO VIA PIX*\n\n" +
          `Banco: *${PIX_BANCO}*\n` +
          `Titular: *${PIX_TITULAR}*\n` +
          `Chave Pix: *${PIX_CHAVE_EXIBICAO}*\n` +
          `Valor: *${dinheiro(totalPedido(s))}*\n\n` +
          "Após realizar o pagamento, envie o *comprovante aqui pelo WhatsApp* como foto ou PDF.\n\n" +
          "Digite *VOLTAR* para escolher outra forma de pagamento."
      );
    } else if (acao === "pay_cartao" || acao === "pay_dinheiro") {
      s.payment = acao === "pay_cartao" ? "Cartão" : "Dinheiro";
      if (s.payment === "Dinheiro") {
        s.stage = "change";
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          "💵 *Pagamento em dinheiro*\n\nDigite o valor para o troco (ex.: *100*) ou escreva *SEM TROCO*.\n\nDigite *VOLTAR* para retornar."
        );
      } else {
        await enviarConfirmacao(phoneNumberId, accessToken, destinatario, s);
      }
    } else if (acao === "payment_voltar") {
      await voltar(phoneNumberId, accessToken, destinatario, s);
    } else if (acao === "confirm_order") {
      const codigo = "BB" + String(Math.floor(1000 + Math.random() * 9000));
      s.deliveryFee = calcularFrete(s, s.deliveryZoneId);
      const total = totalPedido(s);
      const zona = ZONAS.find((z) => z.id === s.deliveryZoneId);
      const order = {
        code: codigo,
        createdAt: new Date().toISOString(),
        items: s.cart.map((x) => ({ ...x })),
        subtotal: subtotal(s),
        deliveryFee: s.deliveryFee,
        total,
        fulfillment: s.fulfillment,
        requestedTime: s.requestedTime,
        address: s.address,
        deliveryZone: zona?.nome || "",
        payment: s.payment,
        changeFor: s.changeFor || "",
        customerPhone: destinatario,
        status: "Novo",
      };
      const payloadPedido = base64Url(JSON.stringify(order));
      const linkImpressao = gerarLinkImpressao(req, order);
      const linkPedidos = `${baseUrl(req)}/pedidos.html?o=${payloadPedido}`;

      // A impressão é exclusivamente interna: não enviar o link ao cliente.
      // O link fica registrado nos logs da Vercel para a equipe do Boi no Bafo.
      console.log(
        "PEDIDO_INTERNO_IMPRESSAO",
        JSON.stringify({
          codigo,
          linkImpressao,
          via1: "PREPARO / COZINHA",
          via2: "CAIXA / ATENDIMENTO",
          largura: ["80mm", "58mm"],
        })
      );

      // Notificação interna para quem está vendendo.
      // Não interfere na confirmação enviada ao cliente se a Meta recusar a mensagem interna.
      try {
        if (ADMIN_WHATSAPP && ADMIN_WHATSAPP !== destinatario) {
          await enviarTexto(
            phoneNumberId,
            accessToken,
            ADMIN_WHATSAPP,
            `📋 *NOVO PEDIDO ${codigo}*\n\n` +
              `Total: *${dinheiro(total)}*\n` +
              `Cliente: ${destinatario}\n\n` +
              "👉 *ABRIR PEDIDOS / IMPRIMIR*\n" +
              linkPedidos
          );
        }
      } catch (e) {
        console.error("Falha ao avisar o vendedor:", e);
      }

      await enviarTexto(
        phoneNumberId,
        accessToken,
        destinatario,
        `🎉 *Pedido ${codigo} confirmado!*\n\n` +
          `${resumoCarrinho(s)}\n\n` +
          (s.fulfillment === "Entrega"
            ? `🛵 Frete: ${s.deliveryFee === 0 ? "GRÁTIS" : dinheiro(s.deliveryFee)}\n`
            : "") +
          `💰 *TOTAL: ${dinheiro(total)}*\n\n` +
          "Obrigado por pedir no *Boi no Bafo*! 🔥"
      );
      resetSession(destinatario);
    } else if (acao === "cancel_order") {
      resetSession(destinatario);
      await enviarTexto(phoneNumberId, accessToken, destinatario, "❌ Pedido cancelado.");
      await enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
    } else if (s.stage === "weight_free" && textoOriginal) {
      const carne = CARNES.find((c) => c.id === s.selectedMeatId);
      const g = normalizarPeso(textoOriginal);
      if (!carne) {
        s.stage = "meats";
        await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
      } else if (!Number.isFinite(g) || g < 250) {
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          "⚖️ O pedido mínimo desta carne é *250 g*.\n\nDigite um peso a partir de 250 g. Ex.: *250*, *430*, *875* ou *1 kg*."
        );
      } else {
        const valor = carne.precoKg * (g / 1000);
        const key = `${carne.id}-${g}`;
        const existente = s.cart.find((x) => x.key === key);
        if (existente) existente.qtd += 1;
        else {
          s.cart.push({
            key,
            tipo: "carne",
            nome: carne.nome,
            peso: g,
            precoKg: carne.precoKg,
            valor,
            qtd: 1,
          });
        }
        s.stage = "after_add";
        await enviarAposAdicionar(phoneNumberId, accessToken, destinatario, s, {
          nome: carne.nome,
          peso: g,
          valor,
        });
      }
    } else if (s.stage === "schedule" && textoOriginal) {
      const normal = texto.toUpperCase();
      if (["AGORA", "O MAIS RÁPIDO POSSÍVEL", "O MAIS RAPIDO POSSIVEL"].includes(normal)) {
        s.requestedTime = "ASAP";
      } else if (/^([01]\d|2[0-3]):[0-5]\d$/.test(textoOriginal)) {
        s.requestedTime = textoOriginal;
      } else {
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          "Horário inválido. Digite, por exemplo, *19:30* ou escreva *AGORA*."
        );
        return res.status(200).send("EVENT_RECEIVED");
      }

      if (s.fulfillment === "Entrega") {
        await enviarZonas(phoneNumberId, accessToken, destinatario, s);
      } else {
        await enviarPagamento(phoneNumberId, accessToken, destinatario, s);
      }
    } else if (s.stage === "address" && textoOriginal) {
      s.address = textoOriginal;
      await enviarPagamento(phoneNumberId, accessToken, destinatario, s);
    } else if (s.stage === "change" && textoOriginal) {
      if (["sem troco", "não precisa", "nao precisa", "sem"].includes(texto)) {
        s.changeFor = "SEM TROCO";
        await enviarConfirmacao(phoneNumberId, accessToken, destinatario, s);
      } else {
        const valor = Number(texto.replace("r$", "").replace(".", "").replace(",", ".").trim());
        if (!Number.isFinite(valor) || valor <= 0) {
          await enviarTexto(
            phoneNumberId,
            accessToken,
            destinatario,
            "Digite somente o valor do troco, por exemplo *100*, ou escreva *SEM TROCO*."
          );
        } else {
          s.changeFor = valor;
          await enviarConfirmacao(phoneNumberId, accessToken, destinatario, s);
        }
      }
    } else if (textoOriginal) {
      if (["pedido", "fazer pedido", "1"].includes(texto)) {
        s = resetSession(destinatario);
        s.stage = "meats";
        await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
      } else if (["cardápio", "cardapio", "2"].includes(texto)) {
        const cardapio =
          "🥩 *Cardápio Boi no Bafo*\n\n" +
          CARNES.map((c) => `• ${c.nome}: *${dinheiro(c.precoKg)}/kg*`).join("\n") +
          "\n\nDigite *MENU* para voltar.";
        await enviarTexto(phoneNumberId, accessToken, destinatario, cardapio);
      } else {
        await enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
      }
    } else {
      await enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
    }

    return res.status(200).send("EVENT_RECEIVED");
  } catch (erro) {
    console.error("Erro no webhook:", erro);
    return res.status(200).send("EVENT_RECEIVED");
  }
}
