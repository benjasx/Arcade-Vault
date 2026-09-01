# SPEC 02 — Homepage: landing en la raíz y biblioteca en /juegos

> **Status:** aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-08-31
> **Objective:** Portar la landing `references/templates/home-about/home.jsx` a `app/page.tsx`, mover la biblioteca actual a `/juegos` y añadir el enlace "Inicio" a la navegación.

---

## Por qué existe esta spec

SPEC 01 dejó la biblioteca (grid de juegos) en la raíz `/`. El prototipo `references/templates/home-about/` introduce una landing de marketing (hero, features, preview de juegos, stats, actividad en vivo, precios y CTA final) que debe ser la primera pantalla en `/`, y un `nav.jsx` con un enlace "Inicio" separado de "Biblioteca". Esta spec incorpora esa landing y reubica la biblioteca, sin tocar el motor de juego ni el backend.

Decisiones ya cerradas con el usuario (no reabrir):

- La landing vive en `/`; la biblioteca pasa a `/juegos`. Sustituye el routing de SPEC 01 en ese punto.
- Solo se añade el enlace "Inicio" al nav. La página "Acerca de" (`about.jsx`) y su enlace quedan para otra spec.
- Los arrays de la sección "Actividad en vivo" (ticker de últimas puntuaciones y top jugadores de hoy) se mantienen escritos a mano dentro del componente, igual que el prototipo.
- Del `styles.css` del prototipo se portan solo los bloques HOME PAGE, ACTIVITY y PRICING. El bloque `.gp` (gamepad) y el bloque ABOUT PAGE no se portan.

---

## Scope

**In:**

- **Landing** portada desde `home.jsx` con paridad visual y de interacción, en un componente cliente `components/home-screen.tsx`:
  - **Hero**: eyebrow "▸ INSERTA UNA MONEDA\_", título en tres líneas, subtítulo, dos CTAs (`▶ EXPLORAR JUEGOS`, `✦ CREAR CUENTA`), indicador "DESLIZA ▼" y siluetas pixel flotantes decorativas (`FloatingSilhouettes`, 8 SVGs inline, `aria-hidden`).
  - **// 01 ¿POR QUÉ ARCADE VAULT?**: grid de 4 `feature-card` con icono pixel inline (`FeatureIcon`: GAMEPAD, FREE, TROPHY, ROCKET) y color por tarjeta.
  - **// 02 JUEGOS DISPONIBLES AHORA**: `mini-rail` con `GAMES.slice(0, 6)` de `lib/data.ts` (`MiniCard`, portada CSS `cover-*`), cada tarjeta navega a `/juego/<id>`; botón "VER TODOS LOS JUEGOS →" a `/juegos`.
  - **Stats**: banda con 3 `stat-block` (valores fijos "12+", "MILES", "GLOBAL").
  - **// 03 ACTIVIDAD EN VIVO**: dos `activity-card`. Ticker "▸ ÚLTIMAS PUNTUACIONES" (7 filas) y "▸ TOP JUGADORES · HOY" (5 filas con barra de progreso); botón "VER SALÓN →" a `/salon`. Datos como arrays literales dentro del componente.
  - **// 04 PRECIOS**: `price-card` (plan gratis, lista de features, sello "FREE PLAY", CTA "EMPEZAR GRATIS →" a `/login`) y `pricing-faq` con 3 items.
  - **CTA final**: "¿LISTO PARA JUGAR?" + botón "INSERTAR MONEDA →" a `/juegos`.
  - **Scroll-reveal**: hook `useReveal` con `IntersectionObserver` que añade la clase `in` a los elementos `.reveal` al entrar en viewport (umbral 0.12), con `disconnect` en cleanup.
- **Reubicación de la biblioteca**: nueva ruta `app/juegos/page.tsx` (Server Component fino) que renderiza `<LibraryScreen />`. `app/page.tsx` pasa a renderizar `<HomeScreen />`.
- **Navegación** (`components/nav.tsx`): añadir enlace "Inicio" → `/` (activo cuando `pathname === "/"`); "Biblioteca" pasa a apuntar a `/juegos` y su estado activo cubre `/juegos` y `/juego/*`. Mismo cambio en el panel móvil. El logo sigue apuntando a `/` (ahora la landing).
- **Reenlace de "volver a la biblioteca"**: los destinos que hoy apuntan a `/` con sentido de "volver al grid" pasan a `/juegos`:
  - `components/game-detail.tsx` — "VOLVER AL VAULT".
  - `components/game-player.tsx` — "VOLVER AL VAULT" del modal de fin.
  - `components/hall-of-fame.tsx` — "VOLVER A LA BIBLIOTECA".
  - `components/auth-form.tsx` — `router.push` tras iniciar sesión y tras "jugar como invitado".
  - `app/not-found.tsx` — "VOLVER AL VAULT".
- **Tema** (`app/globals.css`): añadir los bloques CSS `/* ===== HOME PAGE ===== */`, `/* ===== ACTIVITY ... ===== */` y `/* ===== PRICING ===== */` de `references/templates/home-about/styles.css`, sin duplicar reglas ya presentes (`.fade-in` / `@keyframes fadeIn`, `.blink` / `@keyframes blink`, `@keyframes gridscroll`, `@keyframes bob` ya existen en `globals.css`).

**Out of scope (para futuras specs):**

- Página "Acerca de" y "Contacto" (`about.jsx`), su enlace en el nav y el bloque CSS ABOUT PAGE.
- Bloque CSS `.gp` (gamepad) y sus variantes de tema.
- Convertir el ticker / top de "Actividad en vivo" en datos reales (leer `av_scores`, `seededScores` o backend).
- Contador de créditos funcional (sigue fijo en `03`).
- Metadata SEO por página (`metadata` en `app/page.tsx` o `app/juegos/page.tsx`); se mantiene la global de SPEC 01.
- Redirección `/juegos` → `/` o `/` → `/juegos` para enlaces antiguos; los "volver" internos se reescriben, no se añaden `redirects`.
- Motor de juego, backend y autenticación real (heredado de SPEC 01).
- `prefers-reduced-motion` para las animaciones de la landing (float, bounce, pulse, reveal).

---

## Data model

Esta feature no introduce estructuras de datos nuevas. Reutiliza `GAMES` de `lib/data.ts` (SPEC 01) para el `mini-rail`.

Los datos de la sección "Actividad en vivo" son arrays literales tipados en línea dentro de `components/home-screen.tsx`, no exportados:

```ts
// dentro del componente, no en lib/data.ts
const RECENT = [
  { p: "NEONFOX", g: "Caída", s: 184220, t: "hace 2 min", c: "magenta" },
  // ... 7 filas, tal cual el prototipo
];
const TOP_TODAY = [
  { r: 1, p: "NEONFOX", s: 312840 },
  // ... 5 filas, tal cual el prototipo
];
```

Convenciones (heredadas de SPEC 01):

- `home-screen.tsx` lleva `"use client"` (usa `IntersectionObserver` y `useRouter`).
- `app/page.tsx` y `app/juegos/page.tsx` son Server Components finos.
- Alias `@/*` para imports.
- Números con `toLocaleString("es-ES")`.

---

## Implementation plan

1. **CSS de la landing.** Añadir a `app/globals.css` los bloques HOME PAGE, ACTIVITY y PRICING de `references/templates/home-about/styles.css`, omitiendo reglas y `@keyframes` ya definidos. Sin cambios de árbol aún; la app compila igual. Verificación: `npm run dev` sin errores de PostCSS.
2. **Ruta `/juegos`.** Crear `app/juegos/page.tsx` que renderiza `<LibraryScreen />` (mismo patrón que `app/page.tsx` actual). Verificación: `/juegos` muestra el grid completo; `/` sigue mostrando el grid (todavía sin Home).
3. **`HomeScreen` — esqueleto + hero.** Crear `components/home-screen.tsx` (`"use client"`) con el hook `useReveal`, `FloatingSilhouettes`, el `<section className="home-hero">` completo y `useRouter` para las CTAs (`/juegos`, `/login`). Cambiar `app/page.tsx` para renderizar `<HomeScreen />`. Verificación: `/` muestra el hero con siluetas flotantes y el scroll hint; los botones navegan.
4. **Secciones 01 y 02.** Añadir `FeatureIcon`, el grid de `feature-card` (// 01) y el `mini-rail` con `GAMES.slice(0, 6)` + `MiniCard` (// 02), con navegación a `/juego/<id>` y `/juegos`. Verificación: 4 tarjetas de feature con glow por color; 6 minis con portada CSS que enlazan al detalle.
5. **Stats + Actividad en vivo.** Añadir la banda `home-stats` y la sección // 03 con las dos `activity-card` y sus arrays `RECENT` / `TOP_TODAY` en línea; botón "VER SALÓN →" a `/salon`. Verificación: ticker de 7 filas y top de 5 con barras; el botón navega al salón.
6. **Precios + CTA final.** Añadir la sección // 04 (`price-card` + `pricing-faq`) y `home-final`, con CTAs a `/login` y `/juegos`. Verificación: tarjeta de precio con sello "FREE PLAY", 3 FAQ, y bloque final con botón "INSERTAR MONEDA →".
7. **Nav.** En `components/nav.tsx`: añadir enlace "Inicio" → `/` (activo si `pathname === "/"`) antes de "Biblioteca"; cambiar el `href` de "Biblioteca" a `/juegos` y su condición activa a `pathname === "/juegos" || pathname.startsWith("/juego")`. Replicar en el panel móvil. Verificación: en `/` está activo "Inicio"; en `/juegos` y `/juego/caida` está activo "Biblioteca"; el panel móvil refleja lo mismo bajo 840px.
8. **Reenlace de "volver".** Cambiar `/` por `/juegos` en: `components/game-detail.tsx` ("VOLVER AL VAULT"), `components/game-player.tsx` ("VOLVER AL VAULT" del modal), `components/hall-of-fame.tsx` ("VOLVER A LA BIBLIOTECA"), `components/auth-form.tsx` (los dos `router.push("/")`), `app/not-found.tsx` ("VOLVER AL VAULT"). Verificación: desde detalle/player/salón/login/404 el botón lleva al grid en `/juegos`, no a la landing.
9. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings nuevos. Revisar consola sin warnings de hidratación en `/` y `/juegos`.

---

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos.
- [ ] `/` renderiza la landing (hero con título en tres líneas, siluetas flotantes, secciones // 01–// 04 y CTA final), no el grid de juegos.
- [ ] `/juegos` renderiza la biblioteca completa (búsqueda, chips de categoría, grid de 8 tarjetas, estado "NO HAY RESULTADOS").
- [ ] En el hero, "▶ EXPLORAR JUEGOS" navega a `/juegos` y "✦ CREAR CUENTA" navega a `/login`.
- [ ] La sección // 02 muestra 6 minis (`GAMES.slice(0, 6)`) con portada CSS; pulsar una navega a `/juego/<id>`; "VER TODOS LOS JUEGOS →" navega a `/juegos`.
- [ ] La sección // 03 muestra el ticker de 7 filas y el top de 5 filas con barra de progreso; "VER SALÓN →" navega a `/salon`.
- [ ] La sección // 04 muestra la `price-card` con sello "FREE PLAY" y 3 FAQ; "EMPEZAR GRATIS →" navega a `/login`.
- [ ] El bloque final muestra "¿LISTO PARA JUGAR?" y "INSERTAR MONEDA →" navega a `/juegos`.
- [ ] Al hacer scroll, las secciones con clase `.reveal` pasan de opacidad 0 a visible una sola vez (no se re-ocultan al volver a subir).
- [ ] El nav muestra "Inicio" y "Biblioteca" como enlaces separados; "Inicio" está activo en `/`; "Biblioteca" está activo en `/juegos` y en `/juego/<id>`.
- [ ] Bajo 840px, el panel móvil lista "Inicio", "Biblioteca", "Salón de la Fama" e "Iniciar Sesión/Cuenta" con el mismo estado activo.
- [ ] El logo del nav navega a `/` (landing).
- [ ] "VOLVER AL VAULT" en detalle y en el modal de fin del player, "VOLVER A LA BIBLIOTECA" en el salón y "VOLVER AL VAULT" en la página 404 navegan a `/juegos`.
- [ ] Iniciar sesión en `/login` y "JUGAR COMO INVITADO" redirigen a `/juegos`.
- [ ] No hay warnings de hidratación de React en consola en `/` ni en `/juegos`.
- [ ] El enlace "Acerca de" del nav apunta a `/acerca-de` y esa ruta renderiza la página 404 (no existe `page.tsx`); no se ha creado la página real de about ni el bloque CSS ABOUT PAGE.
- [ ] El bloque CSS `.gp` no está en `globals.css`.

---

## Decisions

- **Sí:** landing en `/` y biblioteca en `/juegos`. La landing es la puerta de entrada del producto; el prototipo trata "Inicio" y "Biblioteca" como destinos distintos. Sustituye el routing de SPEC 01 en ese punto (SPEC 01 no se reescribe; este documento manda).
- **No:** landing en `/inicio` con la biblioteca en `/`. La landing debe estar en la raíz; una landing fuera de `/` es antipatrón.
- **Sí:** slug `/juegos` para la biblioteca. Elegido por el usuario frente a `/biblioteca`.
- **Sí:** reescribir los "volver" internos (`/` → `/juegos`) en detalle, player, salón, auth y 404. Es el mínimo para no romper la navegación tras mover la ruta.
- **No:** añadir `redirects` de `/juegos`↔`/`. No hay enlaces externos que proteger en un MVP; los internos se reescriben.
- **Sí:** solo el enlace "Inicio" en el nav. La página "Acerca de" no existe todavía; añadir su enlace dejaría un destino muerto.
- **Desviación (a petición del usuario, tras aprobar la spec):** se añade también el enlace "Acerca de" → `/acerca-de` en barra y panel móvil. La ruta no tiene `page.tsx`, así que Next renderiza `app/not-found.tsx` (404). La página real de "Acerca de" sigue fuera de scope y va en otra spec.
- **No:** portar `about.jsx` en esta spec. Es una pantalla independiente (hero + formulario de contacto simulado + animación de terminal); merece su propia spec.
- **Sí:** arrays de "Actividad en vivo" en línea dentro de `home-screen.tsx`. Son relleno presentacional, no datos reales; moverlos a `lib/data.ts` sugeriría que alimentan algo.
- **No:** derivar el ticker/top de `seededScores` o `GAMES`. Cambiaría el contenido respecto al prototipo sin beneficio.
- **Sí:** portar solo los bloques CSS HOME PAGE, ACTIVITY y PRICING. Es lo único que `home.jsx` usa; `.gp` y ABOUT PAGE serían CSS muerto.
- **Sí:** `HomeScreen` es Client Component. Usa `IntersectionObserver` y navegación imperativa, igual que las cinco pantallas de SPEC 01.
- **No:** `metadata` por página. SEO quedó fuera en SPEC 01; se mantiene la `metadata` global.

---

## Riesgos

| Riesgo                                                                                                                           | Mitigación                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mover `/` de biblioteca a landing rompe criterios y URLs de SPEC 01                                                              | Este spec reescribe los "volver" internos y actualiza el nav; se documenta que `/juegos` es la nueva ubicación del grid. Enlaces externos previos no existen en un MVP. |
| `.reveal` arranca en `opacity: 0`; si el `IntersectionObserver` no corre (JS deshabilitado, error), el contenido queda invisible | Aceptable para el MVP: mismo comportamiento que el prototipo. `home-hero` no lleva `.reveal`, así que la primera pantalla siempre se ve.                                |
| Duplicar reglas al pegar el CSS del prototipo (`.fade-in`, `@keyframes blink/fadeIn/gridscroll/bob` ya están)                    | El paso 1 exige revisar y omitir reglas y `@keyframes` ya presentes en `globals.css`.                                                                                   |
| `next/font` con `Press Start 2P` y textos largos del hero/faq                                                                    | Todo el texto es ASCII en mayúsculas o acentos latinos cubiertos por el subset `latin`; cadena de fallback `system-ui, monospace` en `--pixel`.                         |
| Warnings de hidratación si algún nodo depende de `window` en el primer render de `HomeScreen`                                    | El hook `useReveal` solo toca el DOM dentro de `useEffect`; los arrays son estáticos. Verificación explícita en el criterio de aceptación.                              |

---

## Qué **no** entra en esta spec

- Página "Acerca de" / "Contacto" (`about.jsx`) y su enlace en el nav.
- Bloque CSS `.gp` (gamepad) y bloque ABOUT PAGE.
- Datos reales en "Actividad en vivo".
- Contador de créditos funcional.
- Metadata SEO por página.
- Redirecciones entre `/` y `/juegos`.
- `prefers-reduced-motion` para las animaciones de la landing.

Cada uno, si llega, va en su propia spec.
