# MyFishPond 鱼文件格式 V1

鱼不是绑定在场景里的 PNG，而是一份包含鱼种和外观数据的独立档案。当前版本用 `myfishpond.fish` JSON 格式描述一条鱼，文件扩展名为 `.mfp-fish.json`。

## 生成与指定

- 自动生成：指定鱼种与随机种子，生成器会选择适配该鱼种的花型，并为色块计算位置、形状比例和颜色。
- 指定花型：可在生成时选择 `kohaku`、`sanke`、`bekko`、`tancho`、`calico`、`sakura` 或 `gold-white`。
- 精确编辑：档案同时保存生成器版本、种子以及生成后的花纹色块坐标；之后即使生成算法升级，现有鱼文件仍能还原原花纹。

锦鲤支持 `kohaku`（红白）、`sanke`（红白墨）、`bekko`（白底墨斑）、`tancho`（头部红斑）；金鱼支持 `calico`（三色）、`sakura`（樱花色）和 `gold-white`（金白）。

## 文件示例

```json
{
  "format": "myfishpond.fish",
  "version": 1,
  "id": "koi-00067932",
  "name": "池边朱白",
  "species": "koi",
  "appearance": {
    "generatorVersion": 1,
    "seed": 424242,
    "pattern": "kohaku",
    "tint": 16777215,
    "markings": [
      { "x": 0.3, "y": -0.1, "rx": 0.2, "ry": 0.44, "color": 15110577, "alpha": 0.92 }
    ]
  }
}
```

文件读写入口位于 `web/src/core/fish/FishPattern.ts`：`createFishDefinition`、`serializeFishFile`、`parseFishFile`、`readFishFile` 和 `downloadFishFile`。导入会先验证版本、鱼种、花型、颜色和坐标范围，防止无效数据进入场景。
