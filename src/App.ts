import { useRef, useState, useEffect } from 'react';
import { encodeInMainThread } from './utils/encoder';

export function useTimelapse() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [source, setSource] = useState<'camera' | 'screen'>('camera');
  const [videoReady, setVideoReady] = useState(false);

  // --- 科学默认值计算 ---
  const DEFAULT_MAX_MEMORY_MB = 1024; // 1GB
  const ESTIMATED_FRAME_SIZE_KB = 200;
  const defaultMaxFrames = Math.floor((DEFAULT_MAX_MEMORY_MB * 1024) / ESTIMATED_FRAME_SIZE_KB);

  // localStorage keys
  const LS = {
    width: 'tlsr_width',
    height: 'tlsr_height',
    interval: 'tlsr_captureIntervalMs',
    fps: 'tlsr_outputFps',
    maxFrames: 'tlsr_maxFrames',
    quality: 'tlsr_quality',
    format: 'tlsr_format',
    frameMode: 'tlsr_frameMode'
  } as const;

  const parseNumber = (v: string | null, fallback: number) => {
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const [width, setWidth] = useState<number>(() => {
    try { return parseNumber(localStorage.getItem(LS.width), 1280); } catch { return 1280; }
  });
  const [height, setHeight] = useState<number>(() => {
    try { return parseNumber(localStorage.getItem(LS.height), 720); } catch { return 720; }
  });
  const [captureIntervalMs, setCaptureIntervalMs] = useState<number>(() => {
    try { return parseNumber(localStorage.getItem(LS.interval), 1000); } catch { return 1000; }
  });
  const [outputFps, setOutputFps] = useState<number>(() => {
    try { return parseNumber(localStorage.getItem(LS.fps), 30); } catch { return 30; }
  });
  const [maxFrames, setMaxFrames] = useState<number>(() => {
    try { return parseNumber(localStorage.getItem(LS.maxFrames), defaultMaxFrames); } catch { return defaultMaxFrames; }
  });
  // new: quality and format selectors
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>(() => {
    try { return (localStorage.getItem(LS.quality) as any) || 'medium'; } catch { return 'medium'; }
  });
  const [format, setFormat] = useState<'webm' | 'mp4'>(() => {
    try { return (localStorage.getItem(LS.format) as any) || 'webm'; } catch { return 'webm'; }
  });
  const [frameMode, setFrameMode] = useState<'compressed' | 'png' | 'raw'>(() => {
    try { return (localStorage.getItem(LS.frameMode) as any) || 'compressed'; } catch { return 'compressed'; }
  });
  const [bitrateKbps, setBitrateKbps] = useState<number | null>(0);

  const [actualContainer, setActualContainer] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [memoryUsageMB, setMemoryUsageMB] = useState<number>(0);

  const recordedFramesRef = useRef<Array<Blob | ImageBitmap>>([]);
  const [capturedCount, setCapturedCount] = useState(0);
  const captureTimerRef = useRef<number | null>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isCapturingRef = useRef(false);

  // Encoding state
  const [encoding, setEncoding] = useState(false);
  const [encodingProgress, setEncodingProgress] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  const stopCurrentStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setVideoReady(false);
    }
  };

  function getEstimatedMemoryMB() {
    // approximate memory usage of stored frames: Blob sizes + ImageBitmap approximation (w*h*4)
    let bytes = 0;
    for (const item of recordedFramesRef.current) {
      if ((item as Blob).size !== undefined) {
        bytes += (item as Blob).size;
      } else {
        // ImageBitmap approximation
        try {
          const ib = item as ImageBitmap;
          bytes += (ib.width * ib.height * 4);
        } catch (_) {
          // ignore
        }
      }
    }
    return bytes / (1024 * 1024);
  }

  // targetBitrate formula (kbps) as provided
  type QualityType = 'LQ' | 'SQ' | 'HQ';
  const alpha: Record<QualityType, number> = { LQ: 0.07, SQ: 0.12, HQ: 0.20 };
  function mapQuality(q: 'low' | 'medium' | 'high'): QualityType {
    if (q === 'low') return 'LQ';
    if (q === 'high') return 'HQ';
    return 'SQ';
  }

  function targetBitrate(w: number, h: number, f: number, q: QualityType): number {
    const area = w * h;
    const r = Math.min(w, h) / Math.max(w, h);
    const equiv = area * (1 - 0.3 * (1 - r));
    const base = (equiv * f * alpha[q]) / 1000;
    return Math.round(Math.min(Math.max(base, 100), 50000));
  }

  // Auto-fill bitrate when quality select changes or when entering compressed mode.
  useEffect(() => {
    if (frameMode !== 'compressed') return;
    // compute suggested bitrate based on current params
    const qType = mapQuality(quality);
    const suggested = targetBitrate(width, height, outputFps, qType);
    // only auto-set when user did not set bitrate (0 or null) or when quality changed
    setBitrateKbps((prev) => {
      // if prev is null or 0, always set; otherwise set when different from suggested
      if (!prev || prev === 0) return suggested;
      // if quality changed, prefer new suggested
      return suggested;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, frameMode, width, height, outputFps]);

  const getMedia = async () => {
    try {
      stopCurrentStream();
      const mediaStream = source === 'camera'
        ? await navigator.mediaDevices.getUserMedia({ video: true })
        : await navigator.mediaDevices.getDisplayMedia();
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setVideoReady(true);
        }, { once: true });
      }
    } catch (err) {
      console.error('Error accessing media:', err);
      alert('无法获取媒体流。请检查摄像头/屏幕权限。');
    }
  };

  const startRecording = async () => {
    if (!stream || !videoReady || !videoRef.current || encoding) return;

    recordedFramesRef.current = [];
    setCapturedCount(0);
    setRecordedChunks([]);
    setEncodingProgress(0);

    isCapturingRef.current = true;
    setRecording(true);

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const cap = captureCanvasRef.current;
    cap.width = width;
    cap.height = height;

    if (offCanvasRef.current) {
      offCanvasRef.current.width = width;
      offCanvasRef.current.height = height;
    }

    const captureFrame = async () => {
      if (!isCapturingRef.current || recordedFramesRef.current.length >= maxFrames) return;

      const ctx = cap.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cap.width, cap.height);
      const vw = videoRef.current!.videoWidth || 1;
      const vh = videoRef.current!.videoHeight || 1;
      const scale = Math.min(cap.width / vw, cap.height / vh);
      const drawW = vw * scale;
      const drawH = vh * scale;
      const dx = (cap.width - drawW) / 2;
      const dy = (cap.height - drawH) / 2;

      try {
        ctx.drawImage(videoRef.current!, dx, dy, drawW, drawH);
        if (frameMode === 'raw') {
          // capture raw ImageBitmap (no re-encoding) - memory heavy
          const bmp = await createImageBitmap(cap);
          recordedFramesRef.current.push(bmp);
          setCapturedCount(c => c + 1);
        } else if (frameMode === 'png') {
          const blob = await new Promise<Blob | null>((resolve) => cap.toBlob(resolve, 'image/png'));
          if (blob) {
            recordedFramesRef.current.push(blob);
            setCapturedCount(c => c + 1);
          }
        } else {
          const mimeType = 'image/webp';
          const qualityValue = quality === 'low' ? 0.5 : quality === 'high' ? 0.95 : 0.8;
          const blob = await new Promise<Blob | null>((resolve) => cap.toBlob(resolve, mimeType, qualityValue));
          if (blob) {
            recordedFramesRef.current.push(blob);
            setCapturedCount(c => c + 1);
          }
        }
        // update memory estimate after capture
        setMemoryUsageMB(Math.round(getEstimatedMemoryMB()));
      } catch (e) {
        console.error('captureFrame error', e);
      }
    };

    const frameRunner = async () => {
      if (!isCapturingRef.current) return;

      await captureFrame();

      if (isCapturingRef.current && recordedFramesRef.current.length < maxFrames) {
        captureTimerRef.current = window.setTimeout(frameRunner, captureIntervalMs);
      } else {
        if (recordedFramesRef.current.length >= maxFrames) {
          console.log('达到最大帧数，自动停止录制。');
          stopRecording();
        }
      }
    };

    frameRunner();
  };

  const stopRecording = async () => {
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    isCapturingRef.current = false;
    setRecording(false);

    const frames = recordedFramesRef.current.slice();
    if (frames.length === 0) {
      setCapturedCount(0);
      return;
    }
    recordedFramesRef.current = [];

    setEncoding(true);
    setEncodingProgress(0);

    const MAX_WORKER_RETRIES = 2;
  const settings = { width, height, outputFps, estimatedFrameCount: frames.length, quality, format, bitrateKbps: bitrateKbps || undefined, frameMode };

    async function createWorkerInstance() {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Vite-style module worker URL
      const w = new Worker(new URL('./encoder.worker.ts', import.meta.url), { type: 'module' });
      return w as Worker;
    }

    async function probeWorker(w: Worker, timeoutMs = 2000): Promise<{ supportsWebCodecs: boolean } | null> {
      return new Promise((resolve) => {
        let finished = false;
        const onm = (ev: MessageEvent) => {
          const msg = ev.data || {};
          if (msg.command === 'capabilities') {
            finished = true;
            w.removeEventListener('message', onm);
            resolve(msg.capabilities || null);
          }
        };
        w.addEventListener('message', onm);
        try { w.postMessage({ command: 'probe' }); } catch (e) { w.removeEventListener('message', onm); resolve(null); return; }
        setTimeout(() => { if (!finished) { w.removeEventListener('message', onm); resolve(null); } }, timeoutMs);
      });
    }

    async function workerEncodeWithRetries(): Promise<ArrayBuffer> {
      let attempts = 0;
      let lastErr: any = null;
      while (attempts <= MAX_WORKER_RETRIES) {
        attempts++;
        if (!workerRef.current) workerRef.current = await createWorkerInstance();
        const w = workerRef.current;

        try {
          const caps = await probeWorker(w);
          if (!caps || !caps.supportsWebCodecs) throw new Error('Worker does not support WebCodecs');

          let resolveStarted: () => void;
          const startedPromise = new Promise<void>((res) => { resolveStarted = res; });
          const acceptedResolvers = new Map<number, () => void>();

          const completePromise = new Promise<ArrayBuffer>((resolve, reject) => {
            let chosenFormat: string | null = null;
            const onMessage = (ev: MessageEvent) => {
              const msg = ev.data || {};
              if (msg.command === 'started') {
                // worker may report which format it actually selected
                if (msg.usedFormat) chosenFormat = msg.usedFormat;
                resolveStarted();
              } else if (msg.command === 'progress') {
                if (typeof msg.progress === 'number') setEncodingProgress(msg.progress);
                else if (msg.frames) setEncodingProgress((msg.frames / frames.length) * 100);
              } else if (msg.command === 'accepted') {
                const idx = msg.index;
                const r = acceptedResolvers.get(idx);
                if (r) { r(); acceptedResolvers.delete(idx); }
              } else if (msg.command === 'complete') {
                w.removeEventListener('message', onMessage);
                // record actual container
                if (msg.usedFormat) chosenFormat = msg.usedFormat;
                if (chosenFormat) setActualContainer(chosenFormat);
                // if chosenFormat differs from requested, set fallback notice
                if (settings.format && chosenFormat && settings.format !== chosenFormat) {
                  setFallbackNotice(`Requested ${settings.format} but encoder produced ${chosenFormat}`);
                } else {
                  setFallbackNotice(null);
                }
                const buffer: ArrayBuffer = msg.buffer;
                resolve(buffer);
              } else if (msg.command === 'error') {
                w.removeEventListener('message', onMessage);
                reject(new Error(msg.message || 'worker error'));
              }
            };
            w.addEventListener('message', onMessage);

            try { w.postMessage({ command: 'start', settings }); } catch (e) { reject(e); }
          });

          await startedPromise;

          for (let i = 0; i < frames.length; i++) {
            const item = frames[i];
            let bmp: ImageBitmap | null = null;
            try {
              if ((item as ImageBitmap).close) {
                // item is ImageBitmap
                bmp = item as ImageBitmap;
              } else {
                // item is Blob
                bmp = await createImageBitmap(item as Blob);
              }
              const acceptedPromise = new Promise<void>((res) => acceptedResolvers.set(i, res));
              w.postMessage({ command: 'frame', imageBitmap: bmp, meta: { timestamp: i / outputFps, duration: 1 / outputFps, index: i } }, [bmp]);
              await acceptedPromise;
            } catch (err) {
              if (bmp) try { bmp.close(); } catch (_) {}
              throw err;
            }
            setEncodingProgress(((i + 1) / frames.length) * 50);
          }

          w.postMessage({ command: 'finalize' });
          const buffer = await completePromise;
          return buffer;
        } catch (err) {
          lastErr = err;
          try { workerRef.current?.terminate(); } catch (_) {}
          workerRef.current = null;
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
      }
      throw lastErr || new Error('Worker encoding failed after retries');
    }

    try {
      const buf = await workerEncodeWithRetries();
      if (buf) {
        const used = actualContainer || format || 'webm';
        const mime = used === 'mp4' ? 'video/mp4' : 'video/webm';
        const outBlob = new Blob([buf], { type: mime });
        setRecordedChunks([outBlob]);
      }
      setEncoding(false);
      setEncodingProgress(100);
      return;
    } catch (workerErr) {
      console.warn('Worker encoding failed, falling back to main-thread encoder:', workerErr);
      try {
  const encCanvas = offCanvasRef.current || document.createElement('canvas');
  const qualityOrBits = (typeof bitrateKbps === 'number' && bitrateKbps > 0) ? bitrateKbps : quality;
  const result = await encodeInMainThread(frames, encCanvas, width, height, outputFps, format, qualityOrBits, (p: number) => setEncodingProgress(p));
        setRecordedChunks(result.blobs);
        // set actual container and fallback notice
        if (result.mimeType.includes('webm')) setActualContainer('webm');
        else if (result.mimeType.includes('mp4')) setActualContainer('mp4');
        if (settings.format && actualContainer && settings.format !== actualContainer) {
          setFallbackNotice(`Requested ${settings.format} but main-thread encoder produced ${actualContainer}`);
        }
      } catch (mainErr) {
        console.error('Main-thread fallback failed:', mainErr);
        alert('编码失败: ' + (mainErr as Error).message);
      } finally {
        setEncoding(false);
      }
    }
  };

  const downloadVideo = () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timelapse.webm';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      stopCurrentStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  // persist settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(LS.width, String(width));
      localStorage.setItem(LS.height, String(height));
      localStorage.setItem(LS.interval, String(captureIntervalMs));
      localStorage.setItem(LS.fps, String(outputFps));
      localStorage.setItem(LS.maxFrames, String(maxFrames));
      if (quality) localStorage.setItem(LS.quality, quality);
      if (format) localStorage.setItem(LS.format, format);
      if (frameMode) localStorage.setItem(LS.frameMode, frameMode);
    } catch (e) {
      // ignore write errors (e.g., storage disabled)
    }
  }, [width, height, captureIntervalMs, outputFps, maxFrames, quality, format, frameMode]);

  return {
    stopCurrentStream,
    videoRef,
    offCanvasRef,
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
    recording,
    encoding,
    encodingProgress,
    stream,
    source,
    setSource,
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
  } as const;
}

export default useTimelapse;
