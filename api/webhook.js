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

  if (req.method === "POST") {
    console.log("Mensagem recebida do WhatsApp:");
    console.log(JSON.stringify(req.body));

    return res.status(200).send("EVENT_RECEIVED");
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).send("Método não permitido");
}
