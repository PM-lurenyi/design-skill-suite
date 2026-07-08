---
name: design-md-extract
description: 从项目 CSS、Tailwind/组件代码、已有页面、截图证据或用户描述中提炼轻量 DESIGN.md 视觉规范草案。Use when 用户要求生成、更新、提炼、沉淀 DESIGN.md、DESIGN.draft.md、evidence.json，或把已有页面风格转成 AI 可读取的设计系统；默认只生成草稿和证据，不直接覆盖正式 DESIGN.md。
---

# DESIGN.md 提炼

## 核心定位

把当前项目中的视觉来源提炼为：

- `docs/design/DESIGN.draft.md`
- `docs/design/evidence.json`
- `docs/design/evidence.md`

不要直接覆盖 `docs/design/DESIGN.md`，除非用户明确确认草稿可以转正。

## 默认执行

1. 先检查当前项目是否已有 `docs/design/DESIGN.md`、`DESIGN.draft.md` 或样式配置。
2. 优先读取项目 CSS、Tailwind 配置、组件文件和页面实现。
3. 如用户提供截图或视觉描述，将它们作为 `inferred` 来源。
4. 生成草稿规范和证据文件。
5. 首次创建 `work/` 时同步创建 `work/.gitignore`，防止临时截图和中间结果入库。

## 推荐脚本

从项目代码提炼 token：

```bash
node .agents/skills/design-md-extract/scripts/extract-css-tokens.mjs --root .
```

提炼 PC/Web 端差异草稿：

```bash
node .agents/skills/design-md-extract/scripts/extract-css-tokens.mjs --root . --target pc
```

提炼移动端/H5/小程序端差异草稿：

```bash
node .agents/skills/design-md-extract/scripts/extract-css-tokens.mjs --root . --target mobile
```

归一化已有证据中的 `inferred` 值：

```bash
node .agents/skills/design-md-extract/scripts/normalize-inferred-tokens.mjs docs/design/evidence.json
```

## DESIGN.md 轻量约束

正式高频读取文件 `docs/design/DESIGN.md` 必须保持短小：

- 控制在 100-200 行内。
- 使用 YAML front matter 存机器可读 token。
- Markdown 必须中文主导、英文括号辅助，禁止生成纯英文正文。
- Markdown 标题、说明和组件属性必须优先使用中文，例如 `色彩系统 (Color System)`、`主色 (Primary)`、`背景色`、`文字色`、`圆角`。
- Markdown 只保留少量硬规则和可读说明。
- 不写长篇品牌故事、截图推断过程或完整组件说明。
- 复杂说明放入 `docs/design/DESIGN.full.md`。

默认只生成共用 `DESIGN.draft.md`。只有当用户明确区分端类型，才生成端差异草稿：

- PC/Web：`docs/design/DESIGN_PC.draft.md`、`docs/design/evidence.pc.json`
- 移动端/H5/小程序：`docs/design/DESIGN_MOBILE.draft.md`、`docs/design/evidence.mobile.json`

共用 `DESIGN.md` 放品牌色、字体家族、基础字号、基础 spacing/radius 和抽象组件原则；端差异文件只放布局密度、页面边距、导航、触控/hover、表格/卡片排布等差异。

参考写法见 `references/design-md-authoring.md`。

## components 节点规则

`components` 只放 5-8 个抽象高频组件，例如：

- `buttonPrimary`
- `buttonSecondary`
- `cardDefault`
- `filterPanel`
- `tableDense`
- `inputDefault`
- `statusTag`
- `modalDefault`

不要写业务长尾组件，例如：

- `supplierSearchResultCard`
- `contractHistoryMatchPanel`
- `synonymRecallBadge`
- `settlementExceptionDrawer`

长尾业务组件写入页面 `brief.md`、`spec.md` 或 PRD，而不是 `DESIGN.md`。

## 证据规则

每个 token 必须写入 `evidence.json`，字段规则见 `references/evidence-schema.md`。

可信度：

- `exact`：来自明确 token、CSS variable 或已有 DESIGN.md。
- `computed`：来自项目样式扫描或网页 computed style。
- `inferred`：来自截图、视觉模型或口头描述推断。
- `user-confirmed`：用户确认后升级。

`inferred` 值必须归一化，规则见 `references/normalization-rules.md`。

## 输出要求

对话中只输出文件路径和需要确认的少量关键点。详细分析写入文件。

完成后回复示例：

```text
已生成：
- docs/design/DESIGN.draft.md
- docs/design/evidence.json
- docs/design/evidence.md

需要确认：
- primary 使用 #2d5a27
- rounded.md 归一化为 8px
```
