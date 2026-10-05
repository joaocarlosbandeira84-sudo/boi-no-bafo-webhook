const GRAPH_VERSION = "v26.0";

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

  console.log("Resposta da Meta:");
  console.log(JSON.stringify(resultado));

  if (!resposta.ok) {
    console.error("Erro ao enviar resposta:", resultado);
  }

  return { ok: resposta.ok, resultado };
}

async function enviarTexto(phoneNumberId, accessToken, destinatario, texto) {
  return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
    type: "text",
    text: { body: texto },
  });
}

async function enviarMenuPrincipal(phoneNumberId, accessToken, destinatario) {
  return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "🐂 BOI NO BAFO",
      },
      body: {
        text:
          "Olá! 👋 Bem-vindo ao Boi no Bafo.\n\n" +
          "Escolha uma opção para continuar:",
      },
      footer: {
        text: "Atendimento automático",
      },
      action: {
        button: "Ver opções",
        sections: [
          {
            title: "Menu principal",
            rows: [
              {
                id: "menu_pedido",
                title: "Fazer pedido",
                description: "Começar um novo pedido",
              },
              {
                id: "menu_cardapio",
                title: "Consultar cardápio",
                description: "Carnes e acompanhamentos",
              },
              {
                id: "menu_entrega",
                title: "Taxa / entrega",
                description: "Consultar informações de entrega",
              },
              {
                id: "menu_atendimento",
                title: "Falar com atendimento",
                description: "Solicitar atendimento humano",
              },
            ],
          },
        ],
      },
    },
  });
}

async function enviarMenuCarnes(phoneNumberId, accessToken, destinatario) {
  return enviarWhatsApp(phoneNumberId, accessToken, destinatario, {
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "🥩 Fazer pedido",
      },
      body: {
        text: "Escolha a carne para começar o pedido:",
      },
      footer: {
        text: "Digite VOLTAR a qualquer momento para retornar ao menu.",
      },
      action: {
        button: "Escolher carne",
        sections: [
          {
            title: "Carnes",
            rows: [
              { id: "carne_file_mignon", title: "Filé mignon" },
              { id: "carne_cupim", title: "Cupim" },
              { id: "carne_costela_boi", title: "Costela de boi" },
              { id: "carne_costela_suina", title: "Costela suína" },
              { id: "carne_picanha", title: "Picanha" },
              { id: "menu_voltar", title: "↩️ Voltar ao menu" },
            ],
          },
        ],
      },
    },
  });
}

function obterAcao(message) {
  const listReply = message?.interactive?.list_reply?.id;
  const buttonReply = message?.interactive?.button_reply?.id;

  if (listReply) return listReply;
  if (buttonReply) return buttonReply;

  const texto = (message?.text?.body || "").trim().toLowerCase();

  if (["oi", "olá", "ola", "menu", "início", "inicio", "voltar", "0"].includes(texto)) {
    return "menu_principal";
  }

  if (["1", "pedido", "fazer pedido"].includes(texto)) return "menu_pedido";
  if (["2", "cardápio", "cardapio"].includes(texto)) return "menu_cardapio";
  if (["3", "entrega", "frete", "taxa"].includes(texto)) return "menu_entrega";
  if (["4", "atendimento", "falar com atendimento"].includes(texto)) {
    return "menu_atendimento";
  }

  return "menu_principal";
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);

  // Verificação do webhook pela Meta
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

  // Recebe mensagens do WhatsApp
  if (req.method === "POST") {
    try {
      const body = req.body;

      console.log("Webhook recebido:");
      console.log(JSON.stringify(body));

      const value = body?.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];

      // Eventos de status não precisam de resposta
      if (!message) {
        return res.status(200).send("EVENT_RECEIVED");
      }

      const destinatario = message.from;
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!accessToken || !phoneNumberId) {
        console.error("Variáveis do WhatsApp não configuradas");
        return res.status(200).send("EVENT_RECEIVED");
      }

      const acao = obterAcao(message);

      if (acao === "menu_pedido") {
        await enviarMenuCarnes(phoneNumberId, accessToken, destinatario);
      } else if (acao === "menu_cardapio") {
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          "🥩 *Cardápio Boi no Bafo*\n\n" +
            "• Filé mignon\n" +
            "• Cupim\n" +
            "• Costela de boi\n" +
            "• Costela suína\n" +
            "• Picanha\n\n" +
            "Guarnições inclusas: feijão tropeiro, arroz, farofa e vinagrete.\n\n" +
            "Digite *MENU* para voltar."
        );
      } else if (acao === "menu_entrega") {
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          "🛵 *Entrega Boi no Bafo*\n\n" +
            "Frete grátis acima de 500 g para:\n" +
            "• Atalaia\n" +
            "• Aeroporto\n" +
            "• Coroa do Meio\n" +
            "• Farolândia\n\n" +
            "Digite *MENU* para voltar."
        );
      } else if (acao === "menu_atendimento") {
        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          "👤 Certo. Sua solicitação de atendimento foi registrada.\n\n" +
            "A equipe do Boi no Bafo continuará o atendimento por aqui.\n\n" +
            "Digite *MENU* para voltar ao atendimento automático."
        );
      } else if (acao === "menu_voltar") {
        await enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
      } else if (acao.startsWith("carne_")) {
        const nomes = {
          carne_file_mignon: "Filé mignon",
          carne_cupim: "Cupim",
          carne_costela_boi: "Costela de boi",
          carne_costela_suina: "Costela suína",
          carne_picanha: "Picanha",
        };

        const carne = nomes[acao] || "Carne";

        await enviarTexto(
          phoneNumberId,
          accessToken,
          destinatario,
          `🥩 Você escolheu *${carne}*.\n\nA próxima etapa será escolher o peso do pedido.\n\nDigite *MENU* para voltar.`
        );
      } else {
        await enviarMenuPrincipal(phoneNumberId, accessToken, destinatario);
      }

      return res.status(200).send("EVENT_RECEIVED");
    } catch (erro) {
      console.error("Erro no webhook:", erro);
      return res.status(200).send("EVENT_RECEIVED");
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).send("Método não permitido");
}
