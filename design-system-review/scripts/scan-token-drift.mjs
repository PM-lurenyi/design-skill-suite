#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_EXTENSIONS = new Set([
  ".css", ".scss", ".sass", ".less", ".html", ".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte"
]);

const EXCLUDED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "coverage", ".next", ".nuxt", "out", "work", "deploy"
]);

function parseArgs(argv) {
  const args = { root: process.cwd(), design: "docs/design/DESIGN.md", report: "docs/design/review-report.md", platform: "base" };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: scan-token-drift.mjs --root <project-root> [--design docs/design/DESIGN.md] [--report docs/design/review-report.md] [--platform base|pc|mobile]");
    process.exit(0);
  }
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--root") args.root = argv[++i] || args.root;
    else if (item === "--design") args.design = argv[++i] || args.design;
    else if (item === "--report") args.report = argv[++i] || args.report;
    else if (item === "--platform") args.platform = argv[++i] || args.platform;
  }
  if (!["base", "pc", "mobile"].includes(args.platform)) {
    throw new Error("--platform must be one of: base, pc, mobile");
  }
  args.root = path.resolve(process.cwd(), args.root);
  args.design = path.resolve(args.root, args.design);
  args.report = path.resolve(args.root, args.report);
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureWorkIgnore(root) {
  const workDir = path.join(root, "work");
  ensureDir(workDir);
  const ignorePath = path.join(workDir, ".gitignore");
  if (!fs.existsSync(ignorePath)) fs.writeFileSync(ignorePath, "*\n!.gitignore\n", "utf8");
  ensureDir(path.join(workDir, "design-review"));
}

function readSingleDesign(designPath, required = true) {
  if (!fs.existsSync(designPath)) {
    if (!required) return null;
    throw new Error(`未找到 DESIGN.md: ${designPath}`);
  }
  const text = fs.readFileSync(designPath, "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  const yaml = frontmatter ? frontmatter[1] : text;
  const radii = new Set([...yaml.matchAll(/(?:rounded|borderRadius|radius)[^:\n]*:\s*["']?(\d+(?:\.\d+)?(?:px|rem)|999px)["']?/gi)].map((match) => toPx(match[1])));
  for (const value of collectSectionValues(yaml, "rounded")) {
    radii.add(toPx(value));
  }
  return {
    path: designPath,
    text,
    colors: new Set([...yaml.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => normalizeHex(match[0]))),
    fontSizes: new Set([...yaml.matchAll(/fontSize:\s*["']?(\d+(?:\.\d+)?(?:px|rem))["']?/g)].map((match) => toPx(match[1]))),
    radii,
  };
}

function collectSectionValues(yaml, sectionName) {
  const values = [];
  const lines = yaml.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    if (new RegExp(`^${sectionName}:\\s*$`).test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^[a-zA-Z0-9_-]+:\s*/.test(line)) break;
    if (!inSection) continue;
    const match = line.match(/^\s+[a-zA-Z0-9_-]+:\s*["']?(\d+(?:\.\d+)?(?:px|rem)|999px)["']?/);
    if (match) values.push(match[1]);
  }
  return values;
}

function mergeSets(items, key) {
  const merged = new Set();
  for (const item of items) {
    if (!item) continue;
    for (const value of item[key]) merged.add(value);
  }
  return merged;
}

function designPathsForArgs(args) {
  const paths = [args.design];
  if (args.platform === "pc") paths.push(path.resolve(args.root, "docs/design/DESIGN_PC.md"));
  if (args.platform === "mobile") paths.push(path.resolve(args.root, "docs/design/DESIGN_MOBILE.md"));
  return paths;
}

function readDesign(args) {
  const paths = designPathsForArgs(args);
  const items = paths.map((item, index) => readSingleDesign(item, index === 0)).filter(Boolean);
  return {
    paths: items.map((item) => item.path),
    text: items.map((item) => item.text).join("\n"),
    colors: mergeSets(items, "colors"),
    fontSizes: mergeSets(items, "fontSizes"),
    radii: mergeSets(items, "radii"),
  };
}

function normalizeHex(value) {
  const body = value.replace("#", "").toLowerCase();
  if (body.length === 3) return `#${body.split("").map((char) => char + char).join("").toUpperCase()}`;
  if (body.length === 8 && body.endsWith("ff")) return `#${body.slice(0, 6).toUpperCase()}`;
  return `#${body.toUpperCase()}`;
}

function toPx(value) {
  const raw = String(value).trim().toLowerCase();
  if (raw === "999px" || raw === "999") return "999px";
  const match = raw.match(/(\d+(?:\.\d+)?)(px|rem)?/);
  if (!match) return raw;
  const px = Math.round(Number(match[1]) * (match[2] === "rem" ? 16 : 1));
  return `${px}px`;
}

function listFiles(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const fullPath = path.join(current, entry.name);
    const rel = path.relative(root, fullPath);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (rel.startsWith(`docs${path.sep}design`)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".agents" && entry.name !== ".cursor" && entry.name !== ".trae") continue;
      listFiles(root, fullPath, files);
    } else if (DEFAULT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function addIssue(issues, severity, title, file, detail) {
  issues.push({ severity, title, file, detail });
}

function scanFile(root, file, design, issues) {
  const rel = path.relative(root, file);
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  if (text.length > 800000) return;

  for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const color = normalizeHex(match[0]);
    if (!design.colors.has(color)) {
      addIssue(issues, "P1", "未登记色值", rel, `发现 ${color}，但 DESIGN.md 未登记。`);
    }
  }

  for (const match of text.matchAll(/font-size\s*[:=]\s*["']?(\d+(?:\.\d+)?(?:px|rem))["']?/gi)) {
    const size = toPx(match[1]);
    if (design.fontSizes.size && !design.fontSizes.has(size)) {
      addIssue(issues, "P2", "字号漂移", rel, `发现 font-size ${size}，但 DESIGN.md 未登记。`);
    }
  }

  for (const match of text.matchAll(/border-radius\s*[:=]\s*["']?(\d+(?:\.\d+)?(?:px|rem)|999px|50%)["']?/gi)) {
    const radius = match[1] === "50%" ? "999px" : toPx(match[1]);
    if (design.radii.size && !design.radii.has(radius)) {
      const numeric = Number(radius.replace("px", ""));
      const severity = numeric >= 20 && radius !== "999px" ? "P1" : "P2";
      addIssue(issues, severity, "圆角漂移", rel, `发现 border-radius ${radius}，但 DESIGN.md 未登记。`);
    }
  }
}

function renderReport(issues, root, designPaths, platform) {
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  const lines = [
    "# 设计系统审查报告",
    "",
    `- 生成时间：${new Date().toISOString()}`,
    `- 项目根目录：${root}`,
    `- 设计规范：${designPaths.join(", ")}`,
    `- 平台：${platform}`,
    `- P0：${counts.P0}`,
    `- P1：${counts.P1}`,
    `- P2：${counts.P2}`,
    `- P3：${counts.P3}`,
    "",
    "## 问题清单",
    "",
  ];

  if (!issues.length) {
    lines.push("未发现明显视觉漂移。");
  } else {
    lines.push("| Severity | Title | File | Detail |");
    lines.push("| --- | --- | --- | --- |");
    for (const issue of issues.slice(0, 300)) {
      lines.push(`| ${issue.severity} | ${issue.title} | ${issue.file} | ${issue.detail.replace(/\|/g, "/")} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function run() {
  const args = parseArgs(process.argv);
  ensureDir(path.dirname(args.report));
  ensureWorkIgnore(args.root);

  const design = readDesign(args);
  const issues = [];
  for (const file of listFiles(args.root)) {
    scanFile(args.root, file, design, issues);
  }

  const designPaths = design.paths.map((item) => path.relative(args.root, item));
  fs.writeFileSync(args.report, renderReport(issues, args.root, designPaths, args.platform), "utf8");

  const p0 = issues.filter((issue) => issue.severity === "P0").length;
  const p1 = issues.filter((issue) => issue.severity === "P1").length;
  const p2 = issues.filter((issue) => issue.severity === "P2").length;

  if (p0) {
    console.error(`Design review failed: ${p0} P0 issues. Report: ${path.relative(args.root, args.report)}`);
    process.exit(2);
  }
  if (p1) {
    console.error(`Design review failed: ${p1} P1 issues. Report: ${path.relative(args.root, args.report)}`);
    process.exit(1);
  }
  if (p2) {
    console.warn(`Design review warning: ${p2} P2 issues. Report: ${path.relative(args.root, args.report)}`);
  } else {
    console.log(`Design review passed. Report: ${path.relative(args.root, args.report)}`);
  }
}

run();
