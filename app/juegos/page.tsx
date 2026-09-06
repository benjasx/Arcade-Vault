import { LibraryScreen } from "@/components/library-screen";
import { createClient } from "@/lib/supabase/server";
import { toGame, isPlayable } from "@/lib/games";

export default async function JuegosPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("games_with_stats").select("*").order("sort");
  const games = (data ?? []).map(toGame).filter((g) => isPlayable(g.id));

  return <LibraryScreen games={games} />;
}
