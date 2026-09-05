// ===== lib/data.ts — categorías y tipos de tema compartidos =====
// El catálogo de juegos y los rankings mock se movieron a Supabase en SPEC 06.
// Aquí solo queda lo que no depende de la base de datos.

export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const satisfies readonly [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
