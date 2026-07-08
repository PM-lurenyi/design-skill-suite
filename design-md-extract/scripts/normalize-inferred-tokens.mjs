#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SPACING_STEPS = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120];
const RADIUS_STEPS = [0, 2, 4, 6, 8, 12, 16, 24, 32, 999];
const FONT_SIZE_STEPS = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64];

function nearest(value, steps) {
  return steps.reduce((best, item) => {
    return Math.abs(item - value) < Math.abs(best - value) ? item : best;
  }, steps[0]);
}

export function parseCssLength(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "999px" || trimmed === "999") return 999;
  const px = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (px) return Number(px[1]);
  const rem = trimmed.match(/^(-?\d+(?:\.\d+)?)rem$/);
  if (rem) return Number(rem[1]) * 16;
  const raw = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
  if (raw) return Number(raw[1]);
  return null;
}

export function normalizeColor(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!hex) return trimmed;
  let body = hex[1].toLowerCase();
  if (body.length === 3) {
    body = body.split("").map((char) => char + char).join("");
  }
  if (body.length === 8 && body.endsWith("ff")) {
    body = body.slice(0, 6);
  }
  return `#${body.toUpperCase()}`;
}

export function normalizeValueForPath(tokenPath, value) {
  const lowerPath = tokenPath.toLowerCase();
  if (lowerPath.startsWith("colors.")) {
    return { value: normalizeColor(value), normalization: "normalized-hex-color" };
  }

  const numeric = parseCssLength(value);
  if (numeric == null) {
    return { value, normalization: "none" };
  }

  if (lowerPath.startsWith("spacing.")) {
    return { value: `${nearest(numeric, SPACING_STEPS)}px`, normalization: "snapped-to-spacing-scale" };
  }

  if (lowerPath.startsWith("rounded.")) {
    return { value: `${nearest(numeric, RADIUS_STEPS)}px`, normalization: "snapped-to-radius-scale" };
  }

  if (lowerPath.includes("fontsize") || lowerPath.startsWith("typography.")) {
    return { value: `${nearest(numeric, FONT_SIZE_STEPS)}px`, normalization: "snapped-to-font-size-scale" };
  }

  return { value, normalization: "none" };
}

export function normalizeEvidence(evidence) {
  const copy = { ...evidence, tokens: Array.isArray(evidence.tokens) ? [...evidence.tokens] : [] };
  copy.tokens = copy.tokens.map((token) => {
    if (token.confidence !== "inferred") return token;
    const normalized = normalizeValueForPath(token.path || "", token.rawValue ?? token.normalizedValue);
    return {
      ...token,
      normalizedValue: normalized.value,
      normalization: normalized.normalization,
    };
  });
  return copy;
}

function runCli() {
  const evidencePath = process.argv[2];
  if (!evidencePath) {
    console.error("Usage: normalize-inferred-tokens.mjs <docs/design/evidence.json>");
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), evidencePath);
  const evidence = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const normalized = normalizeEvidence(evidence);
  fs.writeFileSync(absolutePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  console.log(`Normalized inferred tokens: ${absolutePath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
