import { createClient } from "@/lib/supabase/client";

// Fila del leaderboard tal como la devuelve la vista public.leaderboard (top N por juego).
export type LeaderRow = {
  rank: number;
  name: string;
  score: number;
  updated_at: string;
};

// Envía una marca: el RPC submit_score solo la persiste si supera la mejor previa.
export async function submitScore(gameId: string, score: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("submit_score", {
    p_game_id: gameId,
    p_score: score,
  });
  if (error) throw error;
}
