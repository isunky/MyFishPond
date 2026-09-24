# MyFishPond 鱼类动画素材 V1

## 素材

| 鱼种 | 素材 | 画布 | 通道 |
|---|---|---:|---|
| 锦鲤 | `web/public/images/koi-swim-sheet-v2.png` | 1774 × 887 | RGBA 透明 |
| 金鱼 | `web/public/images/goldfish-swim-sheet-v2.png` | 1774 × 887 | RGBA 透明 |

每张图由 3 列 × 3 行单元格组成，按从左到右、从上到下读取前 8 格，第 9 格保留不用。单元格约 591 × 296 像素，鱼头朝右，运行时由鱼实体旋转到游动方向。

## 播放

- PixiJS `AnimatedSprite` 负责逐帧播放；每条鱼随机选起始帧，鱼群不会同步摆尾。
- 动画由场景 ticker 驱动，鱼塘暂停、窗口隐藏和质量档位沿用现有 ticker 生命周期。
- 循环以尾柄和尾鳍摆动为主，鱼头、身体比例与花纹保持稳定；花纹层叠加在动画帧上，继续使用版本化鱼外观档案。
- 降低播放速度或扩充鱼种时，只需调整 `FishEntity` 的 `animationSpeed`，并按相同透明 Atlas 约定提供新素材。

素材由 ImageGen 根据项目现有鱼种插画生成。帧边界从 3 × 3 Atlas 读取，不需要导出 8 个独立文件。
