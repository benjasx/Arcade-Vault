// ===== lib/scores.ts — puntuaciones guardadas (localStorage "av_scores") =====

export interface SavedScore {
  game: string; // Game["id"]
  score: number;
  name: string; // iniciales, <= 10 chars, mayúsculas
  at: number; // Date.now()
}

const STORAGE_KEY = "av_scores";

/** Lectura tolerante a fallos: SSR, modo privado o JSON corrupto devuelven []. */
export function getScores(): SavedScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedScore[]) : [];
  } catch {
    return [];
  }
}

/** Añade una entrada a av_scores con marca de tiempo. No hace nada si no hay localStorage. */
export function saveScore(entry: Omit<SavedScore, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const all = getScores();
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // sin persistencia disponible: se descarta silenciosamente
  }
}
