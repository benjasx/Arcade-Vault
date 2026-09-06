import { createElement } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toGame } from "@/lib/games";
import { playerFor } from "@/lib/games/registry";
import { GamePlayer } from "@/components/game-player";

export default async function GamePlayerPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  const game = toGame({ ...row, best: 0, plays: 0 });

  // Los juegos con motor real salen del registro; el resto sigue con la simulación.
  const Player = playerFor(game.id) ?? GamePlayer;
  return createElement(Player, { game });
}
