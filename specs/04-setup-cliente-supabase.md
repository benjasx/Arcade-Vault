# SPEC 04 — Setup del cliente Supabase (sin auth ni datos)

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-04
> **Objective:** Instalar y configurar el SDK de Supabase para Next.js (`@supabase/ssr`) con helpers de cliente de navegador y de servidor, sin tocar todavía la autenticación simulada ni crear ningún esquema de datos.

---

## Por qué existe esta spec

"Implementar Supabase" es demasiado amplio para una sola spec: auth real, esquema de base de datos y el propio cliente SDK son decisiones independientes. El proyecto Supabase remoto (`mrimkuambtxtoycyfxyh`) ya existe y está conectado por MCP, pero su esquema `public` tiene 0 tablas. Esta spec sienta la base técnica — instalar el SDK, dejar los helpers de cliente listos según la guía oficial de Supabase para Next.js App Router, e inicializar el CLI localmente para versionar migraciones — sin todavía sustituir `auth-provider.tsx` (login simulado con `localStorage` `av_user`) ni las puntuaciones (`av_scores`, `lib/data.ts`). Esas dos piezas van en specs posteriores.

Decisiones ya cerradas con el usuario (no reabrir):

- Esta spec **no** toca auth ni datos: `auth-provider.tsx`, `auth-form.tsx`, `av_user`, `av_scores` y `lib/data.ts` quedan exactamente como están.
- No se añade middleware/`proxy.ts` de refresco de sesión en esta spec — no hay sesiones reales que refrescar todavía.
- Las migraciones de esquema se versionan en el repo (`supabase/migrations/`), gestionadas con el CLI de Supabase.
- Las credenciales públicas del proyecto (URL y publishable key) las obtiene el propio asistente vía MCP (`get_project_url`, `get_publishable_keys`); no son secretas.

---

## Scope

**In:**

- **Dependencia**: añadir `@supabase/ssr` a `dependencies` de `package.json`.
- **Cliente de navegador** `lib/supabase/client.ts`: exporta `createClient()` usando `createBrowserClient` de `@supabase/ssr`, con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Cliente de servidor** `lib/supabase/server.ts`: exporta una función `createClient()` async usando `createServerClient` de `@supabase/ssr` y `cookies()` de `next/headers`, con `getAll`/`setAll` envuelto en `try/catch` (patrón oficial para Server Components/Route Handlers), siguiendo `node_modules/next/dist/docs/01-app/` para el uso correcto de `cookies()` en Next 16.
- **Variables de entorno**: añadir a `.env.example` (vacías, mismo patrón que las claves existentes) `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`. Añadir a `.env` (local, ya ignorado por git) los valores reales del proyecto conectado: URL `https://mrimkuambtxtoycyfxyh.supabase.co` y la publishable key moderna (`sb_publishable_...`) obtenida vía MCP.
- **CLI local de Supabase**: ejecutar `npx supabase init` en la raíz del repo para generar `supabase/config.toml` y `supabase/migrations/` (vacía), dejando el andamiaje listo para la primera migración real de una spec futura.

**Out of scope (para futuras specs):**

- Autenticación real (email/contraseña, OAuth Google/GitHub) — sigue simulada en `auth-provider.tsx`.
- Cualquier tabla, columna o migración SQL con contenido — `supabase/migrations/` queda vacía en esta spec.
- Middleware/`proxy.ts` de refresco de sesión (patrón oficial de Supabase para Next.js); se añade junto con la spec de auth real.
- `supabase link` y `supabase login` — requieren autenticación interactiva del CLI; quedan como paso manual del usuario.
- Generación de tipos TypeScript del esquema (`generate_typescript_types`) — no hay esquema todavía.
- Migrar `av_scores`, `GAMES`, `PLAYERS` o `seededScores` de `lib/data.ts` a Supabase.
- Row Level Security y políticas — no aplican sin tablas.
- Uso de los clientes creados en algún componente, página o Route Handler existente.

---

## Data model

Esta feature no introduce estructuras de datos ni tablas. El esquema `public` del proyecto Supabase permanece con 0 tablas al terminar esta spec.

Variables de entorno (convención heredada de SPEC 03: `.env` real y local, no `.env.local`; `.env.example` como plantilla vacía):

- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto, pública (visible en el bundle del cliente).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key moderna (`sb_publishable_...`), pública.
- `SUPABASE_DB_PASSWORD` — ya existente en `.env`/`.env.example`, sin cambios; usada solo por el CLI, nunca en el bundle del cliente.

Convenciones (heredadas de SPEC 01/02/03):

- Alias `@/*` para imports (`@/lib/supabase/client`, `@/lib/supabase/server`).
- `lib/supabase/server.ts` no usa `window`; es seguro en Server Components.
- `lib/supabase/client.ts` es el único de los dos pensado para importarse desde componentes `"use client"`.

---

## Implementation plan

1. **Dependencia.** `npm install @supabase/ssr`. Verificación: `@supabase/ssr` aparece en `dependencies` de `package.json`; `npm run build` sigue compilando.
2. **Variables de entorno.** Añadir a `.env.example` las dos claves vacías (`NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`). Añadir a `.env` los valores reales del proyecto `mrimkuambtxtoycyfxyh`. Verificación: `git status` no marca `.env` para commit (sigue ignorado); `.env.example` sí aparece con las claves vacías.
3. **Cliente de navegador.** Crear `lib/supabase/client.ts` con `createClient()` (`createBrowserClient` + las dos variables `NEXT_PUBLIC_*`). Verificación: `npm run lint` sin errores; el archivo no se importa todavía desde ningún componente.
4. **Cliente de servidor.** Crear `lib/supabase/server.ts` con `createClient()` async (`createServerClient` + `cookies()` de `next/headers`, `getAll`/`setAll` con `try/catch`). Consultar `node_modules/next/dist/docs/01-app/` sobre `cookies()` en Next 16 antes de escribir. Verificación: `npm run build` compila sin errores de tipos; el archivo no se importa todavía desde ningún componente.
5. **CLI local.** Ejecutar `npx supabase init` en la raíz. Verificación: existen `supabase/config.toml` y `supabase/migrations/` (vacía); el propio CLI genera su `supabase/.gitignore` para `.branches`/`.temp`.
6. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos.

---

## Acceptance criteria

- [ ] `@supabase/ssr` está en `dependencies` de `package.json`.
- [ ] `.env.example` incluye `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` vacías.
- [ ] `.env` (local, ignorado por git) contiene los valores reales de esas dos variables para el proyecto `mrimkuambtxtoycyfxyh`.
- [ ] `lib/supabase/client.ts` exporta `createClient()` que llama a `createBrowserClient` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] `lib/supabase/server.ts` exporta una función `createClient()` async que usa `createServerClient` y `cookies()` de `next/headers`, con `getAll`/`setAll`.
- [ ] Ningún componente, página o Route Handler existente importa `lib/supabase/client.ts` ni `lib/supabase/server.ts`.
- [ ] `auth-provider.tsx`, `auth-form.tsx`, `lib/data.ts` y cualquier uso de `av_user`/`av_scores` quedan sin cambios.
- [ ] `supabase/config.toml` existe en la raíz del repo tras `npx supabase init`; `supabase/migrations/` existe y está vacía.
- [ ] No se ha ejecutado `supabase link` ni `supabase login`.
- [ ] `list_tables` sobre el esquema `public` del proyecto sigue devolviendo 0 tablas.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos.

---

## Decisions

- **Sí:** acotar esta spec a instalar el SDK y los helpers de cliente, sin auth ni datos. "Implementar Supabase" completo mezcla auth, esquema y cliente SSR — tres dominios de decisión distintos. Elegido por el usuario en la fase de preguntas.
- **No:** incluir auth real (email/contraseña, OAuth) en esta spec. Va en una spec posterior que reemplace `auth-provider.tsx`.
- **No:** middleware/`proxy.ts` de refresco de sesión. Sin sesiones reales todavía no hay nada que refrescar; se añade junto con la spec de auth. Elegido por el usuario.
- **Sí:** `@supabase/ssr` con `createBrowserClient`/`createServerClient` en vez del SDK plano `@supabase/supabase-js`. Es el patrón oficial de Supabase para Next.js App Router con cookies, y ya incluye lo necesario para el cliente de navegador.
- **Sí:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formato moderno `sb_publishable_...`) en vez de la legacy anon key JWT. Es la recomendada por Supabase para proyectos nuevos; la legacy queda disponible si hiciera falta en el futuro.
- **Sí:** `npx supabase init` para dejar `supabase/config.toml` y `supabase/migrations/` listos ahora. El usuario decidió llevar las migraciones versionadas en el repo; hacerlo ahora evita montar el andamiaje en la spec que cree la primera tabla. Elegido por el usuario.
- **No:** `supabase link` / `supabase login` en esta spec. Requieren autenticación interactiva del CLI (navegador/token); quedan como paso manual del usuario, igual que rellenar `RESEND_API_KEY` en SPEC 03.
- **No:** generar tipos TypeScript del esquema. Sin tablas, el resultado sería un tipo vacío sin valor; se genera cuando exista esquema real.
- **Sí:** credenciales públicas (URL, publishable key) obtenidas por el asistente vía MCP en vez de pedírselas al usuario. No son secretas — la publishable key está pensada para viajar en el bundle del cliente. `SUPABASE_DB_PASSWORD` sí sigue siendo aportada por el usuario, por ser sensible.

---

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Confundir la publishable key con un secreto y evitarla por error                              | Se documenta explícitamente en Data model y Decisions que es pública por diseño; `SUPABASE_DB_PASSWORD` es la que sí es sensible.         |
| `npx supabase init` pisa algo existente en `supabase/`                                        | No existe esa carpeta en el repo (verificado antes de escribir esta spec); se confirma de nuevo antes de ejecutar el comando.             |
| Instalar `@supabase/ssr` sin usarlo aún puede parecer código muerto                           | Documentado en "Por qué existe esta spec" como base explícita para las specs de auth y datos que siguen.                                  |
| Next.js 16 renombra middleware a `proxy.ts`; una futura spec podría usar el nombre equivocado | Se deja fuera del scope de esta spec; la spec de auth deberá consultar `node_modules/next/dist/docs/` para el nombre correcto en Next 16. |

---

## Qué **no** entra en esta spec

- Autenticación real (login/registro/OAuth) — sigue simulada en `auth-provider.tsx`.
- Cualquier tabla, columna o contenido de migración SQL.
- Middleware/`proxy.ts` de refresco de sesión.
- `supabase link` / `supabase login`.
- Generación de tipos TypeScript del esquema.
- Migrar `av_scores`, `GAMES`, `PLAYERS` o `seededScores` a Supabase.
- Row Level Security y políticas.
- Uso de los clientes creados en componentes, páginas o Route Handlers.

Cada uno, si llega, va en su propia spec.
