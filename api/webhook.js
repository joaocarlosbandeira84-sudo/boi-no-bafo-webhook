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

      const resposta =
        "Olá! 👋 Bem-vindo ao Boi no Bafo.\n\n" +
        "Nosso atendimento automático está funcionando. ✅\n\n" +
        "Em breve vamos carregar aqui o menu completo de pedidos.";

      const metaResponse = await fetch(
        `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
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
            type: "text",
            text: {
              body: resposta,
            },
          }),
        }
      );

      const resultado = await metaResponse.json();

      console.log("Resposta da Meta:");
      console.log(JSON.stringify(resultado));

      if (!metaResponse.ok) {
        console.error("Erro ao enviar resposta:", resultado);
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
