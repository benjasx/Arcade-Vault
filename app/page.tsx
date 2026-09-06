import { HomeScreen, type ActivityRow, type TopScoreRow } from "@/components/home-screen";
import { createClient } from "@/lib/supabase/server";
import { toGame, isPlayable } from "@/lib/games";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: statsData }, { data: gameRows }, { data: lb }] = await Promise.all([
    supabase.from("games_with_stats").select("*").order("sort"),
    supabase.from("games").select("id, title"),
    supabase.from("leaderboard").select("game_id, name, score, updated_at"),
  ]);

  const games = (statsData ?? []).map(toGame).filter((g) => isPlayable(g.id));

  const titleById = new Map((gameRows ?? []).map((g) => [g.id, g.title]));
  const rows = (lb ?? []).map((r) => ({
    name: r.name ?? "—",
    game: titleById.get(r.game_id ?? "") ?? "—",
    score: r.score ?? 0,
    updatedAt: r.updated_at ?? "",
  }));

  const recent: ActivityRow[] = [...rows]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 7);

  const topScores: TopScoreRow[] = [...rows]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r, i) => ({ rank: i + 1, name: r.name, score: r.score }));

  return <HomeScreen games={games} recent={recent} topScores={topScores} />;
}
