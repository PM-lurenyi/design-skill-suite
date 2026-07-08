# evidence.json 结构

`evidence.json` 用来证明 token 从哪里来，避免把截图推断伪装成确定规范。

## 顶层结构

```json
{
  "schemaVersion": "design-skill-suite/v0.1",
  "generatedAt": "2026-07-05T00:00:00.000Z",
  "projectRoot": "/absolute/project/root",
  "tokens": []
}
```

## token 字段

```json
{
  "path": "colors.primary",
  "rawValue": "#2d5a27",
  "normalizedValue": "#2d5a27",
  "confidence": "exact",
  "source": "css-variable:--color-primary",
  "normalization": "none",
  "notes": "来自项目 CSS variable"
}
```

字段说明：

- `path`：token 路径，例如 `colors.primary`、`rounded.md`。
- `rawValue`：原始采集值。
- `normalizedValue`：进入草稿规范的值。
- `confidence`：`exact`、`computed`、`inferred`、`user-confirmed`。
- `source`：来源，例如 CSS 变量、文件路径、截图区域。
- `normalization`：归一化方式。
- `notes`：简短说明。

## 可信度

- `exact`：来自明确 token、CSS variable 或已有 DESIGN.md。
- `computed`：来自项目样式扫描或网页 computed style。
- `inferred`：来自截图、视觉模型或口头描述。
- `user-confirmed`：用户确认后升级。
