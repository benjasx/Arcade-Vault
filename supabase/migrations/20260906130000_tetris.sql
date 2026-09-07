-- tetris (TETRABYTE): segunda entrada de catálogo con motor real. Se añade como
-- juego nuevo, sin tocar `caida`, que se queda con el GamePlayer simulado.
insert into public.games (id, title, short, long, cat, cover, color, sort) values
  ('tetris', 'TETRABYTE',
   'Apila bytes, funde líneas y desata power-ups.',
   'Bloques de datos corruptos caen en cascada por el pozo de memoria. Rótalos, encástralos y funde líneas completas para purgar el sistema. Piezas imposibles, giros en el hueco y power-ups que detonan el tablero: la frecuencia sube cada 10 líneas y no perdona.',
   'PUZZLE', 'cover-tetris', 'cyan', 9);

-- una fila en el contador de partidas para el juego nuevo
insert into public.game_plays (game_id) values ('tetris')
  on conflict do nothing;
