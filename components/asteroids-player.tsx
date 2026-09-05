"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createAsteroidsGame, type AsteroidsHandle } from "@/lib/games/asteroids";
import { saveScore } from "@/lib/scores";
import type { Game } from "@/lib/data";

/**
 * Reproductor del juego real de asteroides (solo para la entrada `rocas`).
 * Monta el controlador imperativo `createAsteroidsGame` dentro del marco CRT de
 * la plataforma. El HUD y la pantalla de "GAME OVER" se dibujan en el canvas;
 * aquí solo viven el marco, los botones PAUSA/SALIR y el modal de fin de partida.
 */
export function AsteroidsPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<AsteroidsHandle | null>(null);

  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  // Nombre inicial: el del usuario si hay sesión, si no "INVITADO".
  const [name, setName] = useState<string>(() => user?.name ?? "INVITADO");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const h = createAsteroidsGame(canvasRef.current!, {
      onGameOver: (score) => {
        setFinalScore(score);
        setOver(true);
      },
    });
    handleRef.current = h;
    return () => {
      h.destroy();
      handleRef.current = null;
    };
  }, []);

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
    handleRef.current?.restart();
    setOver(false);
    setSaved(false);
    setPaused(false);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stat">
          <div className="l">Juego</div>
          <div className="v" style={{ color: "var(--ink)" }}>
            {game.title}
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn ghost" onClick={() => router.push(`/juego/${game.id}`)}>
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas ref={canvasRef} className="asteroids-canvas" width={800} height={600} />
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
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score: finalScore, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={playAgain}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/juegos")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
