-- snake (NEONSNAKE): cuarto juego con motor real. Se añade como entrada nueva,
-- sin tocar `serpentina`, que se queda con el GamePlayer simulado.
insert into public.games (id, title, short, long, cat, cover, color, sort) values
  ('snake', 'NEONSNAKE',
   'Devora núcleos y no muerdas tu propia cola.',
   'Una serpiente de luz cyan recorre la rejilla cazando núcleos magenta. Cada bocado la alarga y acelera el paso. Chocar contra el muro o contra tu propio cuerpo apaga el circuito al instante.',
   'ARCADE', 'cover-neonsnake', 'cyan', 10);

-- una fila en el contador de partidas para el juego nuevo
insert into public.game_plays (game_id) values ('snake')
  on conflict do nothing;
