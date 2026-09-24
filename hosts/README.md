# Desktop host integration

当前项目先以浏览器作为渲染和性能验证宿主。`PlatformAdapter` 提供桌面宿主所需的显示信息、暂停/恢复事件及设置持久化接口。

后续 Windows Host 在此接入桌面生命周期、全屏检测、多显示器、托盘、开机启动和 WebView2/Chromium 容器；鱼塘核心逻辑继续位于 `web/src/core/`。macOS Host 暂不实现。
