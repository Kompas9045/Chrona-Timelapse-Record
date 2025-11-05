# Chrona - 延时屏幕录像工具

Chrona 是一个基于 WebRTC 和 WebCodecs API 的延时屏幕录像工具，允许用户在浏览器中录制屏幕或摄像头，并将其保存为视频文件。

## 功能特点

- 支持屏幕和摄像头录制
- 延时录制（可调节采样间隔）
- 多种输出格式：WebM 和 MP4
- 多种帧捕获模式：
  - 压缩模式 (WebP)
  - 无损 PNG 模式
  - 原始 ImageBitmap 模式（最高质量）
  完全在浏览器中运行，无需下载

## 技术栈

- [React](https://reactjs.org/) - 用于构建用户界面
- [Vite](https://vitejs.dev/) - 快速的开发构建工具
- [TypeScript](https://www.typescriptlang.org/) - JavaScript 的超集，提供类型安全
- [Mediabunny](https://mediabunny.dev/) - 用于 WebCodecs 编码和复用
- [WebRTC](https://webrtc.org/) - 用于媒体捕获
- [WebCodecs API](https://w3c.github.io/webcodecs/) - 用于高效媒体编码

## 安装和运行

1. 克隆仓库：

```
git clone <repository-url>
cd TimeLapseScreenRecord
```

2. 安装依赖：

```
npm install
```

3. 启动开发服务器：

```
npm run dev
```

4. 构建生产版本：

```
npm run build
```

## 使用说明

1. 选择录制源（摄像头或屏幕）
2. 点击"获取媒体"按钮
3. 调整录制参数（分辨率、采样间隔、输出 FPS 等）
4. 点击"开始录制"
5. 录制完成后点击"停止录制"
6. 点击"下载视频"保存录制结果

### 参数说明

- **分辨率**：录制视频的宽度和高度
- **采样间隔**：每隔多少毫秒捕获一帧（控制时间流逝速度）
- **输出 FPS**：最终视频的播放帧率
- **最大帧数**：限制录制的总帧数以控制内存使用
- **采样质量**：影响压缩质量和码率计算
- **帧模式**：决定如何捕获和存储帧数据
- **目标码率**：视频编码的目标比特率（kbps）

## 许可证

本软件遵循 AGPLv3 许可证。有关详细信息，请参阅 LICENSE 文件。

第三方组件及其许可证：
- Mediabunny - Mozilla Public License 2.0
- React - MIT License
- Vite - MIT License
- WebCodecs - W3C 规范
- Garet - Type-Forward_FreeGaret_EULA

## 开发者

[Kompas9045](https://github.com/Kompas9045)
