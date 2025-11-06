import React from 'react';
import './App.css';
import useTimelapse from './App';

function App() {
  const {
    videoRef,
    offCanvasRef,
    recording,
    encoding,
    encodingProgress,
    stream,
    stopCurrentStream,
    setSource,
    quality,
    setQuality,
    format,
    setFormat,
    frameMode,
    setFrameMode,
    bitrateKbps,
    setBitrateKbps,
    actualContainer,
    fallbackNotice,
    memoryUsageMB,
    getMedia,
    startRecording,
    stopRecording,
    downloadVideo,
    width,
    height,
    setWidth,
    setHeight,
    captureIntervalMs,
    setCaptureIntervalMs,
    outputFps,
    setOutputFps,
    maxFrames,
    setMaxFrames,
    capturedCount,
    videoReady,
    recordedChunks,
  } = useTimelapse();

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);

  // 提示: defaultMaxFrames 在 hook 内部计算并保持不暴露，UI 可显示自己的建议值或由 hook 暴露。

  return (
    <div className="app" data-recording={recording}>
      <h1>Chrona</h1>
      <h6>Time-Lapse Screen Record</h6>
      <div className="controls">
  <button onClick={() => { stopCurrentStream(); setSource('camera'); }} disabled={recording || encoding}>摄像头</button>
  <button onClick={() => { stopCurrentStream(); setSource('screen'); }} disabled={recording || encoding}>屏幕</button>
        <button onClick={getMedia} disabled={recording || encoding}>获取媒体</button>
      </div>
      <div className="settings">
        <label>分辨率宽: <input type="number" value={width} onChange={e => setWidth(Number(e.target.value) || 1)} disabled={recording || encoding} /></label>
        <label>分辨率高: <input type="number" value={height} onChange={e => setHeight(Number(e.target.value) || 1)} disabled={recording || encoding} /></label>
        <button onClick={() => {
          if (videoRef.current && videoRef.current.videoWidth && videoRef.current.videoHeight) {
            setWidth(videoRef.current.videoWidth);
            setHeight(videoRef.current.videoHeight);
          }
        }} disabled={!videoReady || recording || encoding}>使用源分辨率</button>
        <label>采样间隔(ms): <input type="number" value={captureIntervalMs} onChange={e => setCaptureIntervalMs(Number(e.target.value) || 100)} disabled={recording || encoding} /></label>
        <label>输出FPS: <input type="number" value={outputFps} onChange={e => setOutputFps(Number(e.target.value) || 1)} disabled={recording || encoding} /></label>
        <label>最大帧数: <input type="number" value={maxFrames} onChange={e => setMaxFrames(Number(e.target.value) || 1)} disabled={recording || encoding} /> (建议: 请参见设置)</label>
        
        <button 
          className="advanced-toggle"
          onClick={() => setAdvancedOpen(v => !v)}
          disabled={recording || encoding}
        >
          {advancedOpen ? '收起高级设置' : '展开高级设置'}
        </button>
        {/* 高级设置区域 */}
        {advancedOpen && (
          <div className="advanced">
            <div className="advanced-fields">
              <label>
                采样质量:
                <select value={quality} onChange={e => setQuality(e.target.value as any)} disabled={recording || encoding}>
                  <option value="low">低（更小体积）</option>
                  <option value="medium">中（平衡）</option>
                  <option value="high">高（更好画质）</option>
                </select>
                <div className="advanced-hint">采样时图像压缩(frameMode=compressed)生效，还为变量参与码率计算</div>
              </label>
              
              <label>
                输出容器（仅高级）:
                <select value={format} onChange={e => setFormat(e.target.value as any)} disabled={recording || encoding}>
                  <option value="webm">WebM</option>
                  <option value="mp4">MP4（若环境支持）</option>
                </select>
                <div className="advanced-hint">选择目标容器。若浏览器或 Worker 不支持，系统会回退并显示提示。</div>
              </label>
              
              <label>
                帧模式:
                <select value={frameMode} onChange={e => setFrameMode(e.target.value as any)} disabled={recording || encoding}>
                  <option value="compressed">压缩 (WebP)</option>
                  <option value="png">无损 PNG</option>
                  <option value="raw">原始 ImageBitmap（最高质量，内存占用大）</option>
                </select>
              </label>
              
              <label>
                目标码率 (kbps): 
                <input 
                  type="number" 
                  value={bitrateKbps ?? 0} 
                  onChange={e => setBitrateKbps(Number(e.target.value) || 0)} 
                  disabled={recording || encoding} 
                />
              </label>
            </div>
            
            {/* 状态信息 */}
            <div className="advanced-stats">
              <div>当前内存占用估计: {memoryUsageMB} MB</div>
              <div>实际容器: {actualContainer || '未知'}</div>
            </div>
            
            {/* 错误提示 */}
            {fallbackNotice && <div className="fallback-notice">{fallbackNotice}</div>}
          </div>
        )}
        
        {/* 已采样帧信息 */}
        <div>已采样帧: {capturedCount} / {maxFrames}</div>
      </div>
      <div className="preview">
        <video ref={videoRef} autoPlay muted></video>
        <canvas ref={offCanvasRef} style={{ display: 'none' }} />
      </div>

      {encoding && (
        <div className="encoding-status">
          <p>正在编码视频... {Math.round(encodingProgress)}%</p>
          <progress value={encodingProgress} max="100" style={{ width: '100%' }}></progress>
        </div>
      )}

      <div className="actions">
        <button onClick={startRecording} disabled={!stream || recording || encoding}>开始录制</button>
        <button onClick={stopRecording} disabled={!recording || encoding}>停止录制</button>
        <button onClick={downloadVideo} disabled={recordedChunks.length === 0 || encoding}>下载视频</button>
      </div>
      
        <button onClick={() => setAboutOpen(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(68, 75, 82, 1)', cursor: 'pointer', padding: 0 }}>{aboutOpen ? '关闭关于' : '关于此软件'}</button>
        {aboutOpen && (
          <div className="about" style={{ marginTop: 8, fontSize: '0.95em', color: '#757575ff' }}>
            <div>AGPLv3 {new Date().getFullYear()} Chrona made by <a href="https://github.com/Kompas9045">Kompas9045</a> </div>
            <div>Chrona 是一个基于 WebRTC 的屏幕录制工具，允许用户在浏览器中录制屏幕并将其保存为视频文件。</div>
            <div style={{ marginTop: 8 }}>
              <strong>第三方项目与协议：</strong>
              <ul>
                <li><a href="https://mediabunny.dev/" target="_blank" rel="noopener noreferrer">mediabunny</a> — Mozilla Public License 2.0</li>
                <li><a href="https://reactjs.org/" target="_blank" rel="noopener noreferrer">React</a> — MIT License</li>
                <li><a href="https://vitejs.dev/" target="_blank" rel="noopener noreferrer">Vite</a> — MIT License</li>
                <li><a href="https://w3c.github.io/webcodecs/" target="_blank" rel="noopener noreferrer">WebCodecs</a> — W3C spec</li>
                <li><a href="https://typeforward.com/garet/" target="_blank" rel="noopener noreferrer">Garet</a> — Type-Forward_FreeGaret_EULA</li>
              </ul>
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>许可证：</strong> 本软件遵循 <a href="https://opensource.org/license/agpl-v3">AGPLv3</a> 许可证，第三方组件遵循其各自协议，如上所示。<br />
              <strong>隐私：</strong> 录制的屏幕视频将完全在您的计算机上处理，本网站属静态网站，没有任何跟踪程序或上传动作。<br />
              <strong>源代码：</strong> 源代码托管在 <a href="https://github.com/Kompas9045/Chrona-Timelapse-Record" target="_blank" rel="noopener noreferrer">GitHub</a> 上。
            </div>
          </div>
        )}
      </div>
  );
}

export default App;