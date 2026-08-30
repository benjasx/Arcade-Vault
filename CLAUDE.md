# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Qué es (ver README.md)

Arcade Vault es una plataforma para jugar online y competir por la mayor puntuación.

## Flujo de trabajo: Spec-Driven Design

El desarrollo sigue diseño guiado por especificación con los comandos `/spec` (redactar la spec de una feature) y `/spec-impl` (implementarla). No implementes features sin su spec previa. Buenas prácticas y skills provienen de `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`; ref: https://github.com/Klerith/fernando-skills).

## Regla previa obligatoria (ver AGENTS.md)

Este proyecto usa **Next.js 16.3.3**, una versión con breaking changes respecto a lo que conoces. Antes de escribir cualquier código de Next, lee la guía relevante en `node_modules/next/dist/docs/` (índice en `.../docs/index.md`, App Router en `.../docs/01-app/`). No inventes APIs ni convenciones por memoria.

El bloque de instrucciones para agentes al final de `AGENTS.md` lo regenera `next dev` en cada arranque (`node_modules/next/dist/server/lib/generate-agent-files.js`). Si aparece como cambio sin commitear, va junto con tu trabajo; borrarlo del diff solo hace que se vuelva a crear.

## Comandos

- `npm run dev` — servidor de desarrollo (Turbopack por defecto en Next 16).
- `npm run build` — build de producción.
- `npm run start` — sirve el build.
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`). No hay `next lint`; se invoca `eslint` directo.

No hay framework de tests configurado.

## Skills

Usa siempre /frontend-design Para diseñar la interfaz de usuario

## Stack y convenciones

- **App Router** (`app/`), sin `src/`. Server Components por defecto; marca `"use client"` solo donde haga falta interactividad.
- **TypeScript strict**. Alias `@/*` → raíz del repo (`tsconfig.json`).
- **Tipos de rutas autogenerados**: `layout.tsx` usa `LayoutProps<"/">` y las páginas usan `PageProps<...>` como **globals** que Next genera en `.next/types`. No los importes desde `next`; se regeneran con `next dev` / `next build`.
- **Tailwind CSS v4**: sin `tailwind.config`. Se activa con `@import "tailwindcss"` en `app/globals.css` y el plugin `@tailwindcss/postcss` (`postcss.config.mjs`). Los tokens de tema se declaran con `@theme inline` dentro de `globals.css`.
- Fuentes vía `next/font/google` en `app/layout.tsx`.

Estado actual de `app/`: todavía es el starter de create-next-app; la migración del prototipo aún no está hecha.

## Prototipo de referencia: `resources/templates/`

Es la **especificación visual y de UX** de la app a construir ("Arcade Vault", un portal de juegos retro-arcade). NO es parte del build de Next: es un SPA estático (React 18 UMD + Babel Standalone cargado desde CDN en `Arcade Vault.html`). Úsalo como fuente de verdad para diseño y flujos al implementar en Next; no lo importes ni lo copies tal cual.

Estructura del prototipo:

- `Arcade Vault.html` — shell; monta `#root` y carga los `.jsx` en orden.
- `app.jsx` — router cliente por hash con objetos de ruta `{ name, id }`. Pantallas: `biblioteca` → `detalle` → `player`, más `auth` y `salon`. Persiste en `localStorage`: `av_user`, `av_scores`.
- `nav.jsx` — barra de navegación + panel móvil.
- `biblioteca.jsx` (Library) — grid de juegos con búsqueda y filtro por categoría.
- `detalle.jsx` (GameDetail) — ficha de juego + leaderboard.
- `reproductor.jsx` (GamePlayer) — reproductor con HUD; la partida está **simulada** (score por `setInterval`), no hay motor de juego real.
- `auth.jsx` — login/registro simulado (cualquier credencial entra).
- `salon.jsx` (HallOfFame) — ranking por juego con podio.
- `data.jsx` — datos mock: `GAMES`, `CATS`, `PLAYERS` y `seededScores(seed, count)` (generador determinista de rankings). Textos en español.
- `styles.css` — tema completo: paleta neón (`--cyan`, `--magenta`, `--yellow`, `--green`), fuentes `Press Start 2P` (`--pixel`) y `JetBrains Mono` (`--mono`), clases de animación (`fade-in`, `flicker`, efecto CRT).
