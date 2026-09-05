#!/usr/bin/env node
// Stop: corre `eslint --fix` UNA vez sobre los archivos lintables que el hook
// de formato encoló durante el turno. Los errores que ESLint no puede arreglar
// se devuelven a Claude (decision: "block") para que los corrija, con tope de
// reintentos para no entrar en bucle.

import { readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const MAX_BLOCKS = 3;
const MAX_REPORTED = 20;

function safeId(sessionId) {
  return String(sessionId || "nosession").replace(/[^a-zA-Z0-9_-]/g, "_");
}
const tmp = (id, suffix) => path.join(os.tmpdir(), `arcade-vault-lint-${safeId(id)}${suffix}`);

async function readAttempts(f) {
  try {
    return parseInt((await readFile(f, "utf8")).trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  const input = raw ? JSON.parse(raw) : {};

  const queuePath = tmp(input.session_id, ".txt");
  const attemptsPath = tmp(input.session_id, ".attempts");

  let list = [];
  try {
    list = (await readFile(queuePath, "utf8"))
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return; // cola vacía: nada que relintar, fin del turno
  }
  await unlink(queuePath).catch(() => {});

  const files = [...new Set(list)].filter((f) => existsSync(f));
  if (files.length === 0) {
    await unlink(attemptsPath).catch(() => {});
    return;
  }

  const { ESLint } = await import("eslint");
  const eslint = new ESLint({ fix: true, cwd: ROOT, errorOnUnmatchedPattern: false });
  const results = await eslint.lintFiles(files);
  await ESLint.outputFixes(results);

  const lines = [];
  for (const r of results) {
    for (const m of r.messages) {
      if (m.severity !== 2) continue;
      const rel = path.relative(ROOT, r.filePath) || r.filePath;
      lines.push(`${rel}:${m.line ?? 0}:${m.column ?? 0}  ${m.ruleId || "parse"}  ${m.message}`);
    }
  }

  if (lines.length === 0) {
    await unlink(attemptsPath).catch(() => {});
    return;
  }

  const attempts = (await readAttempts(attemptsPath)) + 1;
  await writeFile(attemptsPath, String(attempts));

  const shown = lines.slice(0, MAX_REPORTED);
  const extra = lines.length - shown.length;
  const body =
    `ESLint dejó ${lines.length} error(es) sin autofixear:\n` +
    shown.join("\n") +
    (extra > 0 ? `\n… y ${extra} más` : "");

  if (attempts >= MAX_BLOCKS) {
    await unlink(attemptsPath).catch(() => {});
    process.stdout.write(
      JSON.stringify({
        systemMessage: `${body}\n(no se bloquea: ${MAX_BLOCKS} intentos alcanzados; corrígelos manualmente)`,
      }),
    );
    return;
  }

  process.stdout.write(JSON.stringify({ decision: "block", reason: body }));
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
