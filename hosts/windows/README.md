# Windows Host boundary

V1 原型由 Vite 开发服务器或静态构建产物承载，可先通过 Lively Wallpaper 验证桌面表现。

正式独立产品阶段再接入 WebView2/Chromium Host，并实现桌面窗口、多显示器、全屏检测、遮挡降载、系统托盘、开机启动与安装卸载。系统能力通过 `PlatformAdapter` 提供给 Web Core，不在鱼类或场景模块中调用 Windows API。
