# DESIGN.md 写作规则

`DESIGN.md` 是 AI 高频读取的视觉规范索引，不是设计系统百科。

默认只维护一份共用 `DESIGN.md`。当项目同时包含 PC/Web 和移动端/H5/小程序，才按需增加 `DESIGN_PC.md` 和 `DESIGN_MOBILE.md`。

## 推荐结构

```md
---
version: alpha
name: 项目视觉系统
description: 项目视觉系统精简规范
colors:
  primary: "#2d5a27"
  accent: "#d14d33"
  surface: "#f9f9f8"
  surfaceContainer: "#ffffff"
  onSurface: "#1a1c1a"
  border: "#dadad9"
typography:
  headline:
    fontSize: "24px"
    fontWeight: 700
  body:
    fontSize: "14px"
    lineHeight: 1.5
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
rounded:
  md: "8px"
  full: "999px"
components:
  buttonPrimary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    borderRadius: "{rounded.md}"
  cardDefault:
    backgroundColor: "{colors.surfaceContainer}"
    borderColor: "{colors.border}"
    borderRadius: "{rounded.md}"
---

# 项目视觉系统设计规范 (Design System)

## 1. 品牌理念与核心视觉 (Brand Essence)

本规范用于约束 AI 后续生成或修改页面时的基础视觉风格。YAML 区域提供机器可读 token，Markdown 区域提供中文可读说明。

## 2. 色彩系统 (Color System)

- **主色 (Primary):** `#2d5a27`
- **辅助色/强调色 (Secondary / Accent):** `#d14d33`
- **背景色 (Surface):** `#f9f9f8`

## 3. 排版系统 (Typography)

- **模块标题 (Headline):** fontSize: 24px / fontWeight: 700
- **正文 (Body):** fontSize: 14px / lineHeight: 1.5

## 4. 间距与圆角 (Spacing & Roundness)

- **中间距 (Medium Spacing):** `16px`
- **默认圆角 (Default Radius):** `8px`

## 5. 组件规范 (Component Guidelines)

- **主按钮 (Primary Button):** 使用 primary 背景、白色文字和默认圆角。
- **默认卡片 (Default Card):** 使用 surfaceContainer 背景、border 边框和默认圆角。

## 6. 使用规则 (Usage Rules)

- 不新增未登记颜色、字号、圆角、阴影和间距。
- 长尾业务组件复用基础 token 推导，不写入 DESIGN.md。
- 复杂设计解释见 `docs/design/DESIGN.full.md`，默认不要读取。
```

## 控制规则

- `DESIGN.md` 控制在 100-200 行内。
- YAML 放机器可读 token，Markdown 放少量硬规则。
- Markdown 标题和标签使用中文为主、英文括号辅助，例如 `色彩系统 (Color System)`、`主色 (Primary)`。
- `components` 最多 5-8 个抽象组件。
- 证据、截图分析、完整品牌说明放到 `evidence.json`、`evidence.md` 或 `DESIGN.full.md`。
- 不要把业务长尾组件写进 `DESIGN.md`。
- `DESIGN.md` 不承载所有页面模式；同类型已实现页面可作为布局、密度、组件组合和交互模式参考。
- 同类型页面参考必须克制：最多列出 3 个候选，选择 1 个主参考页，优先读 `brief.md`、`spec.md`、页面入口和组件引用摘要，不要读取大文件全文。

## 端差异文件

`DESIGN_PC.md` 只写 PC/Web 端差异：

- 页面最大宽度、左右布局、侧边栏/顶部导航。
- 表格密度、筛选区排布、弹窗宽度。
- hover/focus 状态。

`DESIGN_MOBILE.md` 只写移动端差异：

- 安全区、底部导航、触控热区。
- 卡片纵向布局、移动端 drawer/弹层。
- 按钮高度、字号下限、列表密度。

端差异文件不要重复完整品牌色和全部 typography。默认先读取 `DESIGN.md`，再读取对应端差异文件。
