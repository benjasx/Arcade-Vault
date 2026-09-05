import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toGame } from "@/lib/games";
import { GamePlayer } from "@/components/game-player";
import { AsteroidsPlayer } from "@/components/asteroids-player";

export default async function GamePlayerPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  const game = toGame({ ...row, best: 0, plays: 0 });

  // `rocas` usa el motor real de asteroides; el resto sigue con la simulación.
  return game.id === "rocas" ? <AsteroidsPlayer game={game} /> : <GamePlayer game={game} />;
}
