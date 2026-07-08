# inferred token 归一化规则

截图和视觉模型提取的数值容易漂移，不能直接进入正式规范。

## spacing

吸附到 4px 网格，常用值优先：

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

## radius

吸附到常用阶梯：

```text
2, 4, 6, 8, 12, 16, 24, 999
```

## font-size

吸附到常用字号：

```text
12, 14, 16, 18, 20, 24, 28, 32, 40
```

## color

近似色聚类，避免同一颜色出现多个相近 token。只有来源为 CSS variable、明确 token 或用户确认时，才升级到 `exact` 或 `user-confirmed`。

## shadow

优先写模式描述，例如 `none`、`sm`、`md`，不要轻易从截图推断精确阴影参数。
