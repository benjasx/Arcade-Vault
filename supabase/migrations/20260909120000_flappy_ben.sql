-- flappy-ben (FLAPPY-BEN): quinto juego con motor real. Se añade como entrada
-- nueva; ningún id sembrado encajaba temáticamente.
insert into public.games (id, title, short, long, cat, cover, color, sort) values
  ('flappy-ben', 'FLAPPY-BEN',
   'Aletea sin chocar contra las tuberías de neón.',
   'Un pájaro pixelado atraviesa un desfiladero infinito de tuberías luminosas. Un toque lo impulsa hacia arriba, la gravedad lo arrastra hacia abajo. Cada tubería superada suma un punto — y la siguiente siempre está más cerca.',
   'ARCADE', 'cover-flappy-ben', 'magenta', 11);

-- una fila en el contador de partidas para el juego nuevo
insert into public.game_plays (game_id) values ('flappy-ben')
  on conflict do nothing;
