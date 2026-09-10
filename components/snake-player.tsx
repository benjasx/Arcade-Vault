"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createSnakeGame, type SnakeHandle } from "@/lib/games/snake";
import { registerPlay, submitScore } from "@/lib/leaderboard";
import type { Game } from "@/lib/games";

/**
 * Reproductor del juego real NEONSNAKE (solo para la entrada `snake`).
 * Monta el controlador imperativo `createSnakeGame` dentro del marco CRT de la
 * plataforma. El tablero, la serpiente, la comida y el flash de muerte se
 * dibujan en canvas; el HUD escalar (`Puntuación` / `Velocidad`) llega por
 * `onStats` y se pinta en la fila `.player-hud`. El modal de fin de partida es
 * el dueño del reinicio y del guardado (mismo flujo que `asteroids-player`).
 */
export function SnakePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SnakeHandle | null>(null);

  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  // acción en curso: bloquea el resto de botones y muestra spinner en el pulsado
  const [pending, setPending] = useState<"again" | "vault" | "login" | "exit" | null>(null);
  const [stats, setStats] = useState({ score: 0, speed: 1 });
  const locked = pending !== null || busy;

  useEffect(() => {
    const h = createSnakeGame(canvasRef.current!, {
      onGameOver: (score) => {
        setFinalScore(score);
        setOver(true);
        void registerPlay(game.id);
      },
      onStats: (s) => setStats(s),
    });
    handleRef.current = h;
    return () => {
      h.destroy();
      handleRef.current = null;
    };
  }, [game.id]);

  const togglePause = () => {
    const h = handleRef.current;
    if (!h) return;
    if (paused) {
      h.resume();
      setPaused(false);
    } else {
      h.pause();
      setPaused(true);
    }
  };

  const playAgain = () => {
    if (locked) return;
    setPending("again");
    // deja pintar el spinner un frame antes del reinicio (canvas síncrono)
    requestAnimationFrame(() => {
      handleRef.current?.restart();
      setOver(false);
      setSaved(false);
      setSaveErr(null);
      setPaused(false);
      setPending(null);
    });
  };

  const goto = (target: "vault" | "login" | "exit") => {
    if (locked) return;
    setPending(target);
    const href =
      target === "vault" ? "/juegos" : target === "login" ? "/login" : `/juego/${game.id}`;
    router.push(href);
  };

  const save = async () => {
    setBusy(true);
    setSaveErr(null);
    try {
      await submitScore(game.id, finalScore);
      setSaved(true);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  const spin = (
    <span
      className="spinner"
      style={{ width: 12, height: 12, marginRight: 8, verticalAlign: "-1px" }}
    />
  );

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Juego</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {game.title}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{stats.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Velocidad</div>
            <div className="v">{stats.speed.toFixed(1)}×</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause} disabled={locked}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn ghost" onClick={() => goto("exit")} disabled={locked}>
            {pending === "exit" ? <>{spin}SALIENDO…</> : "SALIR"}
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas ref={canvasRef} className="asteroids-canvas" width={528} height={528} />
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString("es-ES")}</div>
            {!user ? (
              <button className="btn yellow" onClick={() => goto("login")} disabled={locked}>
                {pending === "login" ? <>{spin}ABRIENDO…</> : "INICIA SESIÓN PARA GUARDAR"}
              </button>
            ) : saved ? (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            ) : (
              <button className="btn yellow" disabled={locked} onClick={save}>
                {busy ? <>{spin}GUARDANDO…</> : "GUARDAR PUNTUACIÓN"}
              </button>
            )}
            {saveErr && (
              <div className="mono neon-magenta" style={{ fontSize: 11, marginTop: 8 }}>
                ▸ {saveErr}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={playAgain} disabled={locked}>
                {pending === "again" ? <>{spin}CARGANDO…</> : "JUGAR DE NUEVO"}
              </button>
              <button className="btn magenta" onClick={() => goto("vault")} disabled={locked}>
                {pending === "vault" ? <>{spin}CARGANDO…</> : "VOLVER AL VAULT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
