import { Resend } from "resend";

export const runtime = "nodejs";

interface ContactRequest {
  name: string;
  email: string;
  msg: string;
  company: string; // honeypot; vacío en envíos legítimos
}

interface ContactResponse {
  ok: boolean;
  error?: string; // solo cuando ok === false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: ContactResponse, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: Partial<ContactRequest>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Cuerpo inválido." }, 400);
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const msg = (body.msg ?? "").trim();
  const company = (body.company ?? "").trim();

  // Honeypot: un bot rellenó el campo oculto. Fingimos éxito y no enviamos.
  if (company) {
    return json({ ok: true }, 200);
  }

  if (!name || !email || !msg) {
    return json({ ok: false, error: "Faltan campos obligatorios." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Correo con formato inválido." }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  const from = process.env.CONTACT_FROM;
  if (!apiKey || !to || !from) {
    const missing = [
      !apiKey && "RESEND_API_KEY",
      !to && "CONTACT_TO",
      !from && "CONTACT_FROM",
    ]
      .filter(Boolean)
      .join(", ");
    console.error(`[api/contact] Falta configuración de entorno: ${missing}`);
    return json(
      { ok: false, error: "El servicio de contacto no está configurado." },
      500,
    );
  }

  const resend = new Resend(apiKey);
  let sendError: unknown = null;
  try {
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `▸ Nuevo mensaje de contacto — ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}\n`,
    });
    sendError = error;
  } catch (e) {
    sendError = e;
  }

  if (sendError) {
    const detail =
      sendError instanceof Error
        ? sendError.message
        : JSON.stringify(sendError);
    console.error(`[api/contact] Error de Resend: ${detail}`);
    return json({ ok: false, error: "No se pudo enviar el mensaje." }, 502);
  }

  return json({ ok: true }, 200);
}
