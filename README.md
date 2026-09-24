# 后院鱼塘 MyFishPond

把一方鱼塘，养在桌面上。

这是按 PRD 与技术方案搭建的第一阶段可运行原型：使用 TypeScript、PixiJS 8 和 WebGL2 展示池塘与动态测试鱼，验证核心渲染和运动基线。

## 开发环境

- Node.js 20.19+（建议使用 Node 22 LTS）
- npm 10+
- 支持 WebGL2 的现代浏览器，并已开启硬件加速

```powershell
npm install
npm run dev
```

Vite 会输出本地访问地址。生产构建与本地预览：

```powershell
npm run build
npm run preview
```

## 当前原型

- PixiJS WebGL2 渲染，节能、标准和高质量三档；
- 默认 24 条测试鱼，包含平滑转向、软边缘回避和轻量局部聚群；
- 鱼花纹按鱼种和种子独立生成，可指定锦鲤/金鱼花型；V1 `.mfp-fish.json` 支持校验、读取、序列化和下载；
- 可调整鱼群数量、暂停场景、恢复推荐设置；
- 显示 FPS、帧间隔、鱼数、逻辑分辨率与渲染比例；
- 页面隐藏时暂停渲染，设置保存在浏览器本地；控制面板默认收起，留出完整观赏区域。

鱼塘背景以 `web/public/images/pond-background.png` 呈现，锦鲤与金鱼使用 RGBA 透明 8 帧精灵表，由 PixiJS `AnimatedSprite` 播放摆尾/鱼鳍循环，再叠加可变化的个体花纹。独立 Windows 桌面宿主、系统级全屏检测和安装包属于后续阶段。

两种鱼的精灵表布局、帧序和播放方式见 [鱼类动画素材 V1](Doc/MyFishPond_FishAnimation_V1.md)。

鱼文件字段、花型编号和版本兼容规则见 [鱼文件格式 V1](Doc/MyFishPond_FishFile_V1.md)。当前随机鱼群会自动生成并使用个体花纹；读写 API 已提供，面向鱼库的导入/导出操作界面仍待后续接入。

## 目录

```text
Doc/                         PRD、技术方案与视觉参考
web/public/images/           池塘场景美术资源
web/src/core/                场景、鱼类、Boids 和性能管理
web/src/platform/            平台适配接口与浏览器适配
web/src/ui/                  原型控制面板
hosts/                       桌面宿主集成边界
```
