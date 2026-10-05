import QRCode from "qrcode";

export default async function handler(req, res) {
  try {
    const data = String(req.query?.data || "").trim();
    if (!data || data.length > 1200) {
      return res.status(400).send("PIX inválido");
    }
    const png = await QRCode.toBuffer(data, {
      type: "png",
      width: 700,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(png);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Erro ao gerar QR Code");
  }
}
