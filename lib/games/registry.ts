import type { ComponentType } from "react";
import { AsteroidsPlayer } from "@/components/asteroids-player";
import { TetrisPlayer } from "@/components/tetris-player";
import type { Game } from "@/lib/games";

/**
 * Registro central de juegos con motor real. Cada entrada mapea el `id` de la
 * fila de `games` a su componente reproductor. Sustituye al ternario hardcodeado
 * de `app/juego/[id]/jugar/page.tsx` y al `Set` `PLAYABLE_GAME_IDS`: añadir un
 * juego nuevo es una línea más en este mapa.
 */
export const GAME_REGISTRY: Record<string, ComponentType<{ game: Game }>> = {
  rocas: AsteroidsPlayer,
  tetris: TetrisPlayer,
};

export function playerFor(id: string): ComponentType<{ game: Game }> | null {
  return GAME_REGISTRY[id] ?? null;
}
