# SPEC 06 — Leaderboard real y tabla de juegos en Supabase (con auth real)

> **Status:** aprobado
> **Depends on:** SPEC 01, SPEC 04
> **Date:** 2026-09-05
> **Objective:** Sustituir la auth simulada por Supabase Auth (email/contraseña + OAuth Google/GitHub) y mover el catálogo y las puntuaciones a las tablas `games` y `scores` de Supabase, de modo que los leaderboards de `/juego/[id]` y `/salon` muestren la mejor marca real por usuario.

---

## Por qué existe esta spec

Hoy todo el estado real vive en `localStorage`: la "sesión" es un `name` en `av_user` (`components/auth-provider.tsx`), las puntuaciones son un array `av_scores` (`lib/scores.ts`) y los rankings que se pintan son mock deterministas (`seededScores` / `PLAYERS` en `lib/data.ts`). El catálogo de 8 juegos es una constante TS (`GAMES` en `lib/data.ts`). SPEC 04 dejó el cliente `@supabase/ssr` listo (`lib/supabase/client.ts`, `lib/supabase/server.ts`) pero el esquema `public` sigue con 0 tablas y difirió explícitamente la auth real a "una spec posterior que reemplace `auth-provider.tsx`".

Esta spec cierra esas tres piezas a la vez: auth real, esquema de datos y leaderboards con datos reales. Para atribuir una puntuación a una persona hace falta un `user_id` estable, y eso exige auth real; por eso van juntas.

Decisiones ya cerradas con el usuario (no reabrir):

- **No se divide** pese al tamaño: auth real + tabla `games` + tabla `scores` + RLS + reescritura de `/juegos`, `/juego/[id]` y `/salon` van en esta única spec. Definición rápida, asumida por el usuario.
- El catálogo pasa a una tabla `games` en Supabase que es la **fuente de verdad**; `GAMES` desaparece de `lib/data.ts`.
- El leaderboard sale de una tabla `scores` en Supabase, **real y cross-device**.
- Auth real de Supabase con `scores.user_id` → FK a `auth.users`. **Esta spec implementa esa auth** (reemplaza el `auth-provider.tsx` simulado).
- Método: **email/contraseña + OAuth Google y GitHub**.
- El nombre de arcade (≤ 10 chars, mayúsculas) vive en una tabla **`profiles`** poblada por trigger `on auth.users insert`.
- **Una fila por usuario+juego**: la escritura es un upsert que solo sube el score si el nuevo es mayor.
- `best` y `plays` de cada juego se **derivan de `scores`** (MAX y COUNT) por vista, no se almacenan.
- Las pantallas leen por **Server Components** con `lib/supabase/server.ts` y pasan los datos por props; los componentes cliente dejan de fetchear.
- Sin sesión, el modal de fin de juego **invita a iniciar sesión y no guarda**; se borran `av_scores`, `av_user` y `lib/scores.ts`.

---

## Scope

**In:**

- **Migración `games`** (`supabase/migrations/`, aplicada también por MCP `apply_migration` al proyecto `mrimkuambtxtoycyfxyh`):
  - Tabla `public.games` con las columnas del catálogo actual menos `best`/`plays` (ver Data model), sembrada con los 8 juegos de `lib/data.ts` (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`), con `id` = el string actual.
  - RLS activada: `select` público (anon + authenticated); sin `insert`/`update`/`delete` para esos roles.
- **Migración `profiles`**:
  - Tabla `public.profiles` (`id` uuid PK → `auth.users(id) on delete cascade`, `name` text con `check` 1–10 chars).
  - Función `public.handle_new_user()` (`security definer`, `search_path` fijado) y trigger `after insert on auth.users` que inserta el `profile` tomando el nombre de `raw_user_meta_data` (`name` → `user_name` → `full_name` → `'PLAYER'`), en mayúsculas y truncado a 10.
  - RLS: `select` público (los rankings muestran `name`); `update` solo `auth.uid() = id`.
- **Migración `scores`**:
  - Tabla `public.scores` (`user_id` uuid → `auth.users(id)`, `game_id` text → `games(id)`, `score` int `check (score >= 0)`, `updated_at` timestamptz, PK `(user_id, game_id)`).
  - Función `public.submit_score(p_game_id text, p_score int)` (`security definer`, `search_path` fijado): `insert ... on conflict (user_id, game_id) do update set score = excluded.score, updated_at = now() where excluded.score > scores.score`, usando `auth.uid()` como `user_id`.
  - Vistas (`security_invoker = on`): `public.leaderboard` (join `scores`+`profiles`, con `rank() over (partition by game_id order by score desc)`), `public.game_stats` (`game_id`, `best` = `coalesce(max(score),0)`, `plays` = `count(*)`), `public.games_with_stats` (`games` LEFT JOIN `game_stats`).
  - RLS en `scores`: `select` público; sin `insert`/`update` directos (la escritura pasa por `submit_score`).
- **Tipos**: `lib/supabase/database.types.ts` generado con MCP `generate_typescript_types`.
- **`lib/data.ts`**: se reduce a `CATS` y los tipos `GameCategory` / `NeonColor`. Se eliminan `GAMES`, `PLAYERS`, `seededScores`, `ScoreRow`, `Game` (este último se re-deriva de los tipos generados donde haga falta).
- **`lib/scores.ts`**: se elimina (junto con `SavedScore`, `getScores`, `saveScore`).
- **`lib/leaderboard.ts`** (nuevo): `submitScore(gameId: string, score: number)` → `createClient().rpc("submit_score", { p_game_id, p_score })`; tipo `LeaderRow` para las filas de `leaderboard`.
- **Refresco de sesión**: fichero de proxy en la raíz (nombre y firma según `node_modules/next/dist/docs/` para Next 16 — la guía de middleware/`proxy.ts`) que refresca la sesión Supabase en cada request, patrón oficial `@supabase/ssr`.
- **`components/auth-provider.tsx`**: reescrito sobre la sesión Supabase. `useAuth()` sigue devolviendo `{ user, ready, signOut }`, con `user` = `{ id, name } | null` (`name` leído de `profiles`). Se elimina `signIn` del contexto.
- **`components/auth-form.tsx`**: login real (`signInWithPassword`), registro real (`signUp` con `options.data.name` desde un campo nuevo "Nombre de arcade", ≤ 10, mayúsculas), OAuth (`signInWithOAuth` para `google` y `github` con `redirectTo` a `/auth/callback`), "JUGAR COMO INVITADO" pasa a ser un `<Link href="/juegos">`. Mostrar el error de Supabase si lo hay.
- **`app/auth/callback/route.ts`** (nuevo): Route Handler que hace `exchangeCodeForSession` y redirige a `/juegos` (firma según docs de Next 16).
- **`components/nav.tsx`**: `signOut` pasa a ser async (Supabase). Sin más cambios de marcado.
- **`app/juegos/page.tsx`** y **`app/page.tsx`**: Server Components que leen `games_with_stats` (todos / primeros 6) y pasan `games` por props.
- **`components/library-screen.tsx`** y **`components/home-screen.tsx`**: reciben `games` por props; mantienen su estado local (búsqueda, filtro, animaciones). Dejan de importar `GAMES`.
- **`app/juego/[id]/page.tsx`**: Server Component que lee `games_with_stats` por `id` y `leaderboard` (`where game_id = id order by rank limit 10`); `notFound()` si el juego no existe. Pasa `game` + `scores` a `GameDetail`.
- **`components/game-detail.tsx`**: `scores` pasa a ser `LeaderRow[]` (`rank`, `name`, `score`, `updated_at`); la fecha se formatea desde `updated_at`.
- **`app/juego/[id]/jugar/page.tsx`**: lee el juego de `games` (no de `GAMES`); conserva el split `id === "rocas"` → `<AsteroidsPlayer>`.
- **`app/salon/page.tsx`**: Server Component que lee todos los juegos + `leaderboard` completo y, si hay sesión, el rango del usuario por juego. Pasa todo por props.
- **`components/hall-of-fame.tsx`**: prop-driven. Podio y tabla desde `leaderboard` real; "TU MEJOR MARCA" desde el rango real del usuario; sin `seededScores` ni `youRank` inventado.
- **`components/game-player.tsx`** y **`components/asteroids-player.tsx`**: el modal de fin de juego usa `submitScore(game.id, score)` cuando hay sesión (toast `▸ PUNTUACIÓN GUARDADA_`); sin sesión muestra un CTA "INICIA SESIÓN PARA GUARDAR" → `/login`. Se quita el input de iniciales y el estado `name`.
- **`supabase/config.toml`**: habilitar `[auth.external.google]` y `[auth.external.github]` con secretos vía `env(...)` y `enable_confirmations = false` (paridad con el stack local; la config real del proyecto remoto se hace en el dashboard).

**Out of scope (para futuras specs):**

- UI de edición del perfil (cambiar el "Nombre de arcade" después del registro).
- Confirmación de email, recuperación de contraseña, magic links, MFA.
- Más proveedores OAuth (Apple, Discord…).
- Historial de partidas (se guarda solo la mejor marca por usuario+juego; no hay tabla de plays individuales).
- Migrar `CATS` a Supabase o hacer el filtro de categorías server-side.
- Realtime en los leaderboards (se leen en cada request, sin suscripción).
- Row Level Security por tenant, rate limiting de `submit_score` o antitrampas.
- Paginación de rankings más allá de los top N que ya se muestran.
- `plays` con formato "12.4K"; pasa a ser un entero.
- Tests automatizados (no hay framework configurado).
- Borrar cuenta / GDPR / export de datos.

---

## Data model

Persistencia nueva: 3 tablas en el esquema `public` de Supabase (`mrimkuambtxtoycyfxyh`). Se acaba `localStorage` para puntuaciones y sesión.

```sql
-- games: catálogo, fuente de verdad
create table public.games (
  id    text primary key,          -- "rocas"
  title text not null,             -- "ROCAS"
  short text not null,
  long  text not null,
  cat   text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover text not null,             -- clase CSS: "cover-rocas"
  color text not null check (color in ('cyan','magenta','yellow','green')),
  sort  int  not null default 0    -- orden de vitrina
);

-- profiles: nombre de arcade por usuario
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 10),
  created_at timestamptz not null default now()
);

-- scores: una fila por usuario+juego = su mejor marca
create table public.scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game_id    text not null references public.games(id) on delete cascade,
  score      int  not null check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
```

```sql
-- escritura de score: upsert que solo sube si mejora
create function public.submit_score(p_game_id text, p_score int)
returns void language sql security definer set search_path = '' as $$
  insert into public.scores (user_id, game_id, score)
  values (auth.uid(), p_game_id, p_score)
  on conflict (user_id, game_id)
  do update set score = excluded.score, updated_at = now()
  where excluded.score > public.scores.score;
$$;

-- vistas de lectura (security_invoker: respetan la RLS de las tablas base)
create view public.leaderboard with (security_invoker = on) as
  select s.game_id, s.user_id, p.name, s.score, s.updated_at,
         rank() over (partition by s.game_id order by s.score desc) as rank
  from public.scores s join public.profiles p on p.id = s.user_id;

create view public.game_stats with (security_invoker = on) as
  select g.id as game_id,
         coalesce(max(s.score), 0) as best,
         count(s.*)                as plays
  from public.games g left join public.scores s on s.game_id = g.id
  group by g.id;

create view public.games_with_stats with (security_invoker = on) as
  select g.*, gs.best, gs.plays
  from public.games g join public.game_stats gs on gs.game_id = g.id;
```

RLS (resumen):

| Objeto     | select  | insert / update / delete                                 |
| ---------- | ------- | -------------------------------------------------------- |
| `games`    | público | ninguno para anon/authenticated                          |
| `profiles` | público | `update` solo si `auth.uid() = id`; `insert` vía trigger |
| `scores`   | público | ninguno directo; escritura solo por `submit_score`       |

Formas nuevas en el frontend:

```ts
// lib/leaderboard.ts
type LeaderRow = { rank: number; name: string; score: number; updated_at: string };
function submitScore(gameId: string, score: number): Promise<void>;

// components/auth-provider.tsx
interface AuthUser {
  id: string;
  name: string;
}
interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  signOut: () => Promise<void>;
}
```

Convenciones (heredadas de SPEC 01/04):

- Alias `@/*` para imports (`@/lib/supabase/server`, `@/lib/leaderboard`, `@/lib/supabase/database.types`).
- Las páginas Server Component resuelven `params` con `await` y usan `await createClient()` de `lib/supabase/server.ts`; usan `getUser()` (no `getSession()`) cuando necesitan el usuario en servidor.
- Los componentes con `"use client"` que escriben (`auth-form`, modales) usan `lib/supabase/client.ts`.
- `lib/data.ts` queda solo con `CATS` y los tipos `GameCategory` / `NeonColor`.

---

## Implementation plan

1. **Migración `games`.** Crear `supabase/migrations/NN_games.sql` con la tabla, el `check` de `cat`/`color`, el seed de los 8 juegos (mismos `id`, `title`, `short`, `long`, `cat`, `cover`, `color` que `lib/data.ts` hoy) y la RLS de lectura pública. Aplicar con MCP `apply_migration`. Verificación: `list_tables` muestra `public.games` con 8 filas; un `select` anónimo devuelve las 8; un `insert` anónimo se rechaza por RLS.
2. **Migración `profiles` + trigger.** `NN_profiles.sql`: tabla, `handle_new_user()` (`security definer`, `set search_path = ''`), trigger `after insert on auth.users`, RLS (`select` público, `update` propio). Aplicar por MCP. Verificación: crear un usuario de prueba (dashboard o `execute_sql` sobre `auth`) genera una fila en `profiles` con `name` en mayúsculas y ≤ 10 chars; borrarlo lo elimina en cascada.
3. **Migración `scores` + RPC + vistas.** `NN_scores.sql`: tabla `scores`, `submit_score()`, vistas `leaderboard` / `game_stats` / `games_with_stats` (todas `security_invoker = on`), RLS de `scores`. Aplicar por MCP. Verificación: `select` anónimo sobre `games_with_stats` devuelve 8 filas con `best = 0`, `plays = 0`; `insert` directo en `scores` se rechaza; `rpc('submit_score', …)` sin sesión no crea filas.
4. **Capa de datos en el repo.** Generar `lib/supabase/database.types.ts` (MCP `generate_typescript_types`). Crear `lib/leaderboard.ts` (`submitScore`, `LeaderRow`). Añadir el fichero de proxy de refresco de sesión en la raíz (consultar `node_modules/next/dist/docs/` para el nombre y la firma en Next 16 antes de escribirlo). No tocar `lib/data.ts` todavía. Verificación: `npm run build` y `npm run lint` limpios; navegar por la app (aún con datos mock) sigue funcionando con el proxy activo.
5. **Auth real.** Reescribir `components/auth-provider.tsx` (sesión Supabase + `onAuthStateChange`, `user = {id, name}` con `name` de `profiles`, `signOut` async, sin `signIn`). Reescribir `components/auth-form.tsx` (`signInWithPassword`, `signUp` con campo "Nombre de arcade" → `options.data.name`, `signInWithOAuth` google/github, invitado = `<Link>`, mostrar errores). Crear `app/auth/callback/route.ts` (`exchangeCodeForSession` → redirect `/juegos`). Ajustar `components/nav.tsx` (`await signOut()`). Verificación: registro email crea sesión y fila en `profiles`; login y logout funcionan; el nombre sale en la nav; OAuth redirige de vuelta con sesión (tras configurar el dashboard, paso 10).
6. **Catálogo en Home y Biblioteca.** `app/juegos/page.tsx` y `app/page.tsx` pasan a Server Components que leen `games_with_stats` (todos / `.limit(6)`) y pasan `games` por props. `components/library-screen.tsx` y `components/home-screen.tsx` reciben `games`, quitan `import { GAMES }`, mantienen su estado local. Verificación: el grid y el preview se pintan desde Supabase; búsqueda y filtro por categoría siguen operando en cliente.
7. **Ficha y leaderboard de detalle.** `app/juego/[id]/page.tsx` lee `games_with_stats` por `id` y `leaderboard` (top 10 del juego); `notFound()` si no hay juego; pasa `game` + `scores: LeaderRow[]` a `GameDetail`. `components/game-detail.tsx` consume `LeaderRow` (fecha desde `updated_at`). `app/juego/[id]/jugar/page.tsx` lee el juego de `games` y conserva el split `rocas`. Verificación: `/juego/rocas` muestra la ficha real y un leaderboard (vacío si nadie ha jugado); `/juego/rocas/jugar` sigue cargando `AsteroidsPlayer`; un `id` inexistente da 404.
8. **Salón de la Fama.** `app/salon/page.tsx` Server Component: lee juegos + `leaderboard` completo y, con sesión, el rango del usuario por juego; pasa todo por props. `components/hall-of-fame.tsx` prop-driven: podio y tabla reales, "TU MEJOR MARCA" desde el rango real, sin `seededScores` ni `youRank` inventado. Verificación: con datos en `scores`, el podio refleja el top 3; sin datos, estado vacío legible; con sesión y marca propia aparece la fila destacada con el rango correcto.
9. **Guardado real + borrado del mock.** En `components/game-player.tsx` y `components/asteroids-player.tsx`: importar `submitScore` de `@/lib/leaderboard`, quitar `import { saveScore }` y el estado `name`; con sesión, "GUARDAR PUNTUACIÓN" → `await submitScore(game.id, score)` + toast; sin sesión, CTA a `/login`. Borrar `lib/scores.ts`. Podar `lib/data.ts` a `CATS` + tipos (eliminar `GAMES`, `PLAYERS`, `seededScores`, `ScoreRow`, `Game`). Verificación: `grep` no encuentra `@/lib/scores` ni `GAMES`/`seededScores` en `app/` ni `components/`; con sesión, guardar dos veces el mismo juego solo actualiza la fila si el score sube; `npm run build` y `npm run lint` limpios.
10. **Config y pasos manuales.** Editar `supabase/config.toml` (`[auth.external.google]`, `[auth.external.github]`, `enable_confirmations = false`). Documentar en la spec / PR los pasos manuales del usuario en el dashboard de `mrimkuambtxtoycyfxyh`: crear las apps OAuth de Google y GitHub, pegar client id/secret, y añadir `…/auth/callback` (local y prod) a la allowlist de Redirect URLs. Confirmar que el bloque regenerado de `AGENTS.md` va en el commit. Verificación: login con Google y con GitHub completan el ciclo y dejan sesión activa; `npm run build` y `npm run lint` sin errores ni warnings nuevos.

---

## Acceptance criteria

- [ ] `public.games` existe con 8 filas cuyos `id` coinciden con los del antiguo `GAMES`; `select` anónimo funciona; `insert` anónimo se rechaza por RLS.
- [ ] Al registrarse un usuario se crea automáticamente una fila en `public.profiles` con `name` en mayúsculas y de 1 a 10 caracteres.
- [ ] `public.scores` tiene PK `(user_id, game_id)`; no admite `insert` ni `update` directos desde el cliente.
- [ ] `submit_score(game_id, score)` con sesión crea la fila la primera vez y en llamadas posteriores solo actualiza `score`/`updated_at` si el nuevo score es mayor.
- [ ] `games_with_stats` devuelve `best` = MAX(score) y `plays` = COUNT(*) por juego; sin puntuaciones, `best = 0` y `plays = 0`.
- [ ] Registro e inicio de sesión con email/contraseña funcionan sin paso de confirmación de correo.
- [ ] Los botones de Google y GitHub completan el OAuth y devuelven a `/juegos` con sesión activa.
- [ ] Tras iniciar sesión, la nav muestra el `name` del perfil; `signOut` cierra la sesión de Supabase y vuelve al estado de invitado.
- [ ] `/juegos` y la preview de la home pintan los juegos leídos de Supabase; la búsqueda y el filtro por categoría siguen funcionando en cliente.
- [ ] `/juego/[id]` muestra `best`/`plays` reales y un leaderboard con las top 10 marcas reales del juego (vacío si nadie ha jugado); un `id` inexistente responde 404.
- [ ] `/juego/rocas/jugar` sigue montando `AsteroidsPlayer`; el resto de juegos sigue con `GamePlayer`.
- [ ] `/salon` muestra podio y tabla desde `leaderboard` real; con sesión y marca propia aparece la fila "TU MEJOR MARCA" con el rango correcto.
- [ ] En el modal de fin de juego con sesión, "GUARDAR PUNTUACIÓN" llama a `submit_score` y muestra el toast `▸ PUNTUACIÓN GUARDADA_`.
- [ ] En el modal de fin de juego sin sesión no hay input de puntuación; aparece un CTA que lleva a `/login`.
- [ ] `lib/scores.ts` ya no existe; `lib/data.ts` no exporta `GAMES`, `PLAYERS`, `seededScores` ni `ScoreRow`; ningún archivo en `app/` o `components/` los importa.
- [ ] Existe un fichero de proxy en la raíz que refresca la sesión Supabase en cada request (nombre según Next 16).
- [ ] Las migraciones están versionadas en `supabase/migrations/` y aplicadas en el proyecto remoto (`list_migrations` las lista).
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings nuevos; sin warnings de hidratación de React en consola.

---

## Decisions

- **Sí:** meter auth real + `games` + `scores` en una sola spec pese a tocar 4 dominios. Definición rápida asumida por el usuario tras plantearle el split; se acepta el riesgo de una spec grande.
- **No:** dividir en "SPEC 06 auth" + "SPEC 07 leaderboards". Era la recomendación; el usuario prefiere un único documento.
- **Sí:** `games` como fuente de verdad en Supabase y borrar `GAMES` de `lib/data.ts`. Evita mantener el catálogo en dos sitios. Elegido por el usuario.
- **Sí:** `best`/`plays` derivados por vista (`game_stats`), no columnas en `games`. Reflejan las puntuaciones reales sin job de sincronización. Elegido por el usuario. `plays` deja de tener formato "12.4K" y pasa a entero.
- **Sí:** email/contraseña **y** OAuth Google/GitHub. Elegido por el usuario. Apple y otros proveedores quedan fuera.
- **Sí:** `enable_confirmations = false` (sin verificación de email). La sesión arranca al registrarse; no hay que montar plantillas de correo ni ruta de confirmación. Recuperación de contraseña y magic links quedan fuera.
- **Sí:** tabla `profiles` con trigger `on auth.users insert` para el nombre de arcade. Elegido por el usuario. El trigger cae a `user_name`/`full_name` de la metadata OAuth y, en último caso, `'PLAYER'`.
- **No:** guardar el nombre solo en `user_metadata` sin tabla. Una tabla `profiles` da FK limpia desde `scores` y RLS de lectura del `name` sin exponer `auth.users`.
- **No:** UI para editar el nombre de arcade tras el registro. Fuera de scope; el nombre se fija al crear la cuenta.
- **Sí:** `name` de `profiles` **no** único. Evita fricción en el registro; nombres repetidos en rankings son aceptables para el MVP.
- **Sí:** una fila por `(user_id, game_id)` con upsert "solo si mejora" vía RPC `submit_score` (`security definer`). Elegido por el usuario. Mantiene la RLS de `scores` trivial (sin `insert`/`update` público) y la lógica de "mejor marca" en el servidor.
- **No:** tabla de partidas individuales / historial. Solo interesa la mejor marca; añadirlo es otra spec.
- **Sí:** lectura por Server Components (`lib/supabase/server.ts`) pasando datos por props. Elegido por el usuario. Menos estados de carga en cliente y SSR con datos reales.
- **Sí:** vistas con `security_invoker = on`. Sin esto, una vista en Postgres corre con permisos del creador y saltaría la RLS de las tablas base.
- **Sí:** borrar `lib/scores.ts` y el flujo `av_scores`/`av_user`. Elegido por el usuario. Sin sesión no se guarda; el modal enlaza a `/login`.
- **Sí:** navegar y jugar sin sesión sigue permitido (RLS de lectura pública en `games`, `profiles.name`, `scores`). Solo guardar exige cuenta.
- **Sí:** migraciones versionadas en `supabase/migrations/` y aplicadas por MCP `apply_migration`. Coherente con SPEC 04.
- **No:** configurar los secretos OAuth desde el repo. Client id/secret y Redirect URLs se ponen en el dashboard de Supabase (paso manual del usuario, como `RESEND_API_KEY` en SPEC 03 o `supabase link` en SPEC 04).
- **No:** Realtime en los leaderboards. Se releen en cada request; suscripciones van en otra spec.

---

## Riesgos

| Riesgo                                                                                                                                  | Mitigación                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los criterios de OAuth dependen de un paso manual en el dashboard (apps Google/GitHub + Redirect URLs) que el asistente no puede hacer. | El paso 10 lo documenta explícitamente; hasta que el usuario lo complete, esos dos criterios quedan pendientes sin bloquear el resto.                                            |
| Un fallo en `handle_new_user()` (p. ej. `name` > 10 o nulo) aborta el `signUp` entero con un 500 opaco.                                 | El trigger normaliza (`upper`, `left(...,10)`, `coalesce(... ,'PLAYER')`); el paso 2 no cierra hasta ver la fila creada; probar registro con nombre límite y sin nombre (OAuth). |
| Vista sin `security_invoker` expondría `scores`/`profiles` saltándose la RLS.                                                           | Las tres vistas se crean con `with (security_invoker = on)`; un criterio verifica que el `select` anónimo solo ve lo esperado.                                                   |
| `security definer` sin `search_path` fijado es vector de escalada.                                                                      | `submit_score` y `handle_new_user` llevan `set search_path = ''` y referencian todo con esquema (`public.`, `auth.`).                                                            |
| Borrar `GAMES`/`seededScores` antes de migrar sus consumidores rompe el build a mitad de spec.                                          | El plan crea la capa de datos nueva en el paso 4 y no poda `lib/data.ts` hasta el paso 9, cuando ya nadie la importa.                                                            |
| Next 16 renombró middleware a `proxy.ts` con otra firma; escribirlo de memoria falla.                                                   | El paso 4 obliga a consultar `node_modules/next/dist/docs/` antes de crear el fichero.                                                                                           |
| `getSession()` en servidor no es de fiar para autorización.                                                                             | Las páginas usan `getUser()` para el usuario en servidor; `getSession()` solo en cliente vía el provider.                                                                        |
| El modal de fin de juego podía guardar dos veces (doble click) o al hacer restart.                                                      | `submitScore` es idempotente por diseño (upsert "solo si mejora"); tras guardar se muestra el toast y se oculta el botón.                                                        |
| Warnings de hidratación si el provider deriva UI de la sesión en el primer render.                                                      | El provider expone `ready` (false hasta resolver la sesión en cliente); la nav y los modales no pintan UI de usuario hasta `ready`.                                              |
| El bloque de agentes de `AGENTS.md` aparece como cambio sin commitear.                                                                  | Se commitea junto al trabajo (documentado en `CLAUDE.md` / `AGENTS.md`).                                                                                                         |

---

## Qué **no** entra en esta spec

- UI para editar el "Nombre de arcade" después del registro.
- Confirmación de email, recuperación de contraseña, magic links, MFA.
- Proveedores OAuth más allá de Google y GitHub.
- Historial de partidas / tabla de plays individuales (solo se guarda la mejor marca).
- Migrar `CATS` a Supabase o filtrar categorías en servidor.
- Realtime / suscripciones en los leaderboards.
- Rate limiting o antitrampas sobre `submit_score`.
- Paginación de rankings más allá de los top N mostrados.
- Borrado de cuenta, export de datos, GDPR.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
