---
version: alpha
name: 项目视觉系统
description: 项目视觉系统精简规范
colors: {}
typography: {}
spacing: {}
rounded: {}
components: {}
---

# 项目视觉系统设计规范 (Design System)

## 1. 品牌理念与核心视觉 (Brand Essence)

本规范用于约束 AI 后续生成或修改页面时的基础视觉风格。YAML 区域提供机器可读 token，Markdown 区域提供中文可读说明。

## 2. 色彩系统 (Color System)

- **主色 (Primary):** 补充项目核心操作色。
- **辅助色/强调色 (Secondary / Accent):** 补充告警、强调或转化色。
- **背景色 (Surface):** 补充页面基础背景。

## 3. 排版系统 (Typography)

- **模块标题 (Headline):** 补充字号、字重、行高。
- **正文 (Body):** 补充默认正文字号与行高。

## 4. 间距与圆角 (Spacing & Roundness)

- **基础间距 (Spacing):** 使用 4px/8px 网格。
- **默认圆角 (Default Radius):** 补充按钮、卡片、输入框的默认圆角。

## 5. 组件规范 (Component Guidelines)

- **主按钮 (Primary Button):** 使用主色、白色文字和默认圆角。
- **默认卡片 (Default Card):** 使用容器背景、边框色和默认圆角。

## 6. 使用规则 (Usage Rules)

- 不新增未登记颜色、字号、圆角、阴影和间距。
- 长尾业务组件复用基础 token 推导，不写入 DESIGN.md。
- 复杂设计解释见 `docs/design/DESIGN.full.md`，默认不要读取。
