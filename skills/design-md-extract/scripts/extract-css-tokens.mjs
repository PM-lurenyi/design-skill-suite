#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizeColor } from "./normalize-inferred-tokens.mjs";

const DEFAULT_EXTENSIONS = new Set([
  ".css", ".scss", ".sass", ".less", ".html", ".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".md", ".mdx"
]);

const EXCLUDED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "coverage", ".next", ".nuxt", "out", "work", "deploy"
]);

function parseArgs(argv) {
  const args = { root: process.cwd(), out: "docs/design", target: "base" };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: extract-css-tokens.mjs --root <project-root> [--out docs/design] [--target base|pc|mobile]");
    process.exit(0);
  }
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--root") args.root = argv[++i] || args.root;
    else if (item === "--out") args.out = argv[++i] || args.out;
    else if (item === "--target") args.target = argv[++i] || args.target;
  }
  if (!["base", "pc", "mobile"].includes(args.target)) {
    throw new Error("--target must be one of: base, pc, mobile");
  }
  args.root = path.resolve(process.cwd(), args.root);
  args.out = path.resolve(args.root, args.out);
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureWorkIgnore(root) {
  const workDir = path.join(root, "work");
  ensureDir(workDir);
  const ignorePath = path.join(workDir, ".gitignore");
  if (!fs.existsSync(ignorePath)) {
    fs.writeFileSync(ignorePath, "*\n!.gitignore\n", "utf8");
  }
  ensureDir(path.join(workDir, "design-evidence"));
}

function listFiles(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".agents") {
      if (entry.name !== ".cursor" && entry.name !== ".trae") continue;
    }
    const fullPath = path.join(current, entry.name);
    const rel = path.relative(root, fullPath);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (rel.startsWith(`docs${path.sep}design`)) continue;
      listFiles(root, fullPath, files);
    } else if (DEFAULT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function addCount(map, value, source) {
  if (!value) return;
  const normalized = String(value).trim();
  if (!normalized) return;
  const current = map.get(normalized) || { count: 0, sources: new Set() };
  current.count += 1;
  if (source) current.sources.add(source);
  map.set(normalized, current);
}

function toArray(map) {
  return [...map.entries()]
    .map(([value, data]) => ({ value, count: data.count, sources: [...data.sources].slice(0, 5) }))
    .sort((a, b) => b.count - a.count);
}

function tokenPathFromCssVar(name, value) {
  const lower = name.toLowerCase();
  if (/#[0-9a-f]{3,8}/i.test(value) || /(color|primary|accent|surface|background|bg|text|foreground|border)/.test(lower)) {
    if (/primary|brand|main/.test(lower)) return "colors.primary";
    if (/accent|secondary|warning|danger|error/.test(lower)) return "colors.accent";
    if (/surface-container|container|card|panel/.test(lower)) return "colors.surfaceContainer";
    if (/surface|background|bg/.test(lower)) return "colors.surface";
    if (/on-surface|text|foreground|content/.test(lower)) return "colors.onSurface";
    if (/border|stroke|line/.test(lower)) return "colors.border";
    return `colors.${name.replace(/^color-?/, "").replace(/[^a-zA-Z0-9]+/g, "-")}`;
  }
  if (/(radius|rounded|round)/.test(lower)) return /full|pill|circle/.test(lower) ? "rounded.full" : "rounded.md";
  if (/(space|spacing|gap|padding|margin)/.test(lower)) return `spacing.${spacingNameFromValue(value)}`;
  if (/(font-size|text-size|typography)/.test(lower)) return `typography.${lower.includes("body") ? "body" : "headline"}.fontSize`;
  return null;
}

function spacingNameFromValue(value) {
  const numeric = Number(String(value).match(/\d+(?:\.\d+)?/)?.[0] || 0);
  if (numeric <= 8) return "sm";
  if (numeric <= 16) return "md";
  if (numeric <= 24) return "lg";
  if (numeric <= 32) return "xl";
  return "xxl";
}

function scanFile(root, file, buckets, cssVariables) {
  const rel = path.relative(root, file);
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  if (text.length > 800000) return;

  const variableRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;{}\n]+)\s*;/g;
  for (const match of text.matchAll(variableRegex)) {
    const name = match[1];
    const rawValue = match[2].trim();
    const tokenPath = tokenPathFromCssVar(name, rawValue);
    if (tokenPath) {
      cssVariables.push({ tokenPath, name, rawValue, source: `${rel}:--${name}` });
    }
  }

  for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    addCount(buckets.colors, normalizeColor(match[0]), rel);
  }

  for (const match of text.matchAll(/font-size\s*[:=]\s*["']?(\d+(?:\.\d+)?(?:px|rem))["']?/gi)) {
    addCount(buckets.fontSizes, match[1], rel);
  }

  for (const match of text.matchAll(/(?:border-radius|rounded)\s*[:=]\s*["']?(\d+(?:\.\d+)?(?:px|rem)|999px|50%)["']?/gi)) {
    addCount(buckets.radii, match[1] === "50%" ? "999px" : match[1], rel);
  }

  for (const match of text.matchAll(/(?:gap|padding|margin|space)\s*[:=]\s*["']?(\d+(?:\.\d+)?(?:px|rem))["']?/gi)) {
    addCount(buckets.spacing, match[1], rel);
  }
}

function chooseFirst(items, predicate) {
  return items.find(predicate)?.rawValue;
}

function chooseDesignTokens(buckets, cssVariables) {
  const byPath = new Map();
  for (const variable of cssVariables) {
    if (!byPath.has(variable.tokenPath)) byPath.set(variable.tokenPath, variable);
  }

  const colorValues = toArray(buckets.colors);
  const fontValues = toArray(buckets.fontSizes);
  const radiusValues = toArray(buckets.radii);
  const spacingValues = toArray(buckets.spacing);

  const colors = {};
  const colorPaths = ["colors.primary", "colors.accent", "colors.surface", "colors.surfaceContainer", "colors.onSurface", "colors.border"];
  for (const tokenPath of colorPaths) {
    if (byPath.has(tokenPath)) colors[tokenPath.split(".")[1]] = normalizeColor(byPath.get(tokenPath).rawValue);
  }
  if (!colors.primary && colorValues[0]) colors.primary = colorValues[0].value;
  if (!colors.accent && colorValues[1]) colors.accent = colorValues[1].value;
  if (!colors.surface && colorValues.find((item) => ["#F9F9F8", "#FAFAFA", "#F8F9FA", "#F5F5F5", "#FFFFFF"].includes(item.value))) {
    colors.surface = colorValues.find((item) => ["#F9F9F8", "#FAFAFA", "#F8F9FA", "#F5F5F5", "#FFFFFF"].includes(item.value)).value;
  }
  if (!colors.surfaceContainer && colorValues.find((item) => item.value === "#FFFFFF")) colors.surfaceContainer = "#FFFFFF";
  if (!colors.border && colorValues.find((item) => /#(D|E|C)/i.test(item.value.slice(1, 2)))) {
    colors.border = colorValues.find((item) => /#(D|E|C)/i.test(item.value.slice(1, 2))).value;
  }

  const typography = {};
  const numericFontSizes = fontValues
    .map((item) => ({ ...item, px: cssLengthToPx(item.value) }))
    .filter((item) => item.px > 0)
    .sort((a, b) => b.count - a.count);
  const body = numericFontSizes.find((item) => item.px >= 13 && item.px <= 16) || numericFontSizes[0];
  const headline = [...numericFontSizes].sort((a, b) => b.px - a.px).find((item) => item.px >= 20) || numericFontSizes[0];
  if (headline) typography.headline = { fontSize: toPx(headline.value), fontWeight: 700 };
  if (body) typography.body = { fontSize: toPx(body.value), lineHeight: 1.5 };

  const spacing = {};
  const spacingSorted = spacingValues.map((item) => toPx(item.value)).filter(Boolean);
  const uniqueSpacing = [...new Set(spacingSorted)].slice(0, 8);
  if (uniqueSpacing[0]) spacing.sm = uniqueSpacing.find((item) => item >= 6 && item <= 10) || uniqueSpacing[0];
  if (uniqueSpacing[0]) spacing.md = uniqueSpacing.find((item) => item >= 14 && item <= 18) || uniqueSpacing[1] || uniqueSpacing[0];
  if (uniqueSpacing[0]) spacing.lg = uniqueSpacing.find((item) => item >= 22 && item <= 28) || uniqueSpacing[2] || uniqueSpacing[0];

  const rounded = {};
  const radius = radiusValues[0]?.value;
  if (radius) rounded.md = toPx(radius);
  if (radiusValues.find((item) => item.value === "999px")) rounded.full = "999px";

  const components = {};
  if (colors.primary && rounded.md) {
    components.buttonPrimary = {
      backgroundColor: "{colors.primary}",
      textColor: "#ffffff",
      borderRadius: "{rounded.md}",
    };
  }
  if (colors.surfaceContainer || colors.border || rounded.md) {
    components.cardDefault = {
      backgroundColor: colors.surfaceContainer ? "{colors.surfaceContainer}" : "#ffffff",
      borderColor: colors.border ? "{colors.border}" : "#e5e7eb",
      borderRadius: rounded.md ? "{rounded.md}" : "8px",
    };
  }
  if (spacing.md || rounded.md) {
    components.filterPanel = {
      gap: spacing.md ? "{spacing.md}" : "16px",
      borderRadius: rounded.md ? "{rounded.md}" : "8px",
    };
  }

  return { colors, typography, spacing, rounded, components, byPath, summaries: { colorValues, fontValues, radiusValues, spacingValues } };
}

function cssLengthToPx(value) {
  const match = String(value).match(/(\d+(?:\.\d+)?)(px|rem)?/);
  if (!match) return 0;
  return Math.round(Number(match[1]) * (match[2] === "rem" ? 16 : 1));
}

function toPx(value) {
  return `${cssLengthToPx(value)}px`;
}

function yamlValue(value, indent = 2) {
  const space = " ".repeat(indent);
  if (value == null) return "{}";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const lines = [];
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        lines.push(`${space}${key}:`);
        const nested = yamlValue(child, indent + 2);
        lines.push(nested);
      } else {
        lines.push(`${space}${key}: ${yamlValue(child, 0)}`);
      }
    }
    return lines.join("\n");
  }
  return JSON.stringify(value);
}

function targetMeta(target) {
  if (target === "pc") {
    return {
      draftFile: "DESIGN_PC.draft.md",
      evidenceFile: "evidence.pc.json",
      evidenceMdFile: "evidence.pc.md",
      name: "PC/Web 端视觉系统",
      displayTitle: "PC/Web 端视觉差异设计规范 (PC/Web Visual Rules)",
      description: "PC/Web 端视觉差异规范",
      rules: [
        "先读取 `docs/design/DESIGN.md`，再读取本文件。",
        "本文件只记录 PC/Web 端布局密度、表格、筛选区、弹窗和 hover/focus 差异。",
        "不要重复完整品牌色、字体家族和基础 token。",
      ],
      introTitle: "PC/Web 端视觉差异 (PC/Web Visual Rules)",
      introBody: "本文件记录 PC/Web 端相对共用 `DESIGN.md` 的视觉差异，重点约束布局密度、筛选区、表格、弹窗和鼠标交互状态。",
    };
  }
  if (target === "mobile") {
    return {
      draftFile: "DESIGN_MOBILE.draft.md",
      evidenceFile: "evidence.mobile.json",
      evidenceMdFile: "evidence.mobile.md",
      name: "移动端视觉系统",
      displayTitle: "移动端视觉差异设计规范 (Mobile Visual Rules)",
      description: "移动端/H5/小程序视觉差异规范",
      rules: [
        "先读取 `docs/design/DESIGN.md`，再读取本文件。",
        "本文件只记录移动端安全区、底部导航、触控热区、卡片纵向布局和移动端弹层差异。",
        "不要重复完整品牌色、字体家族和基础 token。",
      ],
      introTitle: "移动端视觉差异 (Mobile Visual Rules)",
      introBody: "本文件记录移动端、H5 或小程序相对共用 `DESIGN.md` 的视觉差异，重点约束安全区、触控热区、底部导航、卡片纵向布局和移动端弹层。",
    };
  }
  return {
    draftFile: "DESIGN.draft.md",
    evidenceFile: "evidence.json",
    evidenceMdFile: "evidence.md",
    name: "项目视觉系统",
    displayTitle: "项目视觉系统设计规范 (Design System)",
    description: "项目视觉系统精简规范",
    rules: [
      "不新增未登记颜色、字号、圆角、阴影和间距。",
      "长尾业务组件复用基础 token 推导，不写入 DESIGN.md。",
      "复杂设计解释见 `docs/design/DESIGN.full.md`，默认不要读取。",
    ],
    introTitle: "品牌理念与核心视觉 (Brand Essence)",
    introBody: "本规范用于约束 AI 后续生成或修改页面时的基础视觉风格。YAML 区域提供机器可读 token，Markdown 区域提供中文可读说明，便于产品、设计和研发共同 review。",
  };
}

const COLOR_LABELS = {
  primary: "主色 (Primary)",
  accent: "辅助色/强调色 (Secondary / Accent)",
  tertiary: "强调色 (Tertiary)",
  surface: "背景色 (Surface)",
  surfaceContainer: "容器背景 (Surface Container)",
  onSurface: "文字主色 (On Surface)",
  onSurfaceVariant: "文字次色 (On Surface Variant)",
  border: "边框色 (Border)",
};

const TYPOGRAPHY_LABELS = {
  display: "展示标题 (Display)",
  headline: "模块标题 (Headline)",
  title: "卡片标题 (Title)",
  body: "正文 (Body)",
  label: "标签文字 (Label)",
};

const SPACING_LABELS = {
  xs: "超小间距 (Extra Small)",
  sm: "小间距 (Small)",
  md: "中间距 (Medium)",
  lg: "大间距 (Large)",
  xl: "超大间距 (Extra Large)",
  xxl: "特大间距 (Double Extra Large)",
};

const ROUNDED_LABELS = {
  sm: "小圆角 (Small Radius)",
  md: "默认圆角 (Default Radius)",
  lg: "大圆角 (Large Radius)",
  full: "全圆角/胶囊 (Full / Pill Radius)",
};

const COMPONENT_LABELS = {
  buttonPrimary: "主按钮 (Primary Button)",
  buttonSecondary: "次按钮 (Secondary Button)",
  cardDefault: "默认卡片 (Default Card)",
  filterPanel: "筛选面板 (Filter Panel)",
  tableDense: "紧凑表格 (Dense Table)",
  inputDefault: "默认输入框 (Default Input)",
  statusTag: "状态标签 (Status Tag)",
  modalDefault: "默认弹窗 (Default Modal)",
};

function labelFor(map, key) {
  return map[key] || `${key} (${key})`;
}

const PROPERTY_LABELS = {
  backgroundColor: "背景色",
  textColor: "文字色",
  borderColor: "边框色",
  borderRadius: "圆角",
  fontSize: "字号",
  fontWeight: "字重",
  lineHeight: "行高",
  gap: "间距",
  paddingX: "水平内边距",
  paddingY: "垂直内边距",
  rowHeight: "行高",
};

function formatObjectValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).map(([key, child]) => `${PROPERTY_LABELS[key] || key}: ${child}`).join(" / ");
  }
  return String(value);
}

function renderColorSection(colors) {
  const entries = Object.entries(colors || {});
  if (!entries.length) return "";
  const lines = entries.map(([key, value]) => `- **${labelFor(COLOR_LABELS, key)}:** \`${value}\``);
  return `## 2. 色彩系统 (Color System)\n\n${lines.join("\n")}\n`;
}

function renderTypographySection(typography) {
  const entries = Object.entries(typography || {});
  if (!entries.length) return "";
  const lines = entries.map(([key, value]) => `- **${labelFor(TYPOGRAPHY_LABELS, key)}:** ${formatObjectValue(value)}`);
  return `## 3. 排版系统 (Typography)\n\n${lines.join("\n")}\n`;
}

function renderSpacingRoundedSection(spacing, rounded) {
  const spacingLines = Object.entries(spacing || {}).map(([key, value]) => `- **${labelFor(SPACING_LABELS, key)}:** \`${value}\``);
  const roundedLines = Object.entries(rounded || {}).map(([key, value]) => `- **${labelFor(ROUNDED_LABELS, key)}:** \`${value}\``);
  if (!spacingLines.length && !roundedLines.length) return "";
  const parts = ["## 4. 间距与圆角 (Spacing & Roundness)", ""];
  if (spacingLines.length) parts.push("### 4.1 间距 (Spacing)", "", spacingLines.join("\n"), "");
  if (roundedLines.length) parts.push("### 4.2 圆角 (Roundness)", "", roundedLines.join("\n"), "");
  return parts.join("\n").trimEnd() + "\n";
}

function renderComponentSection(components) {
  const entries = Object.entries(components || {});
  if (!entries.length) return "";
  const lines = entries.map(([key, value]) => {
    return `- **${labelFor(COMPONENT_LABELS, key)}:** ${formatObjectValue(value)}`;
  });
  return `## 5. 组件规范 (Component Guidelines)\n\n${lines.join("\n")}\n`;
}

function renderDesignDraft(tokens, target) {
  const meta = targetMeta(target);
  const ruleLines = meta.rules.map((rule) => `- ${rule}`).join("\n");
  const sections = [
    `# ${meta.displayTitle} (DESIGN.md)`,
    "",
    `## 1. ${meta.introTitle}`,
    "",
    meta.introBody,
    "",
    renderColorSection(tokens.colors),
    renderTypographySection(tokens.typography),
    renderSpacingRoundedSection(tokens.spacing, tokens.rounded),
    renderComponentSection(tokens.components),
    "## 6. 使用规则 (Usage Rules)",
    "",
    ruleLines,
    "",
  ].filter(Boolean).join("\n\n");
  return `---\nversion: alpha\nname: ${meta.name}\ndescription: ${meta.description}\ncolors:\n${yamlValue(tokens.colors, 2) || "  {}"}\ntypography:\n${yamlValue(tokens.typography, 2) || "  {}"}\nspacing:\n${yamlValue(tokens.spacing, 2) || "  {}"}\nrounded:\n${yamlValue(tokens.rounded, 2) || "  {}"}\ncomponents:\n${yamlValue(tokens.components, 2) || "  {}"}\n---\n\n${sections}`;
}

function flattenTokens(group, prefix, evidence, sourceLookup) {
  for (const [key, value] of Object.entries(group || {})) {
    const currentPath = `${prefix}.${key}`;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenTokens(value, currentPath, evidence, sourceLookup);
      continue;
    }
    const source = sourceLookup.get(currentPath);
    evidence.push({
      path: currentPath,
      rawValue: String(value),
      normalizedValue: String(value),
      confidence: source ? "exact" : "computed",
      source: source?.source || "code-static-scan",
      normalization: "none",
      notes: source ? `来自 CSS variable --${source.name}` : "来自项目代码静态扫描",
    });
  }
}

function renderEvidenceMd(evidence) {
  const rows = evidence.tokens.slice(0, 80).map((token) => {
    return `| ${token.path} | ${token.normalizedValue} | ${token.confidence} | ${token.source} |`;
  });
  return `# 设计证据摘要\n\n| Token | Value | Confidence | Source |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n`;
}

function run() {
  const args = parseArgs(process.argv);
  const meta = targetMeta(args.target);
  ensureDir(args.out);
  ensureWorkIgnore(args.root);

  const buckets = { colors: new Map(), fontSizes: new Map(), radii: new Map(), spacing: new Map() };
  const cssVariables = [];
  const files = listFiles(args.root);
  for (const file of files) scanFile(args.root, file, buckets, cssVariables);

  const selected = chooseDesignTokens(buckets, cssVariables);
  const evidenceTokens = [];
  flattenTokens(selected.colors, "colors", evidenceTokens, selected.byPath);
  flattenTokens(selected.typography, "typography", evidenceTokens, selected.byPath);
  flattenTokens(selected.spacing, "spacing", evidenceTokens, selected.byPath);
  flattenTokens(selected.rounded, "rounded", evidenceTokens, selected.byPath);
  flattenTokens(selected.components, "components", evidenceTokens, new Map());

  const evidence = {
    schemaVersion: "design-skill-suite/v0.1",
    generatedAt: new Date().toISOString(),
    projectRoot: args.root,
    target: args.target,
    scannedFiles: files.length,
    tokens: evidenceTokens,
    summaries: selected.summaries,
  };

  fs.writeFileSync(path.join(args.out, meta.draftFile), renderDesignDraft(selected, args.target), "utf8");
  fs.writeFileSync(path.join(args.out, meta.evidenceFile), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(args.out, meta.evidenceMdFile), renderEvidenceMd(evidence), "utf8");

  console.log("已生成:");
  console.log(`- ${path.relative(args.root, path.join(args.out, meta.draftFile))}`);
  console.log(`- ${path.relative(args.root, path.join(args.out, meta.evidenceFile))}`);
  console.log(`- ${path.relative(args.root, path.join(args.out, meta.evidenceMdFile))}`);
  console.log(`请 review ${meta.draftFile} 后再确认写入正式 DESIGN 文件。`);
}

run();
