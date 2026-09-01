import Link from "next/link";

export default function NotFound() {
  return (
    <div className="av-auth-wrap fade-in">
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div className="pixel neon-magenta" style={{ fontSize: 48 }}>
          404
        </div>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 14, marginTop: 16, letterSpacing: "0.14em" }}
        >
          PANTALLA NO ENCONTRADA
        </div>
        <p style={{ color: "var(--ink-dim)", margin: "16px 0 24px" }}>
          Esta ruta no existe en el Vault. Quizá la máquina se tragó la moneda.
        </p>
        <Link className="btn lg" href="/juegos">
          VOLVER AL VAULT
        </Link>
      </div>
    </div>
  );
}
