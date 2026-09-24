# 后院鱼塘 MyFishPond 技术方案

> 文档版本：V1.2  
> 对应 PRD：《后院鱼塘 MyFishPond 产品需求文档》  
> 产品标识：MyFishPond  
> 首期平台：Windows 10 / Windows 11  
> 后续扩展：macOS  
> 核心技术：TypeScript + PixiJS + WebGL2  
> 核心目标：低功耗、长期稳定、Windows 优先、平台可扩展  
> 日期：2026-09-24

---

# 1. 技术目标

1. 采用 PixiJS + WebGL2 构建实时池塘渲染核心；
2. V1.x 优先完成 Windows 正式版本；
3. 标准模式默认 30 FPS，不盲目追求 60 FPS；
4. 优先控制 GPU 像素处理量、全屏 Shader 和渲染频率；
5. 鱼群 AI 与渲染帧率解耦，采用低频模拟；
6. 1080P、2K、4K、高 DPI 环境均可动态适配；
7. 桌面不可见、全屏应用等状态主动降载；
8. 核心渲染和业务逻辑不直接依赖 Windows API；
9. 后续 macOS 原则上复用同一套 Web 核心。

---

# 2. 技术路线结论

正式路线明确为：

```text
HTML 宿主页
    ↓
PixiJS
    ↓
WebGL2
    ↓
GPU 实时渲染
```

不采用以下路线作为正式实现：

```text
HTML Canvas 2D
ctx.drawImage(...)
ctx.fillRect(...)
```

Canvas 元素仅作为 PixiJS / WebGL 的渲染载体。

首期不依赖 WebGPU。未来可在兼容性成熟后作为可选增强后端评估。

---

# 3. 总体架构

```text
┌──────────────────────────────────────────────┐
│             MyFishPond Web Core             │
│                                              │
│ Scene / Fish / Boids / Water / FX           │
│ Interaction / Settings / Performance        │
└─────────────────────┬────────────────────────┘
                      │
             Platform Adapter API
                      │
               WindowsAdapter
                      │
            ┌──────────────────┐
            │   Windows Host   │
            │ Lively / 自研Host │
            └──────────────────┘

后续扩展：
Platform Adapter → MacAdapter → WKWebView Host
```

设计原则：

- Web Core 负责所有池塘核心能力；
- Windows Host 只负责平台生命周期和桌面能力；
- 平台层保持薄；
- 后续 macOS 通过新增 Adapter / Host 扩展，不修改大部分核心代码。

---

# 4. 推荐技术栈

## 4.1 Web Core

- TypeScript；
- Vite；
- PixiJS v8；
- WebGL2；
- GLSL；
- Texture Atlas；
- WebP / PNG Alpha 素材；
- JSON 配置。

## 4.2 Windows 首期宿主

首期建议两阶段：

### 阶段 A：开发与验证

优先通过 Lively Wallpaper Web Wallpaper 运行，快速验证：

- PixiJS 渲染；
- Windows 桌面效果；
- 全屏暂停；
- 多屏；
- 性能。

### 阶段 B：正式产品化

根据发行方式决定：

- 继续以 Lively 包形式发布；或
- 开发独立 Windows Host，形成独立 MyFishPond 应用。

如果目标是完整独立产品，建议最终采用自研轻量 Host，避免要求鱼塘主预先安装第三方动态壁纸平台。

## 4.3 macOS 后续技术路线

V1.0 不实施，仅保留：

- Swift / SwiftUI；
- AppKit；
- WKWebView；
- 原生 Desktop Window Host。

---

# 5. 工程目录建议

```text
my-fish-pond/
│
├─ web/
│  ├─ src/
│  │  ├─ core/
│  │  │  ├─ scene/
│  │  │  ├─ fish/
│  │  │  ├─ boids/
│  │  │  ├─ water/
│  │  │  ├─ particles/
│  │  │  ├─ interaction/
│  │  │  └─ performance/
│  │  │
│  │  ├─ platform/
│  │  │  ├─ PlatformAdapter.ts
│  │  │  ├─ WebAdapter.ts
│  │  │  ├─ WindowsAdapter.ts
│  │  │  └─ MacAdapter.ts          # 仅保留接口，首期不实现
│  │  │
│  │  ├─ config/
│  │  └─ main.ts
│  │
│  ├─ assets/
│  └─ dist/
│
├─ hosts/
│  ├─ windows/
│  └─ macos/                       # 后续
│
├─ docs/
└─ README.md
```

---

# 6. 场景渲染分层

```text
stage
├─ staticLayer
│  ├─ pondBottom
│  ├─ stones
│  └─ staticPlants
│
├─ dynamicDecorLayer
│  ├─ lotus
│  └─ grass
│
├─ fishLayer
│
├─ fxLayer
│  ├─ caustics
│  ├─ ripple
│  ├─ particles
│  └─ bubbles
│
└─ uiLayer
```

原则：

- 静态背景尽量离线合成或缓存；
- 动态对象保持独立；
- 避免过多 RenderGroup；
- 不为了“结构漂亮”增加无意义的 DisplayObject 层级。

---

# 7. 鱼类实体设计

## 7.1 单鱼结构

推荐：

```text
FishEntity
├─ simulation data
└─ AnimatedSprite
```

一条鱼尽量只对应一个主渲染对象。

避免：

```text
Fish Container
├─ body
├─ tail
├─ finLeft
├─ finRight
├─ shadow
├─ glow
└─ mask
```

鱼影、身体细节优先合入素材或 Atlas。

## 7.2 鱼动画

建议每种鱼采用 4～8 帧轻量摆尾动画。

动画速度可与移动速度关联：

```text
低速游动 → 慢摆尾
受惊加速 → 快摆尾
```

不采用复杂 2D 骨骼或 3D 骨骼动画作为 V1 方案。

---

# 8. Texture Atlas

鱼类所有动画帧优先合并到少量 Texture Atlas。

目标：

- 降低 Texture Bind；
- 提高 Pixi Batch 效率；
- 控制 Draw Call；
- 统一资源加载；
- 降低大量独立图片导致的运行开销。

静态植物、波纹和常用 FX 同样可分别建立 Atlas。

---

# 9. 鱼群与行为算法

## 9.1 基础运动

每条鱼维护：

- position；
- velocity；
- heading；
- targetHeading；
- baseSpeed；
- currentSpeed；
- turnRate；
- behaviorState。

采用平滑转向，不直接将 rotation 瞬间设置为新方向。

## 9.2 Boids

采用轻量：

- Separation；
- Alignment；
- Cohesion；
- Wander。

可调权重，不追求物理精确，优先视觉自然。

## 9.3 Spatial Grid

默认 24 条鱼时，即使 O(n²) 仍可运行，但为后续扩展建议直接建立轻量 Spatial Grid。

```text
屏幕划分为固定网格
→ 鱼加入当前 Cell
→ 只查询自己和周围 8 个 Cell
```

避免鱼数量增加后邻居查询成本快速增长。

## 9.4 更新频率

Boids 不按渲染 FPS 全速执行：

```text
节能：8 Hz
标准：12 Hz
高质量：20 Hz
```

中间帧根据最近一次计算结果平滑运动。

---

# 10. 行为状态机

状态：

- Wander；
- Cruise；
- School；
- Scared；
- Feed（后续）。

行为状态建议约 5 Hz 更新。

原则：

- 行为决策低频；
- 位置运动高频；
- 渲染频率独立；
- 避免所有鱼在同一帧同步决策。

---

# 11. 鼠标互动

鼠标事件只更新全局输入状态，不在 pointermove 事件中直接运行完整鱼群计算。

建议：

```text
pointermove
→ 保存 mouseX / mouseY / velocity

InteractionSystem（10～15 Hz）
→ 检查附近鱼
→ 触发 Scared 状态或 steering force
```

避免 60 FPS × 全鱼群持续执行复杂距离判断。

---

# 12. 水面渲染方案

## 12.1 原则

不做真实 Fluid Simulation。

采用：

- 预生成水光纹理；
- UV 缓慢滚动；
- 轻量 Noise；
- Ripple Sprite / Mesh；
- 最多一个主要全屏 Water Shader Pass。

## 12.2 Shader

尽量在单个 Fragment Shader 中合并：

- 轻微扰动；
- 水光；
- 小幅色彩变化。

避免：

```text
Displacement
→ Blur
→ Caustics Filter
→ Color Filter
→ 再 Blur
```

多个全屏 Pass 会比几十条鱼更容易成为 GPU 性能瓶颈。

---

# 13. 点击波纹

V1 优先采用轻量 Sprite / Mesh 动画，而不是动态流体。

生命周期：

```text
创建
→ scale 增大
→ alpha 降低
→ 回收到对象池
```

设置同时存在数量上限。

---

# 14. 粒子与环境对象

适用：

- 气泡；
- 漂浮颗粒；
- 花瓣；
- 小型光点。

策略：

- 数量受性能档控制；
- 使用对象池；
- 超出生命周期立即回收；
- 只更新必要属性；
- 静态属性不重复更新 GPU Buffer。

---

# 15. PerformanceManager

统一性能控制中心：

```text
PerformanceManager
├─ qualityProfile
├─ targetFps
├─ renderScale
├─ fishCountLimit
├─ particleLimit
├─ boidsHz
├─ behaviorHz
├─ shaderQuality
├─ visibilityState
├─ fullscreenState
└─ autoThrottle
```

所有系统从 PerformanceManager 获取性能参数，不允许各模块自行定义互相冲突的 FPS / Quality 策略。

---

# 16. 性能档位

## 16.1 节能

```text
FPS              20
Render Scale     0.75
默认鱼数量        15
Boids             8 Hz
粒子             少
Water Shader      简化 / 关闭
```

## 16.2 标准（默认）

```text
FPS              30
Render Scale     1.0
默认鱼数量        24
Boids            12 Hz
粒子             中
Water Shader      轻量
```

## 16.3 高质量

```text
FPS              60
Render Scale     1.0～1.5
默认鱼数量        35
Boids            20 Hz
粒子             多
Water Shader      完整
```

---

# 17. Render Scale 与高 DPI

不要直接使用：

```ts
resolution = window.devicePixelRatio
```

作为所有设备的固定策略。

建议将逻辑尺寸与渲染尺寸分离：

```text
逻辑尺寸
    ×
Render Scale
    =
实际渲染分辨率
```

Windows 4K / 高 DPI 场景优先以 1.0 或更低渲染比例运行。

后续 macOS Retina 同样遵守该原则。

---

# 18. 动态降载

动态壁纸最大的性能优化来自“不需要渲染时不渲染”。

建议状态：

```text
ACTIVE
桌面可见 → 20 / 30 / 60 FPS

IDLE
长时间无交互 → 可适当降低 FPS

OCCLUDED
桌面大部分被遮挡 → 5～10 FPS

HIDDEN
桌面完全不可见 → 停止 Ticker

FULLSCREEN
全屏应用 → 停止 Ticker
```

返回桌面后恢复正常状态。

---

# 19. 静态场景优化

静态内容包括：

- 池塘底图；
- 石块；
- 静态水草；
- 泥沙；
- 固定装饰。

优先方案：离线直接合并到背景图。

如需要运行时组合，则初始化后缓存为纹理，减少每帧遍历大量静态 Sprite。

---

# 20. Culling 策略

首版不盲目增加复杂 Culling。

原因：

- 场景本身基本等于一个屏幕；
- 大部分鱼长期在屏幕内；
- 复杂 CPU Culling 可能得不偿失。

策略：

- 鱼使用软边界，保持在有效区域；
- 粒子超出范围直接回收；
- 只有后续出现大量屏外对象时再引入更复杂剔除。

---

# 21. 平台 Adapter

建议接口：

```ts
interface PlatformAdapter {
  getPlatform(): 'windows' | 'macos' | 'web';
  getDisplayInfo(): DisplayInfo;
  isVisible(): boolean;
  isFullscreenAppActive(): boolean;
  onPause(callback: () => void): void;
  onResume(callback: () => void): void;
  getSettings(): Promise<MyFishPondSettings>;
  saveSettings(settings: MyFishPondSettings): Promise<void>;
}
```

Windows 首期实现 `WindowsAdapter`。

`MacAdapter` 只保留类型和工程位置，不要求 V1 开发。

---

# 22. Windows Host

## 22.1 原型阶段

可采用：

```text
Vite build
→ dist/
→ Lively Web Wallpaper
```

快速完成桌面效果和性能验证。

## 22.2 正式版建议

如果后院鱼塘作为独立产品发行，建议开发独立轻量 Windows Host：

```text
MyFishPond.exe
│
├─ Desktop Host
├─ WebView2 / Chromium Web Host
├─ Settings
├─ Tray
└─ PixiJS Web Core
```

Host 负责：

- 桌面窗口；
- 生命周期；
- 托盘菜单；
- 设置入口；
- 开机启动；
- 全屏检测；
- 遮挡状态；
- 多显示器；
- Web 与系统通信。

Web Core 不处理 Windows API。

---

# 23. macOS Host（后续）

后续建议：

```text
Swift / AppKit
→ Desktop Window
→ WKWebView
→ web/dist/index.html
```

负责：

- Desktop Window；
- Mission Control；
- Retina；
- Battery；
- 多屏；
- 开机启动；
- JS Bridge。

原则上不改写 Fish / Boids / Scene / Water 等核心模块。

---

# 24. 配置模型

建议统一配置结构：

```ts
interface MyFishPondSettings {
  qualityMode: 'eco' | 'standard' | 'high';
  fishCount: number;
  fishSpeed: number;
  schooling: number;
  mouseScare: boolean;
  clickRipple: boolean;
  feeding: boolean;
  waterMotion: boolean;
  caustics: boolean;
  particles: boolean;
  bubbles: boolean;
  autoPauseFullscreen: boolean;
}
```

设置模型保持平台无关。

---

# 25. 构建与发布

Web Core：

```bash
npm run build
```

输出：

```text
web/dist/
```

Windows Host 直接加载该构建产物。

原则：

- 核心 Web Build 只维护一套；
- 平台宿主不复制业务代码；
- 资源通过统一版本号管理。

---

# 26. 性能基线测试

第一阶段只测试：

- 静态背景；
- 24 条鱼；
- 基础 AnimatedSprite；
- 轻量 Boids；
- 30 FPS；
- 无高级水面 Shader。

测试分辨率：

- 1920 × 1080；
- 2560 × 1440；
- 3840 × 2160；
- Windows 高 DPI。

指标：

- FPS；
- CPU；
- GPU；
- Frame Time；
- Memory；
- GPU Memory（条件允许）；
- 1 小时 / 8 小时稳定性；
- 暂停 / 恢复；
- 休眠 / 恢复。

只有基线合格后，才逐步增加水光、粒子和其他视觉增强。

---

# 27. 优化优先级

固定顺序：

```text
1. Render Scale / 渲染像素量
2. FPS
3. 全屏 Shader Pass
4. Texture / Draw Call / Batch
5. Boids / AI
6. Particle Count
7. 视觉增强
```

不要把主要时间花在优化 20～30 条鱼的 JavaScript 微操作，而忽略 4K 全屏 Shader 的像素成本。

---

# 28. 分阶段技术实施

## 阶段一：性能基线

- PixiJS；
- WebGL2；
- 24 条鱼；
- 30 FPS；
- 4K 测试；
- 基础性能面板。

## 阶段二：Windows MVP

- Boids；
- 行为状态；
- 鼠标惊鱼；
- 点击波纹；
- Windows 宿主；
- 设置系统。

## 阶段三：视觉与性能增强

- Water Shader；
- Texture Atlas；
- 静态缓存；
- 粒子；
- 动态降载；
- Render Scale；
- 8h 稳定性测试。

## 阶段四：Windows 正式产品化

- 独立 Host（如采用）；
- 多屏；
- 全屏检测；
- 高 DPI；
- 开机启动；
- 安装卸载；
- 配置持久化；
- 发布测试。

## 阶段五：互动扩展

- 投喂；
- Feed 状态；
- 更多鱼种；
- 内容扩展。

## 后续阶段：macOS

- WKWebView Host；
- Retina；
- Battery；
- Mission Control；
- macOS 多屏。

---

# 29. 技术验收重点

## 29.1 性能

标准模式：

- 30 FPS；
- 默认 24 条鱼；
- 4K 可稳定长期运行；
- 前台常规应用无明显受影响；
- 全屏自动暂停。

## 29.2 稳定性

8 小时运行：

- 不崩溃；
- Memory 不持续上涨；
- 对象池数量稳定；
- 临时 FX 正常回收；
- 恢复桌面后正常继续。

## 29.3 架构

- Core 不引用 Windows API；
- Windows 能力全部位于 Adapter / Host；
- macOS 后续无需重写核心鱼塘系统。

---

# 30. 最终技术原则

1. Windows 优先，先把 V1 做稳；
2. 正式渲染路线固定为 PixiJS + WebGL2；
3. HTML Canvas 2D 不作为正式方案；
4. 默认 30 FPS；
5. 4K / 高 DPI 不盲目满物理分辨率；
6. Shader 尽量单 Pass；
7. AI 低频、运动高频；
8. 静态场景尽量缓存或离线合成；
9. 一条鱼尽量一个主渲染对象；
10. 桌面不可见时主动休眠；
11. 首期只实现 WindowsAdapter；
12. Web Core 保持平台无关；
13. 先通过性能基线，再增加视觉复杂度。
