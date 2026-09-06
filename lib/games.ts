import type { Database } from "@/lib/supabase/database.types";
import type { GameCategory, NeonColor } from "@/lib/data";

type GamesWithStatsRow = Database["public"]["Views"]["games_with_stats"]["Row"];

// Fila de games_with_stats ya saneada: la vista tipa todas sus columnas como
// nullable, pero games siempre aporta las suyas y game_stats devuelve 0 por
// coalesce, así que en la práctica nada es null.
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: NeonColor;
  sort: number;
  best: number;
  plays: number;
};

// IDs de juegos con motor real integrado en la app. El resto del catálogo sigue
// en la BD pero no se muestra en la biblioteca hasta tener su motor.
export const PLAYABLE_GAME_IDS = new Set<string>(["rocas"]);

export function isPlayable(id: string): boolean {
  return PLAYABLE_GAME_IDS.has(id);
}

export function toGame(row: GamesWithStatsRow): Game {
  return {
    id: row.id ?? "",
    title: row.title ?? "",
    short: row.short ?? "",
    long: row.long ?? "",
    cat: (row.cat ?? "ARCADE") as GameCategory,
    cover: row.cover ?? "",
    color: (row.color ?? "cyan") as NeonColor,
    sort: row.sort ?? 0,
    best: row.best ?? 0,
    plays: row.plays ?? 0,
  };
}
