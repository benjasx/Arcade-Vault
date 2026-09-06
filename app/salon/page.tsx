import { HallOfFame } from "@/components/hall-of-fame";
import { createClient } from "@/lib/supabase/server";
import { isPlayable } from "@/lib/games";
import type { LeaderRow } from "@/lib/leaderboard";

type MineRow = { rank: number; name: string; score: number; updated_at: string };

export default async function SalonPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: games },
    { data: lb },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("games").select("id, title").order("sort"),
    supabase.from("leaderboard").select("game_id, rank, name, score, updated_at").order("rank"),
  ]);

  // leaderboard completo agrupado por juego
  const boards: Record<string, LeaderRow[]> = {};
  for (const r of lb ?? []) {
    if (!r.game_id) continue;
    (boards[r.game_id] ??= []).push({
      rank: r.rank ?? 0,
      name: r.name ?? "—",
      score: r.score ?? 0,
      updated_at: r.updated_at ?? "",
    });
  }

  // rango real del usuario por juego (solo donde tiene marca)
  const mine: Record<string, MineRow> = {};
  if (user) {
    const { data: rows } = await supabase
      .from("leaderboard")
      .select("game_id, rank, name, score, updated_at")
      .eq("user_id", user.id);
    for (const r of rows ?? []) {
      if (!r.game_id) continue;
      mine[r.game_id] = {
        rank: r.rank ?? 0,
        name: r.name ?? "TÚ",
        score: r.score ?? 0,
        updated_at: r.updated_at ?? "",
      };
    }
  }

  // Solo juegos jugables o con al menos una marca registrada.
  const visibleGames = (games ?? []).filter(
    (g) => isPlayable(g.id) || (boards[g.id]?.length ?? 0) > 0,
  );

  return <HallOfFame games={visibleGames} boards={boards} mine={mine} />;
}
