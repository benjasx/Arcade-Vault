# SPEC 01 — MVP visual: todas las pantallas del prototipo en Next.js

> **Status:** implementado
> **Depends on:** —
> **Date:** 2026-08-30
> **Objective:** Portar las cinco pantallas del prototipo `references/templates/` (biblioteca, detalle, player, auth, salón) más navegación, footer y fondo a Next.js 16 App Router, solo como capa visual y sin motor de juego.

---

## Por qué existe esta spec

El prototipo `references/templates/` es un SPA estático (React 18 UMD + Babel por CDN) que define la verdad visual y de UX de Arcade Vault. `app/` todavía es el starter de create-next-app. Esta spec migra ese prototipo a la app real de Next respetando el diseño al pixel, dejando el motor de juego y el backend para specs posteriores.

Decisiones ya cerradas con el usuario (no reabrir):

- El tema CSS del prototipo (`styles.css`) se porta casi tal cual a `app/globals.css`; Tailwind solo para pegamento de layout nuevo.
- Rutas reales de App Router, no un router cliente por hash.
- Se mantiene `localStorage` para `av_user` y `av_scores`.
- La pantalla player mantiene la simulación del prototipo (score por `setInterval`, HUD, modal de fin de juego).

---

## Scope

**In:**

- Cinco pantallas portadas desde el prototipo, con paridad visual y de interacción:
  - **Biblioteca** (`biblioteca.jsx`): hero, búsqueda por nombre, filtro por categoría (chips), grid de tarjetas con efecto tilt, estado "sin resultados".
  - **Detalle** (`detalle.jsx`): portada, tags, descripción larga, tira de stats, acciones (jugar / volver), leaderboard lateral con `seededScores`.
  - **Player** (`reproductor.jsx`): HUD (jugador, puntuación, vidas, nivel), marco CRT con arena falsa animada, pausa, fin, subida de nivel automática, modal de game over con guardar puntuación.
  - **Auth** (`auth.jsx`): tabs iniciar sesión / crear cuenta, campos, botón entrar, "jugar como invitado", botones sociales inertes.
  - **Salón de la Fama** (`salon.jsx`): tabs por juego, podio 1-2-3, tabla de ranking, fila "tu mejor marca" si hay usuario.
- **Navegación** (`nav.jsx`): barra sticky con logo, enlaces, contador de créditos, botón de sesión, panel móvil con backdrop.
- **Layout global**: capas de fondo (`.av-bg`, `.av-noise`), `<main class="av-main">`, footer con `© 2026 ARCADE VAULT · … · v2.6.0`.
- **Tema**: `app/globals.css` con la paleta neón, fuentes (`--pixel`, `--mono`), clases de componente (`.btn`, `.card`, `.crt`, `.leaderboard`, `.podium`, …), generadores de portada por CSS (`.cover-*`) y animaciones (`flicker`, `fade-in`, CRT, `gridscroll`, `typewriter`).
- **Datos mock** en un módulo TS: `GAMES`, `CATS`, `PLAYERS`, `seededScores(seed, count)`.
- **Estado de sesión simulada**: `localStorage` clave `av_user` (`{ name: string }` o ausente), expuesto por un contexto cliente. Cualquier credencial entra; "invitado" = sin usuario.
- **Puntuaciones guardadas**: `localStorage` clave `av_scores`, array de `{ game, score, name, at }`. Se escriben desde el modal de game over. No se leen en ninguna pantalla de esta spec (los leaderboards usan `seededScores`).
- **Responsive**: solo los breakpoints que ya trae `styles.css` (840px nav, 900px detalle, 720px grid/hall/podio).

**Out of scope (para futuras specs):**

- Motor de juego real de cualquiera de los 8 títulos.
- Backend, autenticación real, OAuth de Google/GitHub (los botones quedan inertes).
- Leaderboards reales: persistir, leer y rankear `av_scores` en detalle o salón.
- Página de cuenta / perfil de usuario (el botón de usuario en Nav solo cierra sesión, como en el prototipo).
- Contador de créditos funcional (queda fijo en `03`).
- Tests automatizados (no hay framework configurado).
- Accesibilidad más allá de la del prototipo (focus states, `aria` extra, `prefers-reduced-motion`).
- Modo claro / theming; la app es dark-only.
- SEO, `metadata` por juego, Open Graph, sitemap.

---

## Data model

Módulo nuevo `lib/data.ts` (portado de `data.jsx`, tipado):

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string; // "bloque-buster"
  title: string; // "BLOQUE BUSTER"
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS: "cover-bricks"
  color: NeonColor;
  best: number;
  plays: string; // "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "07/03/2026"
}

export const GAMES: Game[];
export const CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export const PLAYERS: readonly string[];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Módulo nuevo `lib/scores.ts` (persistencia de puntuaciones guardadas):

```ts
export interface SavedScore {
  game: string; // Game["id"]
  score: number;
  name: string; // iniciales, <= 10 chars, mayúsculas
  at: number; // Date.now()
}

export function saveScore(entry: Omit<SavedScore, "at">): void; // append a av_scores
export function getScores(): SavedScore[]; // lectura tolerante a fallos
```

Contexto de sesión `components/auth-provider.tsx`:

```ts
export interface AuthUser {
  name: string;
} // iniciales en mayúsculas, <= 10 chars

export interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean; // true tras leer localStorage en cliente (evita mismatch de hidratación)
  signIn: (name: string) => void; // guarda av_user
  signOut: () => void; // borra av_user
}
```

Claves de `localStorage` (idénticas al prototipo, sin versionar):

- `av_user` → `AuthUser` serializado, o ausente.
- `av_scores` → `SavedScore[]` serializado.

Convenciones:

- Server Components por defecto. Llevan `"use client"` solo: `auth-provider`, `nav`, y los cinco componentes de pantalla (usan estado, efectos o `localStorage`).
- Las páginas (`app/**/page.tsx`) son Server Components finos: resuelven `params` (que en Next 16 es una `Promise`) y renderizan el componente de pantalla cliente pasándole props planas.
- Alias `@/*` para imports (`@/lib/data`, `@/components/nav`).
- Números formateados con `toLocaleString("es-ES")`, igual que el prototipo.

---

## Implementation plan

1. **Tema.** Reemplazar `app/globals.css` por el contenido de `references/templates/styles.css`, adaptado: mantener `@import "tailwindcss"` arriba; declarar la paleta y `--pixel` / `--mono` en `@theme inline`; quitar reglas sobre `#root` (no existe en Next) y trasladar sus propiedades (`position`, `z-index`, `display:flex column`) a `body` o a un wrapper del layout. Sin cambios de árbol todavía; la app compila con el starter aún visible.
2. **Fuentes y layout base.** En `app/layout.tsx`: cargar `Press Start 2P` y `JetBrains Mono` con `next/font/google`, exponerlas como `--pixel` / `--mono` en el `<body>`. Añadir `<div class="av-bg" />` y `<div class="av-noise" />` antes del contenido, envolver el contenido en `<main class="av-main">` y añadir el `<footer>` del prototipo. `lang="es"`. Verificación: `npm run dev`, se ve el fondo de rejilla en perspectiva y el footer.
3. **Datos mock.** Crear `lib/data.ts` con `GAMES`, `CATS`, `PLAYERS`, `seededScores` y los tipos, portados de `data.jsx`. Sin `window.*`; exports ES.
4. **Contexto de sesión.** Crear `components/auth-provider.tsx` (`"use client"`) con el contexto descrito, leyendo/escribiendo `av_user` y con flag `ready`. Montarlo en `app/layout.tsx` envolviendo Nav + main. Exponer `useAuth()`.
5. **Persistencia de puntuaciones.** Crear `lib/scores.ts` con `saveScore` y `getScores`, ambos protegidos con `typeof window === "undefined"` y `try/catch`.
6. **Nav.** Crear `components/nav.tsx` (`"use client"`) portando `nav.jsx`: enlaces con `next/link` a `/` y `/salon`, estado activo con `usePathname`, panel móvil con estado `open`. Botón de sesión: si `useAuth().user`, muestra `NAME ▾` y llama `signOut`; si no, enlaza a `/login`. Montar en el layout sobre `<main>`. Verificación: la barra aparece en todas las rutas y el panel móvil abre/cierra bajo 840px.
7. **Biblioteca.** `components/library-screen.tsx` (`"use client"`) portando `biblioteca.jsx` + `GameCard` (efecto tilt con `ref`). `app/page.tsx` la renderiza. Al pulsar una tarjeta o `JUGAR`, `router.push('/juego/' + id)`. Verificación: grid de 8 juegos, búsqueda filtra por título, chips filtran por categoría, "NO HAY RESULTADOS" cuando no hay match.
8. **Detalle.** `components/game-detail.tsx` (`"use client"`) portando `detalle.jsx`. `app/juego/[id]/page.tsx` resuelve `params`, busca el juego en `GAMES`; si no existe, `notFound()`. Leaderboard con `seededScores(id.length * 17 + 3, 10)`. Botones: `JUGAR AHORA` → `/juego/[id]/jugar`; `VOLVER AL VAULT` → `/`. Crear `app/not-found.tsx` con estilo del prototipo. Verificación: `/juego/caida` muestra ficha y ranking; `/juego/xxx` muestra la página 404.
9. **Player.** `components/game-player.tsx` (`"use client"`) portando `reproductor.jsx`: `setInterval` de score (limpiado en pausa/fin/unmount), subida de nivel, HUD, arena CRT, modal de game over. Nombre inicial: `useAuth().user?.name ?? "INVITADO"`. `GUARDAR PUNTUACIÓN` llama `saveScore({ game, score, name })`. `app/juego/[id]/jugar/page.tsx` resuelve `params` y hace `notFound()` si el juego no existe. `SALIR` → `/juego/[id]`; `VOLVER AL VAULT` → `/`. Verificación: la puntuación sube sola, PAUSA la congela, FIN abre el modal, guardar muestra el toast `▸ PUNTUACIÓN GUARDADA_`.
10. **Auth.** `components/auth-form.tsx` (`"use client"`) portando `auth.jsx`. `app/login/page.tsx` la renderiza. `submit` llama `signIn((user || "PLAYER1"))` y `router.push('/')`. `JUGAR COMO INVITADO` llama `signOut()` y navega a `/`. Botones sociales sin handler. Verificación: enviar el formulario deja el nombre en la Nav y redirige a la biblioteca.
11. **Salón.** `components/hall-of-fame.tsx` (`"use client"`) portando `salon.jsx`. `app/salon/page.tsx` la renderiza. Tabs por juego, `seededScores(tab.length * 23 + 7, 12)`, podio, tabla, y bloque "TU MEJOR MARCA" solo si `useAuth().user`. `VOLVER A LA BIBLIOTECA` → `/`. Verificación: cambiar de tab recalcula podio y tabla; con sesión aparece la fila amarilla del usuario.
12. **Limpieza.** Borrar restos del starter no usados (`app/page.tsx` viejo ya reemplazado, cualquier CSS starter). `npm run lint` y `npm run build` sin errores.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos.
- [ ] Las rutas `/`, `/juego/[id]`, `/juego/[id]/jugar`, `/login`, `/salon` cargan sin errores en consola.
- [ ] En todas las rutas se ven: barra de navegación sticky, capa de fondo con rejilla en perspectiva, footer `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`.
- [ ] Biblioteca muestra las 8 tarjetas de `GAMES` con su portada CSS, categoría, mejor puntuación y botón JUGAR.
- [ ] Escribir en el buscador filtra las tarjetas por título (case-insensitive); un término sin coincidencias muestra el bloque "NO HAY RESULTADOS".
- [ ] Los chips `TODOS / ARCADE / PUZZLE / SHOOTER / VERSUS` filtran por categoría y marcan el activo en magenta.
- [ ] Pulsar una tarjeta o su botón JUGAR navega a `/juego/<id>`.
- [ ] Detalle muestra portada, tags, descripción larga, tira de stats y un leaderboard de 10 filas con top 1/2/3 coloreados.
- [ ] `/juego/<id-inexistente>` renderiza la página `not-found` con estilo arcade, no un error.
- [ ] En Player la puntuación aumenta automáticamente; PAUSA la detiene y muestra el overlay "EN PAUSA"; REANUDAR la reactiva.
- [ ] En Player, el Nivel sube al cruzar cada umbral de 2500 puntos.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación final; GUARDAR PUNTUACIÓN añade una entrada a `localStorage.av_scores` y muestra el toast `▸ PUNTUACIÓN GUARDADA_`.
- [ ] JUGAR DE NUEVO reinicia score, vidas, nivel y cierra el modal.
- [ ] Auth: enviar el formulario (con o sin usuario escrito) guarda `av_user` y redirige a `/`; la Nav pasa a mostrar `NOMBRE ▾`.
- [ ] "JUGAR COMO INVITADO" borra `av_user` y va a `/`; la Nav vuelve a mostrar "Iniciar Sesión".
- [ ] Recargar la página mantiene el estado de sesión leído de `av_user` sin parpadeo de contenido incorrecto (flag `ready`).
- [ ] Salón: cambiar de tab de juego recalcula podio y tabla; con sesión activa aparece la fila "TU MEJOR MARCA EN <JUEGO>" en amarillo, y sin sesión no aparece.
- [ ] Bajo 840px de ancho, los enlaces del nav se ocultan y el botón ≡ abre el panel lateral con backdrop.
- [ ] No hay warnings de hidratación de React en consola en ninguna pantalla.

---

## Decisions

- **Sí:** portar `styles.css` casi literal a `app/globals.css`. Es la especificación visual; reescribirlo en Tailwind multiplica el trabajo y el riesgo de desviación. Tailwind queda disponible para layout nuevo.
- **No:** reescribir el tema como utilidades Tailwind. Se descartó por coste/beneficio en un MVP visual.
- **Sí:** rutas reales de App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/login`, `/salon`). Idiomático en Next 16, da URLs compartibles y 404 nativo.
- **No:** replicar el router por hash de `app.jsx`. Solo tendría sentido para un port 1:1 sin tocar arquitectura.
- **Sí:** mantener `localStorage` para `av_user` y `av_scores` con las mismas claves del prototipo. Es trivial y forma parte de la UX (la Nav reacciona al login).
- **No:** versionar las claves (`av_user:v1`). El prototipo no lo hace y no hay migración que proteger en un MVP visual.
- **Sí:** contexto cliente `AuthProvider` en el layout con flag `ready`. Nav y varias pantallas necesitan el usuario; el flag evita el mismatch de hidratación al leer `localStorage`.
- **Sí:** mantener la simulación de la partida en Player (score por `setInterval`, modal de fin). "No implementar ningún juego" = sin motor real; la maqueta animada del HUD sí es parte de la pantalla.
- **No:** congelar Player en estático. Perdería paridad con `reproductor.jsx` sin ahorrar apenas trabajo.
- **Sí:** fuentes con `next/font/google` (`Press Start 2P`, `JetBrains Mono`) expuestas como `--pixel` / `--mono`, según convención del proyecto (`CLAUDE.md`), en vez del `<link>` a Google Fonts del prototipo. `Courier Prime` queda solo como fallback en la cadena `--mono`.
- **Sí:** datos mock en `lib/data.ts` con tipos TS y exports ES, en lugar de `window.GAMES` del prototipo.
- **No:** leer `av_scores` en los leaderboards de detalle/salón. Los rankings siguen con `seededScores`; integrar puntuaciones reales es otra spec.
- **No:** página de cuenta/perfil. El botón de usuario solo cierra sesión, como en el prototipo.

---

## Risks

| Riesgo                                                                                           | Mitigación                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `localStorage` no disponible en SSR o modo privado                                               | `lib/scores.ts` y `AuthProvider` protegidos con `typeof window === "undefined"` y `try/catch`; la app funciona sin persistir.                                                              |
| Mismatch de hidratación al pintar UI derivada de `localStorage` (usuario en Nav, fila del salón) | `AuthProvider` expone `ready`; los consumidores renderizan el estado "sin usuario" hasta que `ready` es `true`.                                                                            |
| Next 16: `params` es `Promise` y los tipos `PageProps` son globals autogenerados                 | Las páginas `await params`; no importar tipos de `next`; regenerar con `next dev` / `next build`. Consultar `node_modules/next/dist/docs/` antes de escribir el código de rutas dinámicas. |
| `next/font` con `Press Start 2P` (subset limitado) podría no cubrir glifos                       | Cadena de fallback `system-ui, monospace` en `--pixel`; el texto es todo ASCII en mayúsculas.                                                                                              |
| El efecto tilt de `GameCard` manipula `style.transform` directamente                             | Portar tal cual con `ref`; sin `transform` en JSX que compita. Aceptable para MVP.                                                                                                         |

---

## Qué **no** entra en esta spec

- Motores de juego reales.
- Backend, login real y OAuth (Google/GitHub inertes).
- Leaderboards con datos reales (persistir/leer/rankear `av_scores`).
- Página de cuenta o perfil.
- Contador de créditos funcional.
- Tests automatizados.
- Modo claro / theming.
- Metadatos SEO por juego.

Cada uno, si llega, va en su propia spec.
