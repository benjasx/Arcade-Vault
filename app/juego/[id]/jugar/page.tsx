import { notFound } from "next/navigation";
import { GAMES } from "@/lib/data";
import { GamePlayer } from "@/components/game-player";
import { AsteroidsPlayer } from "@/components/asteroids-player";

export default async function GamePlayerPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  // `rocas` usa el motor real de asteroides; el resto sigue con la simulación.
  return game.id === "rocas" ? <AsteroidsPlayer game={game} /> : <GamePlayer game={game} />;
}
