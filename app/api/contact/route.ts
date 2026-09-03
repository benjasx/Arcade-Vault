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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Correo temático arcade: fondo oscuro, acentos neón, layout con tablas para
// compatibilidad con clientes de correo. Paleta tomada del prototipo.
function buildHtml(name: string, email: string, msg: string) {
  const n = escapeHtml(name);
  const e = escapeHtml(email);
  const m = escapeHtml(msg).replace(/\n/g, "<br />");
  const mono =
    "'JetBrains Mono','Courier New',Courier,monospace";

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#0a0a0f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 12px;font-family:${mono};">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f0f18;border:2px solid #00f5ff;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:#15151f;border-bottom:2px solid #ff006e;padding:20px 28px;">
              <div style="font-size:11px;letter-spacing:0.22em;color:#f5ff00;text-transform:uppercase;">&#9654; Arcade Vault</div>
              <div style="margin-top:8px;font-size:20px;font-weight:700;letter-spacing:0.06em;color:#00f5ff;text-transform:uppercase;">Player 1 wants to talk</div>
              <div style="margin-top:6px;font-size:12px;color:#8a8fb5;">&#9654;&#9654; Nuevo mensaje de contacto recibido</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#e6e9ff;">
                <tr>
                  <td style="padding:8px 0;color:#8a8fb5;text-transform:uppercase;letter-spacing:0.14em;font-size:11px;width:96px;">Nombre</td>
                  <td style="padding:8px 0;color:#00ff88;">${n}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#8a8fb5;text-transform:uppercase;letter-spacing:0.14em;font-size:11px;">Correo</td>
                  <td style="padding:8px 0;"><a href="mailto:${e}" style="color:#00f5ff;text-decoration:none;">${e}</a></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <div style="margin-bottom:10px;color:#8a8fb5;text-transform:uppercase;letter-spacing:0.14em;font-size:11px;">Mensaje</div>
              <div style="background:#0a0a0f;border:1px solid #4a4f70;border-left:3px solid #f5ff00;border-radius:6px;padding:16px 18px;font-size:14px;line-height:1.6;color:#e6e9ff;">${m}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#15151f;border-top:1px solid #4a4f70;padding:16px 28px;font-size:11px;color:#4a4f70;letter-spacing:0.1em;text-transform:uppercase;">
              Insert coin &#9679; Responde a este correo para contestar al jugador
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

  const to = "benjasanchez175@gmail.com";
  const from = "Arcade Vault <onboarding@resend.dev>";
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[api/contact] Falta configuración de entorno: RESEND_API_KEY");
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
      html: buildHtml(name, email, msg),
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
