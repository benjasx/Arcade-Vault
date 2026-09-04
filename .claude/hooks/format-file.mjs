#!/usr/bin/env node
// PostToolUse (Write|Edit): formatea el archivo tocado con Prettier y, si es
// lintable, encola su ruta para la pasada de ESLint del hook Stop.
// Nunca falla el turno: cualquier problema termina en exit 0 silencioso.

import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const PRETTIER_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".json",
  ".css",
]);
const LINT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORED_TOP = new Set(["node_modules", ".next", "out", "build", "references", ".git"]);

function queueFile(sessionId) {
  const safe = String(sessionId || "nosession").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), `arcade-vault-lint-${safe}.txt`);
}

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return;

  const input = JSON.parse(raw);
  const rawPath = input?.tool_response?.filePath ?? input?.tool_input?.file_path;
  if (!rawPath) return;

  const abs = path.resolve(rawPath);
  const rel = path.relative(ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return; // fuera del proyecto
  if (IGNORED_TOP.has(rel.split(path.sep)[0])) return;

  const ext = path.extname(abs).toLowerCase();
  if (!PRETTIER_EXT.has(ext)) return;
  if (!existsSync(abs)) return;

  const prettier = await import("prettier");
  const info = await prettier.getFileInfo(abs, { resolveConfig: true });
  if (info.ignored || !info.inferredParser) {
    // aún así puede necesitar lint
  } else {
    const options = (await prettier.resolveConfig(abs)) ?? {};
    const src = await readFile(abs, "utf8");
    const out = await prettier.format(src, { ...options, filepath: abs });
    if (out !== src) await writeFile(abs, out);
  }

  if (LINT_EXT.has(ext)) {
    await appendFile(queueFile(input.session_id), abs + "\n");
  }
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
