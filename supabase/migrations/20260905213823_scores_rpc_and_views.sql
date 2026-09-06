-- scores: una fila por usuario+juego = su mejor marca
create table public.scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game_id    text not null references public.games(id) on delete cascade,
  score      int  not null check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.scores enable row level security;

-- select público; sin insert/update/delete directos (la escritura pasa por submit_score)
create policy "scores_select_public"
  on public.scores
  for select
  to anon, authenticated
  using (true);

-- index del FK game_id (user_id ya encabeza la PK)
create index scores_game_id_idx on public.scores (game_id);

-- escritura de score: upsert que solo sube si el nuevo score es mayor
create function public.submit_score(p_game_id text, p_score int)
returns void
language sql
security definer
set search_path = ''
as $$
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
  from public.scores s
  join public.profiles p on p.id = s.user_id;

create view public.game_stats with (security_invoker = on) as
  select g.id as game_id,
         coalesce(max(s.score), 0) as best,
         count(s.*)                as plays
  from public.games g
  left join public.scores s on s.game_id = g.id
  group by g.id;

create view public.games_with_stats with (security_invoker = on) as
  select g.*, gs.best, gs.plays
  from public.games g
  join public.game_stats gs on gs.game_id = g.id;
