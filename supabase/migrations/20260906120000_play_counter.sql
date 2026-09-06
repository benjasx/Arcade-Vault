-- contador estricto de partidas jugadas por juego: aumenta al perder una
-- partida, con o sin sesión iniciada. Sustituye al count(scores) de game_stats,
-- que en realidad medía "jugadores con marca", no partidas.
create table public.game_plays (
  game_id text primary key references public.games(id) on delete cascade,
  plays   bigint not null default 0 check (plays >= 0)
);

alter table public.game_plays enable row level security;

-- lectura pública; la escritura pasa solo por increment_play
create policy "game_plays_select_public"
  on public.game_plays
  for select
  to anon, authenticated
  using (true);

-- una fila por juego existente
insert into public.game_plays (game_id)
  select id from public.games
  on conflict do nothing;

-- incremento de partidas: se llama al perder una partida (invitados incluidos)
create function public.increment_play(p_game_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.game_plays (game_id, plays)
  values (p_game_id, 1)
  on conflict (game_id)
  do update set plays = public.game_plays.plays + 1;
$$;

grant execute on function public.increment_play(text) to anon, authenticated;

-- games_with_stats: plays pasa a salir del contador real
drop view public.games_with_stats;

create view public.games_with_stats with (security_invoker = on) as
  select g.*, gs.best, coalesce(gp.plays, 0) as plays
  from public.games g
  join public.game_stats gs on gs.game_id = g.id
  left join public.game_plays gp on gp.game_id = g.id;
