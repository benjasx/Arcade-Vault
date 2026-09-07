"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createTetrisGame, type TetrisHandle, type SkinName } from "@/lib/games/tetris";
import { registerPlay, submitScore } from "@/lib/leaderboard";
import type { Game } from "@/lib/games";

const SKIN_OPTIONS: { value: SkinName; label: string }[] = [
  { value: "retro", label: "RETRO" },
  { value: "neon", label: "NEÓN" },
  { value: "pastel", label: "PASTEL" },
  { value: "pixel", label: "PIXEL ART" },
];

/** Skin persistido en `localStorage`, o `null` si no hay/es inválido. */
function readStoredSkin(): SkinName | null {
  try {
    const v = localStorage.getItem("tetris-skin");
    return SKIN_OPTIONS.some((o) => o.value === v) ? (v as SkinName) : null;
  } catch {
    return null;
  }
}

/**
 * Reproductor del juego real TETRABYTE (solo para la entrada `tetris`).
 * Monta el controlador imperativo `createTetrisGame` dentro del marco CRT de la
 * plataforma. El tablero, el ghost, la preview NEXT y los popups se dibujan en
 * canvas; el HUD escalar (`Puntuación` / `Líneas` / `Nivel` / `Power-up`) llega
 * por `onStats` y se pinta en la fila `.player-hud`. El modal de fin de partida
 * es el dueño del reinicio y del guardado (mismo flujo que `asteroids-player`).
 */
export function TetrisPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useAuth();

  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<TetrisHandle | null>(null);

  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  // acción en curso: bloquea el resto de botones y muestra spinner en el pulsado
  const [pending, setPending] = useState<"again" | "vault" | "login" | "exit" | null>(null);
  const [stats, setStats] = useState({ score: 0, lines: 0, level: 1, powerupLabel: "" });
  const [skin, setSkin] = useState<SkinName>("retro");
  const locked = pending !== null || busy;

  useEffect(() => {
    const h = createTetrisGame(boardRef.current!, {
      nextCanvas: nextRef.current!,
      onGameOver: (score) => {
        setFinalScore(score);
        setOver(true);
        void registerPlay(game.id);
      },
      onStats: (s) => setStats(s),
    });
    handleRef.current = h;
    // Lee el skin guardado tras el montaje (no en el render: en SSR no hay
    // `localStorage` y una lectura durante el render daría mismatch de
    // hidratación). Aquí el setState puntual es correcto y necesario.
    const stored = readStoredSkin();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSkin(stored);
      h.setSkin(stored);
    }
    return () => {
      h.destroy();
      handleRef.current = null;
    };
  }, [game.id]);

  const changeSkin = (s: SkinName) => {
    setSkin(s);
    handleRef.current?.setSkin(s);
    try {
      localStorage.setItem("tetris-skin", s);
    } catch {
      /* localStorage no disponible */
    }
  };

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
            <div className="l">Líneas</div>
            <div className="v">{stats.lines}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(stats.level).padStart(2, "0")}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Power-up</div>
            <div className="v">{stats.powerupLabel || "—"}</div>
          </div>
        </div>
        <div className="hud-actions">
          <select
            className="hud-select"
            aria-label="Skin del tablero"
            value={skin}
            onChange={(e) => changeSkin(e.target.value as SkinName)}
            disabled={locked}
          >
            {SKIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="btn yellow" onClick={togglePause} disabled={locked}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn ghost" onClick={() => goto("exit")} disabled={locked}>
            {pending === "exit" ? <>{spin}SALIENDO…</> : "SALIR"}
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen tetris">
          <div className="tetris-stage">
            <canvas ref={boardRef} className="tetris-board" width={450} height={600} />
            <canvas ref={nextRef} className="tetris-next" width={120} height={120} />
          </div>
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
