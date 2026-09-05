"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeaderRow } from "@/lib/leaderboard";

type MineRow = { rank: number; name: string; score: number; updated_at: string };

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES");
}

export function HallOfFame({
  games,
  boards,
  mine,
}: {
  games: { id: string; title: string }[];
  boards: Record<string, LeaderRow[]>;
  mine: Record<string, MineRow>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(games[0]?.id ?? "");

  const rows = boards[tab] ?? [];
  const game = games.find((g) => g.id === tab);
  const you = mine[tab];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "72px 16px",
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{
              fontSize: 13,
              color: "var(--magenta)",
              marginBottom: 12,
            }}
          >
            SIN MARCAS TODAVÍA
          </div>
          <div>Nadie ha puntuado en {game?.title}. La primera puede ser tuya.</div>
        </div>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
                <div className="date">{fmtDate(rows[1].updated_at)}</div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{fmtDate(rows[0].updated_at)}</div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
                <div className="date">{fmtDate(rows[2].updated_at)}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.rank + "-" + r.name}
                className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{fmtDate(r.updated_at)}</div>
              </div>
            ))}
            {you && (
              <>
                <div className="tr you-label">▸ TU MEJOR MARCA EN {game?.title}</div>
                <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(you.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {you.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {you.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{fmtDate(you.updated_at)}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push("/juegos")}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}
