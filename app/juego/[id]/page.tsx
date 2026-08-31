import { notFound } from "next/navigation";
import { GAMES, seededScores } from "@/lib/data";
import { GameDetail } from "@/components/game-detail";

export default async function GameDetailPage({
  params,
}: PageProps<"/juego/[id]">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  const scores = seededScores(id.length * 17 + 3, 10);

  return <GameDetail game={game} scores={scores} />;
}
