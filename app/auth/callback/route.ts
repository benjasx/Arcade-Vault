import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cierre del flujo OAuth: canjea el `code` por una sesión y vuelve a /juegos.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/juegos`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
