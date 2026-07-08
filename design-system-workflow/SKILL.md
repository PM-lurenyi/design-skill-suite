---
name: design-system-workflow
description: 视觉设计系统工作流入口。Use when 用户要求从已有页面、截图、CSS、项目代码或口头描述中提炼 DESIGN.md，确认或接入项目视觉规范，更新 AGENTS.md 视觉约束，或检查 AI 生成页面是否偏离项目设计系统；负责路由到 design-md-extract 和 design-system-review，并保持对话输出简洁。
---

# 设计系统工作流

## 核心定位

本 Skill 是 Design Skill Suite 的入口，不直接承担所有细节工作，而是判断用户意图、选择流程，并把产物落到当前项目中。

目标链路：

```text
视觉来源 -> DESIGN.draft.md -> evidence.json -> 人工确认 -> DESIGN.md -> AGENTS.md 接入 -> review-report.md 审查
```

默认只维护一份共用 `docs/design/DESIGN.md`。当项目同时存在 PC/Web 与移动端/H5/小程序体验，才按需增加：

- `docs/design/DESIGN_PC.md`
- `docs/design/DESIGN_MOBILE.md`

原则：品牌基因共用，布局、密度和交互按端拆分。

## 静默执行规则

执行提炼、比对、审查时，默认只在对话中输出：

- 生成或更新了哪些文件。
- 需要用户确认的关键 token 或风险点。
- P0/P1 阻断问题摘要。

不要在对话中长篇解释中间推理、逐项视觉分析或脚本扫描细节。详细证据必须写入 `docs/design/evidence.json`、`docs/design/evidence.md` 或 `docs/design/review-report.md`。

## 意图路由

### 提炼视觉规范

用户说“提炼视觉规范”“沉淀 DESIGN.md”“从页面/截图/CSS 提取设计系统”时：

1. 调用或指导使用 `$design-md-extract`。
2. 优先从项目样式、组件代码、已有页面文件中提取。
3. 只生成 `docs/design/DESIGN.draft.md`，不要直接覆盖 `docs/design/DESIGN.md`。
4. 生成 `docs/design/evidence.json` 和 `docs/design/evidence.md`。
5. 首次创建 `work/` 时必须创建 `work/.gitignore`，内容为：

```gitignore
*
!.gitignore
```

如果用户明确说“PC 端”“Web 端”“桌面端”，使用：

```bash
node .agents/skills/design-md-extract/scripts/extract-css-tokens.mjs --root . --target pc
```

如果用户明确说“移动端”“H5”“小程序”“APP”，使用：

```bash
node .agents/skills/design-md-extract/scripts/extract-css-tokens.mjs --root . --target mobile
```

### 确认并接入规范

用户确认 `DESIGN.draft.md` 后：

1. 将精简后的规范写入 `docs/design/DESIGN.md`。
2. 如存在长篇品牌理念、完整组件说明或内容原则，写入 `docs/design/DESIGN.full.md`。
3. 更新或建议更新项目根目录 `AGENTS.md`，追加“Visual Design Rules”。

`DESIGN.md` 必须是高频读取文件，控制在 100-200 行内。证据、截图分析、推导过程、完整设计作文不要写入 `DESIGN.md`。

接入规则时必须加入克制的“同类型页面参考”要求：如果项目中已有同类型页面，AI 创建或编辑 UI 前应参考这些页面的布局结构、组件组合、信息密度和交互模式。`DESIGN.md` 负责视觉 token，同类型页面负责具体页面模式。

同类型页面参考必须控制上下文预算：

- 先用文件名、路由名、页面标题或业务对象检索候选。
- 最多列出 3 个候选页面，选择 1 个最相关页面作为主参考。
- 优先读取同目录 `brief.md`、`spec.md`、`README`、页面入口文件和组件引用关系。
- 不要把大段实现代码、完整 DOM 或完整样式文件塞进上下文；只提取布局区块、组件组合、密度、交互模式这类摘要。
- 如果没有明确同类型页面，不要扩大检索范围硬找，直接按 `DESIGN.md` 生成。

### 审查页面漂移

用户说“检查页面有没有跑偏”“审查设计规范”“检查颜色/圆角/字号是否一致”时：

1. 调用或指导使用 `$design-system-review`。
2. 读取 `docs/design/DESIGN.md`。
3. 输出 `docs/design/review-report.md`。
4. P0/P1 问题应在终端或最终回复中明确标注。

## AGENTS.md 视觉规则片段

确认接入时，追加或建议追加：

这段规则有两层：先读 `DESIGN.md` 保持视觉 token 统一，再用克制检索找同类型已实现页面，保持布局结构和组件组合一致。

```md
## Visual Design Rules

Before creating or editing UI:
- Read `docs/design/DESIGN.md`.
- For PC/Web pages, also read `docs/design/DESIGN_PC.md` if it exists.
- For mobile/H5/mini-program pages, also read `docs/design/DESIGN_MOBILE.md` if it exists.
- Search briefly for existing pages of the same type or business domain. List at most 3 candidates and use at most 1 primary reference page for layout, component composition, density, and interaction patterns.
- Prefer reading that reference page's `brief.md`, `spec.md`, page entry file, and component imports. Do not load large implementation files in full; summarize only the relevant layout and interaction patterns.
- Do not read `docs/design/evidence.json`, `docs/design/evidence.md`, `docs/design/DESIGN.full.md`, or `docs/design/review-report.md` unless validating or updating the design system.
- Use registered colors, typography, spacing, radius, and abstract component rules.
- Reuse existing page patterns and UI components before inventing new ones.
- Keep visual reference context smaller than product/business context; do not let design references crowd out requirements, state rules, permissions, or validation logic.
- Do not invent new colors, shadows, radii, typography scales, or spacing scales.
- Do not add long-tail business components to `DESIGN.md`; describe them in page `brief.md` or `spec.md`.
- If a needed visual pattern is missing, update `docs/design/DESIGN.draft.md` first and ask for confirmation.
```

## 语言规则

`DESIGN.draft.md`、`DESIGN.md`、`DESIGN.full.md` 的 Markdown 正文必须中文主导，英文只作为括号辅助。允许 YAML token key 使用英文以便机器读取，但 `name`、`description`、章节标题、组件说明、使用规则必须优先中文。不要生成纯英文设计规范。

## 产物边界

长期项目产物：

- `docs/design/DESIGN.md`
- `docs/design/DESIGN_PC.md`（可选）
- `docs/design/DESIGN_MOBILE.md`（可选）
- `docs/design/DESIGN.full.md`
- `docs/design/evidence.json`
- `docs/design/evidence.md`
- `docs/design/review-report.md`
- `AGENTS.md` 视觉规则

临时产物：

- `work/design-evidence/`
- `work/design-review/`

`work/` 默认不入库。

## 回复格式

提炼完成：

```text
已生成：
- docs/design/DESIGN.draft.md
- docs/design/evidence.json
- docs/design/evidence.md

需要确认：
- primary 色值 ...
- 默认圆角 ...
```

审查完成：

```text
Design review failed: 2 个 P1 问题。
详情见 docs/design/review-report.md
```
