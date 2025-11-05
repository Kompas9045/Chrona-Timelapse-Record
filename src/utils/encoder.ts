// Lightweight encoder utilities used by the app
export const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(blob);
  });
};

// Main-thread fallback encoder: draws blobs into a canvas, captures via MediaRecorder
export async function encodeInMainThread(
  blobs: Array<Blob | ImageBitmap>,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  outputFps: number,
  requestedFormat: 'webm' | 'mp4',
  qualityOrBits: 'low' | 'medium' | 'high' | number,
  onProgress?: (p: number) => void
): Promise<{ blobs: Blob[]; mimeType: string }> {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context for main-thread encoding.');

  const streamOut = (canvas as any).captureStream ? (canvas as any).captureStream(outputFps) : null;
  if (!streamOut) throw new Error('captureStream not supported on canvas in this environment.');

  // choose a safe mimeType based on requested format and browser support
  function pickMimeForFormat(fmt: 'webm' | 'mp4') {
    if (fmt === 'mp4') {
      const candidates = [
        'video/mp4;codecs="avc1.42E01E"',
        'video/mp4;codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4'
      ];
      for (const c of candidates) if ((MediaRecorder as any).isTypeSupported && (MediaRecorder as any).isTypeSupported(c)) return c;
      return null;
    }
    // webm
    const webmCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    for (const c of webmCandidates) if ((MediaRecorder as any).isTypeSupported && (MediaRecorder as any).isTypeSupported(c)) return c;
    return null;
  }

  let mimeType = pickMimeForFormat(requestedFormat);
  if (!mimeType) {
    // fallback to webm if possible
    mimeType = pickMimeForFormat('webm');
    if (mimeType) console.warn(`Requested format ${requestedFormat} not supported by MediaRecorder; falling back to ${mimeType}`);
    else throw new Error('No supported mime type found for MediaRecorder on this platform.');
  }

  // map quality or explicit numeric value to bitsPerSecond for MediaRecorder
  let bitsPerSecond: number | undefined = undefined;
  if (typeof qualityOrBits === 'number') {
    bitsPerSecond = Math.max(1000, Math.floor(qualityOrBits) * 1000); // kbps -> bps
  } else {
    bitsPerSecond = qualityOrBits === 'low' ? 5e5 : qualityOrBits === 'high' ? 6e6 : 2e6;
  }
  const recorderOptions: any = { mimeType: mimeType };
  if (typeof bitsPerSecond === 'number') recorderOptions.bitsPerSecond = bitsPerSecond;
  const recorder = new MediaRecorder(streamOut, recorderOptions);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
  const stopPromise = new Promise<Blob[]>((resolve) => { recorder.onstop = () => resolve(chunks); });
  recorder.start();

  const frameDuration = 1000 / outputFps;
  for (let i = 0; i < blobs.length; i++) {
    try {
      const item = blobs[i];
      let bmp: ImageBitmap | null = null;
      if ((item as ImageBitmap).close) {
        bmp = item as ImageBitmap;
      } else {
        bmp = await createImageBitmap(item as Blob);
      }
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bmp, 0, 0, width, height);
      if ((item as ImageBitmap).close) {
        // keep raw ImageBitmap open only if it's from frames; but we drew it and can close
        try { bmp.close(); } catch (_) {}
      } else {
        try { bmp.close(); } catch (_) {}
      }
    } catch (e) {
      console.warn('encodeInMainThread: failed to decode frame, skipping', e);
    }
    if (onProgress) onProgress(((i + 1) / blobs.length) * 100);
    await new Promise((r) => setTimeout(r, frameDuration));
  }

  recorder.stop();
  const out = await stopPromise;
  streamOut.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  return { blobs: out, mimeType };
}
