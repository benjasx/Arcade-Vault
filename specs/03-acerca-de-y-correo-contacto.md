# SPEC 03 — Página "Acerca de" y envío de correo del formulario de contacto

> **Status:** implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-02
> **Objective:** Portar la página "Acerca de" de `references/templates/home-about/about.jsx` a la ruta `/acerca-de` y conectar su formulario de contacto a un Route Handler que envía la notificación al equipo con Resend.

---

## Por qué existe esta spec

SPEC 02 añadió el enlace "Acerca de" → `/acerca-de` al nav como desviación, pero sin crear la página: hoy esa ruta cae en `app/not-found.tsx`. El prototipo `references/templates/home-about/about.jsx` define esa pantalla (hero de misión, banda divisoria, formulario de contacto con animación de terminal). En el prototipo el envío está **simulado** (`setSent(form.name)` sin red). Esta spec crea la ruta real y sustituye la simulación por un envío real con Resend a través de un Route Handler, dejando la API key y las direcciones en variables de entorno que el usuario rellena aparte.

Decisiones ya cerradas con el usuario (no reabrir):

- Ruta `/acerca-de` (el enlace del nav ya apunta ahí).
- Envío vía Route Handler `app/api/contact/route.ts`; el formulario sigue siendo componente cliente y hace `fetch`.
- Resend manda **solo** una notificación al equipo (`replyTo` = correo del visitante). Sin autorespuesta al visitante.
- Se incluye un campo honeypot oculto.
- `RESEND_API_KEY` y las direcciones van solo en variables de entorno; el usuario aporta los valores reales después.

---

## Scope

**In:**

- **Ruta** `app/acerca-de/page.tsx` (Server Component fino) que renderiza `<AboutScreen />`.
- **`components/about-screen.tsx`** (`"use client"`), portado de `about.jsx` con paridad visual y de interacción:
  - Hook `useReveal` con `IntersectionObserver` (umbral 0.12, `unobserve` al entrar, `disconnect` en cleanup), mismo patrón que `components/home-screen.tsx`.
  - `HighlightIcon` con los 3 SVG pixel inline (`HEART`, `BROWSER`, `PLANT`).
  - Sección `about-hero`: kicker "▸ ACERCA DE", `about-title` "ACERCA DE ARCADE VAULT", `about-mission`, `highlight-row` con 3 `highlight` (color por tarjeta y `transitionDelay` por índice).
  - `about-divider` decorativo (`reveal`, `aria-hidden`) con 24 `span` y `animationDelay` por índice.
  - Sección `about-contact` (`reveal`): `contact-grid` con `contact-intro` (kicker "▸ CONTACTO", `contact-title` "CONTÁCTANOS", `contact-sub`, 3 `tip`) y `contact-form`.
- **Formulario de contacto** dentro de `about-screen.tsx`:
  - Campos controlados `name`, `email`, `msg` con los mismos `label`/`placeholder` del prototipo, más un campo honeypot oculto `company`.
  - Validación cliente: si `name`, `email` o `msg` están vacíos tras `trim()`, se aplica la clase `shake` 400 ms y no se hace ninguna petición (igual que el prototipo).
  - Envío: `fetch("/api/contact", { method: "POST", headers JSON, body: JSON.stringify({ name, email, msg, company }) })`.
  - Durante la petición: botón deshabilitado con texto "ENVIANDO…".
  - Respuesta `200`: se muestra `terminal-success` con las líneas estáticas del prototipo y `{sent.toUpperCase()}` en la última línea; el botón "ENVIAR OTRO MENSAJE" limpia `sent`, `error` y `form`.
  - Respuesta no-`200` o error de red: mensaje `.contact-error` bajo el botón (nuevo; el prototipo no lo tiene), formulario editable para reintentar, sin animación de terminal.
- **Route Handler** `app/api/contact/route.ts`:
  - `export const runtime = "nodejs"`.
  - `POST` recibe JSON `{ name, email, msg, company }`.
  - Si `company` (honeypot) no está vacío → responde `200 { ok: true }` sin enviar.
  - Valida: `name`, `email`, `msg` no vacíos tras `trim()`; `email` con formato válido (regex simple). Fallo → `400 { ok: false, error }`.
  - Envía con el SDK `resend`: `from: CONTACT_FROM`, `to: CONTACT_TO`, `replyTo: email`, asunto tipo `▸ Nuevo mensaje de contacto — {name}`, cuerpo de texto plano con nombre, correo y mensaje.
  - Éxito → `200 { ok: true }`. Error de Resend → `502 { ok: false }` + `console.error`. `RESEND_API_KEY` ausente → `500 { ok: false }` + log claro.
- **CSS** (`app/globals.css`): añadir el bloque `/* ===== ABOUT PAGE ===== */` de `references/templates/home-about/styles.css` (`.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.highlight*`, `.about-divider`, `.div-bar`, `.div-pixels*`, `.about-contact`, `.contact-grid`, `.contact-intro*`, `.contact-title`, `.contact-sub`, `.contact-tips*`, `.contact-form*`, `.terminal-success`, `.term-*`) más `@keyframes shake` y `@keyframes pxblink`. Añadir una regla mínima nueva `.contact-error` (texto mono en rojo, bajo el botón). **No** duplicar `.reveal` / `.reveal.in` (ya en `globals.css` por SPEC 02), `.field*` (ya por SPEC 01) ni `@keyframes blink` (ya presente).
- **Dependencia**: añadir `resend` a `dependencies` de `package.json` (`npm i resend`).
- **Entorno**: crear `.env.example` con `RESEND_API_KEY=`, `CONTACT_TO=`, `CONTACT_FROM=` y añadir la excepción `!.env.example` a `.gitignore` (que hoy ignora `.env*`). El usuario rellena `.env.local` con los valores reales, incluida la API key, después.

**Out of scope (para futuras specs):**

- Autorespuesta o email de confirmación al visitante.
- Persistir los mensajes (base de datos, archivo o `localStorage`).
- Rate-limiting por IP, captcha o verificación de dominio/DNS en Resend (la configuración de Resend la hace el usuario fuera del repo).
- Plantilla de email rica (React Email, HTML diseñado); el cuerpo es texto plano.
- Metadata SEO por página para `/acerca-de`; se mantiene la global (consistente con SPEC 01 y SPEC 02).
- `prefers-reduced-motion` para `reveal`, `pxblink` o `shake`.
- Tests automatizados (no hay framework configurado).
- i18n del email (queda en español fijo).
- Cambiar textos, iconos o placeholders respecto al prototipo.
- Reintentos automáticos o cola si Resend falla.

---

## Data model

Esta feature no introduce estructuras persistentes. Formas en tránsito:

```ts
// cuerpo de POST /api/contact
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
```

Estado local de `components/about-screen.tsx`:

```ts
const [form, setForm] = useState({ name: "", email: "", msg: "", company: "" });
const [sent, setSent] = useState<string | null>(null); // nombre enviado; activa terminal-success
const [shake, setShake] = useState(false);
const [sending, setSending] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Variables de entorno (no versionadas; `.env.local` local al usuario):

- `RESEND_API_KEY` — clave de API de Resend.
- `CONTACT_TO` — dirección que recibe las notificaciones.
- `CONTACT_FROM` — remitente verificado en Resend (p.ej. `Arcade Vault <contacto@dominio>`).

Convenciones (heredadas de SPEC 01 / SPEC 02):

- `about-screen.tsx` lleva `"use client"` (usa estado, `IntersectionObserver` y `fetch`).
- `app/acerca-de/page.tsx` es Server Component fino.
- El Route Handler no usa `window`.
- Alias `@/*` para imports.

---

## Implementation plan

1. **CSS de la página.** Añadir a `app/globals.css` el bloque ABOUT PAGE de `references/templates/home-about/styles.css` más `@keyframes shake` y `@keyframes pxblink`, y una regla nueva `.contact-error`. Omitir `.reveal` / `.reveal.in`, `.field*` y `@keyframes blink` (ya presentes). Sin cambios de árbol todavía. Verificación: `npm run dev` sin errores de PostCSS; `/acerca-de` sigue siendo 404.
2. **Dependencia y entorno.** `npm i resend`. Crear `.env.example` con las tres claves vacías. Añadir `!.env.example` a `.gitignore`. Verificación: `resend` aparece en `package.json`; `git status` muestra `.env.example` como archivo no ignorado; `npm run build` compila.
3. **Route Handler.** Crear `app/api/contact/route.ts` con `runtime = "nodejs"` y `POST`: honeypot → `200` sin enviar; validación de campos y formato de email → `400`; `new Resend(process.env.RESEND_API_KEY)` + `resend.emails.send({...})`; mapear a `ContactResponse` con `200` / `400` / `502` / `500`. Consultar `node_modules/next/dist/docs/01-app/` sobre Route Handlers antes de escribir. Verificación: `curl -X POST localhost:3000/api/contact` con cuerpo válido devuelve `{ ok: true }` (o `502`/`500` si la key falta); sin `msg` devuelve `400`; con `company` relleno devuelve `200` sin enviar.
4. **`AboutScreen` — estático.** Crear `components/about-screen.tsx` (`"use client"`) con `useReveal`, `HighlightIcon`, la sección `about-hero`, el `about-divider` y la estructura de `about-contact` con el `<form>` (campos controlados + honeypot oculto). `onSubmit` de momento solo `preventDefault` + validación `shake`. Crear `app/acerca-de/page.tsx` renderizando `<AboutScreen />`. Verificación: `/acerca-de` muestra hero, highlights con glow por color, divider animado y el formulario; enviar vacío dispara el `shake`; el nav marca "Acerca de" activo y ya no cae en la 404.
5. **Envío real + estados.** En `about-screen.tsx`: `onSubmit` async → `setSending(true)`, `fetch("/api/contact", ...)`, y según respuesta: `200` → `setSent(form.name.trim())`; no-`200`/`throw` → `setError(...)`; `finally` → `setSending(false)`. Botón "ENVIANDO…" deshabilitado mientras `sending`. Render de `terminal-success` cuando `sent` (líneas del prototipo, `{sent.toUpperCase()}`), con "ENVIAR OTRO MENSAJE" que limpia `sent`, `error` y `form`. Mensaje `.contact-error` bajo el botón cuando `error`. Verificación: con `.env.local` válido, enviar el form muestra la terminal; con la key inválida, aparece `.contact-error` y el form sigue editable; "ENVIAR OTRO MENSAJE" resetea.
6. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos. Consola sin warnings de hidratación en `/acerca-de`. Confirmar que el bloque de agentes regenerado en `AGENTS.md` va junto al commit, no se borra.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos.
- [ ] `/acerca-de` renderiza la página de about: hero con kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", párrafo de misión y 3 `highlight` (HEART, BROWSER, PLANT) con icono pixel y color propio.
- [ ] El `about-divider` y la sección `about-contact` empiezan ocultos (`.reveal`) y pasan a visibles una sola vez al hacer scroll.
- [ ] El nav marca "Acerca de" como activo en `/acerca-de` (barra y panel móvil); la ruta ya no cae en `app/not-found.tsx`.
- [ ] Enviar el formulario con `NOMBRE`, `CORREO` o `MENSAJE` vacío aplica la animación `shake` y no hace ninguna petición.
- [ ] Con los tres campos rellenos, al pulsar "▶ ENVIAR MENSAJE" el botón pasa a "ENVIANDO…" y queda deshabilitado hasta la respuesta.
- [ ] `POST /api/contact` con cuerpo válido y `RESEND_API_KEY` / `CONTACT_TO` / `CONTACT_FROM` configurados envía un email a `CONTACT_TO` desde `CONTACT_FROM` con `replyTo` igual al correo del visitante y responde `{ ok: true }`.
- [ ] Tras respuesta `200` el formulario se sustituye por `terminal-success` con la línea final "> MENSAJE RECIBIDO… GRACIAS, {NOMBRE}." en mayúsculas y un cursor parpadeante.
- [ ] "ENVIAR OTRO MENSAJE" vuelve a mostrar el formulario vacío y sin `.contact-error`.
- [ ] `POST /api/contact` sin `msg` o con email mal formado responde `400`; el cliente muestra `.contact-error` bajo el botón con el formulario aún editable.
- [ ] Si Resend falla o `RESEND_API_KEY` está ausente, la ruta responde `502` / `500`, el cliente muestra `.contact-error` y no aparece la animación de terminal.
- [ ] `POST /api/contact` con el campo honeypot `company` no vacío responde `200` y NO envía email.
- [ ] El campo honeypot no es visible ni alcanzable con el tabulador en la UI.
- [ ] `resend` está en `dependencies` de `package.json`; `.env.example` existe con las tres claves vacías y `.gitignore` no ignora `.env.example`.
- [ ] No hay warnings de hidratación de React en consola en `/acerca-de`.
- [ ] No se han añadido `.reveal`, `.field` ni `@keyframes blink` duplicados a `globals.css`.

---

## Decisions

- **Sí:** ruta `/acerca-de`. El enlace ya existe en el nav desde la desviación de SPEC 02; esta spec solo rellena el destino.
- **Sí:** Route Handler `app/api/contact/route.ts` + `fetch` desde el cliente. Mantiene el formulario controlado y la animación de terminal en cliente, igual que el prototipo, y es probable con `curl`. Elegido por el usuario frente a Server Action.
- **No:** Server Action. Obligaría a reestructurar el manejo de estado y de errores del cliente y la animación de éxito, sin beneficio claro en un MVP.
- **Sí:** SDK oficial `resend`. Menos superficie que armar la request REST a mano.
- **Sí:** solo notificación al equipo con `replyTo` al visitante. El prototipo dice "te responderemos", no promete confirmación automática. Elegido por el usuario.
- **No:** autorespuesta al visitante. Duplica plantillas y coste y añade riesgo de rebote/spam; si llega, otra spec.
- **Sí:** honeypot oculto (`company`). Coste cero, un solo campo, frena bots triviales. Elegido por el usuario.
- **No:** rate-limiting en memoria / captcha. Frágil en serverless y desproporcionado para el MVP; va en otra spec si hace falta.
- **Sí:** API key y direcciones solo en variables de entorno, con `.env.example` como plantilla. El usuario aporta los valores reales después; nada sensible entra al repo.
- **Sí:** `runtime = "nodejs"` en el Route Handler. El SDK de Resend no está pensado para el runtime edge.
- **Sí:** añadir estado de error (`.contact-error`, botón "ENVIANDO…"). El prototipo no cubre el fallo de red o de servicio; sin esto un envío fallido sería silencioso.
- **No:** metadata SEO por página para `/acerca-de`. Se mantiene la global, consistente con SPEC 01 y SPEC 02.
- **No:** persistir los mensajes. El canal es el email; una base de datos es otra spec.
- **Sí:** portar solo el bloque CSS ABOUT PAGE (+ `@keyframes shake` / `pxblink`). Es lo único que `about.jsx` usa que no está ya en `globals.css`.

---

## Riesgos

| Riesgo                                                                               | Mitigación                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY` ausente en local o en el deploy                                     | El Route Handler detecta la falta y responde `500` con `console.error`; el cliente muestra `.contact-error`. El build no depende de la variable. |
| Dominio o remitente no verificado en Resend → el envío se rechaza                    | Fuera del scope del repo (lo configura el usuario). La ruta devuelve `502` y el cliente informa; documentado en `.env.example`.                  |
| `.env.example` ignorado por el patrón `.env*` de `.gitignore`                        | El paso 2 añade la excepción `!.env.example`. Un criterio de aceptación lo verifica.                                                             |
| El honeypot no frena bots avanzados                                                  | Aceptado para el MVP; rate-limiting y captcha quedan explícitamente fuera de scope para otra spec.                                               |
| Warnings de hidratación si el formulario deriva algo de `window` en el primer render | Todo el estado inicial es estático; `useReveal` solo toca el DOM en `useEffect`, igual que `home-screen.tsx`. Verificado en criterios.           |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear                | Se commitea junto al trabajo; borrarlo del diff solo lo regenera (documentado en `CLAUDE.md` / `AGENTS.md`).                                     |

---

## Qué **no** entra en esta spec

- Autorespuesta o confirmación al visitante.
- Persistencia de los mensajes.
- Rate-limiting, captcha o verificación de dominio en Resend.
- Plantilla de email rica (React Email).
- Metadata SEO por página para `/acerca-de`.
- `prefers-reduced-motion`.
- Tests automatizados.
- Cambios en textos, iconos o placeholders del prototipo.

Cada uno, si llega, va en su propia spec.
