export default async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Netlify.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Falha na verificação", { status: 403 });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);

    console.log("Mensagem recebida do WhatsApp:");
    console.log(JSON.stringify(body));

    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Método não permitido", { status: 405 });
};

export const config = {
  path: "/api/webhook"
};
