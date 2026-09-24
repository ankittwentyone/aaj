#!/usr/bin/env node
// scripts/check_aesthetic.js — hash gate for aesthetic.lock.json vs src/index.css
// Fails CI if @theme tokens drift from lock file.
import { readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";

const lockPath = path.resolve("aesthetic.lock.json");
const cssPath = path.resolve("src/index.css");

let lock;
try {
  lock = JSON.parse(readFileSync(lockPath, "utf8"));
} catch (e) {
  console.error(`[aesthetic] missing or invalid ${lockPath}: ${e.message}`);
  process.exit(1);
}

let css;
try {
  css = readFileSync(cssPath, "utf8");
} catch (e) {
  console.error(`[aesthetic] missing ${cssPath}: ${e.message}`);
  process.exit(1);
}

const hash = "sha256:" + createHash("sha256").update(css).digest("hex");
if (hash !== lock.hash) {
  console.error(`[aesthetic] HASH MISMATCH`);
  console.error(`  lock: ${lock.hash}`);
  console.error(`  css : ${hash}`);
  console.error(`  Fix: update aesthetic.lock.json hash after intentional token change, or revert src/index.css drift.`);
  process.exit(1);
}

// Token verbatim checks — canvas/panel must exist with exact hex in css
const mustContain = [
  ["--color-canvas: #09090B", "canvas #09090B"],
  ["--color-panel: #111113", "panel #111113"],
  ["--color-raised: #18181B", "raised #18181B"],
  ["--color-warning: #F59E0B", "warning #F59E0B"],
  ["--color-success: #4ADE80", "success #4ADE80"],
  ["--color-danger: #FF4444", "danger #FF4444"],
];
let drift = false;
for (const [needle, label] of mustContain) {
  if (!css.includes(needle)) {
    console.error(`[aesthetic] TOKEN DRIFT: missing "${needle}" (${label}) in src/index.css`);
    drift = true;
  }
}
// banned drifts
const banned = ["#0A0A0B", "#050505", "C9A86A", "rounded-[16", "rounded-[24"];
for (const b of banned) {
  if (css.includes(b)) {
    console.error(`[aesthetic] BANNED token "${b}" found in src/index.css`);
    drift = true;
  }
}
if (drift) process.exit(1);

console.log(`[aesthetic] ok — ${hash} — canvas #09090B panel #111113 verified`);
