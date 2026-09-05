import { HomeScreen } from "@/components/home-screen";
import { createClient } from "@/lib/supabase/server";
import { toGame } from "@/lib/games";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.from("games_with_stats").select("*").order("sort").limit(6);
  const games = (data ?? []).map(toGame);

  return <HomeScreen games={games} />;
}
