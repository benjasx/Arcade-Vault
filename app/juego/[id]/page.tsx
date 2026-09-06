import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toGame } from "@/lib/games";
import type { LeaderRow } from "@/lib/leaderboard";
import { GameDetail } from "@/components/game-detail";

export default async function GameDetailPage({ params }: PageProps<"/juego/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("games_with_stats")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const { data: lb } = await supabase
    .from("leaderboard")
    .select("rank, name, score, updated_at")
    .eq("game_id", id)
    .order("rank")
    .limit(10);

  const scores: LeaderRow[] = (lb ?? []).map((r) => ({
    rank: r.rank ?? 0,
    name: r.name ?? "—",
    score: r.score ?? 0,
    updated_at: r.updated_at ?? "",
  }));

  return <GameDetail game={toGame(row)} scores={scores} />;
}
