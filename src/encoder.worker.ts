// encoder.worker.ts
// Worker implementation using Mediabunny to encode & mux (WebCodecs-based muxer)
import { Output, BufferTarget, WebMOutputFormat, VideoSampleSource, VideoSample, getFirstEncodableVideoCodec } from 'mediabunny';
// Note: Some builds of mediabunny may also export an MP4OutputFormat. We'll try to access it dynamically if available.
let MP4OutputFormat: any = null;
try {
    // @ts-ignore
    MP4OutputFormat = (await import('mediabunny')).MP4OutputFormat;
} catch (e) {
    // ignore - may not be available in all builds/environments
}

let output: Output | null = null;
let videoSource: VideoSampleSource | null = null;
let receivedFrames = 0;
let expectedFrames: number | null = null;
let usedFormat: 'webm' | 'mp4' = 'webm';

// Internal sequential processing queue to ensure add() calls are serialized
type QueuedFrame = { imageBitmap: ImageBitmap; meta: { timestamp: number; duration: number; index?: number } };
const frameQueue: QueuedFrame[] = [];
let processing = false;

async function processQueue() {
    if (processing) return;
    processing = true;
    while (frameQueue.length > 0) {
        const item = frameQueue.shift()!;
        try {
            if (!videoSource) throw new Error('Encoder not started');
            const sample = new VideoSample(item.imageBitmap, { timestamp: item.meta.timestamp, duration: item.meta.duration });
            await videoSource.add(sample);
            sample.close();
            // notify main thread that this frame was accepted
            postMessage({ command: 'accepted', index: item.meta.index });
        } catch (err) {
            // bubble error to main thread
            postMessage({ command: 'error', message: (err as Error).message });
        } finally {
            try { item.imageBitmap.close(); } catch (_) {}
            receivedFrames++;
            if (expectedFrames) {
                postMessage({ command: 'progress', progress: (receivedFrames / expectedFrames) * 100 });
            } else {
                postMessage({ command: 'progress', progress: null, frames: receivedFrames });
            }
        }
    }
    processing = false;
}

onmessage = async (e: MessageEvent) => {
    const { command } = e.data || {};

    try {
        if (command === 'probe') {
            const supportsWebCodecs = typeof (self as any).VideoEncoder === 'function' || typeof (self as any).VideoDecoder === 'function';
            postMessage({ command: 'capabilities', capabilities: { supportsWebCodecs } });
            return;
        }

        if (command === 'start') {
            const { codecPreferences, estimatedFrameCount, quality, format: requestedFormat, bitrateKbps } = e.data.settings || {};
            expectedFrames = typeof estimatedFrameCount === 'number' ? estimatedFrameCount : null;

            // choose a codec that the environment can encode
            let chosenCodec: any = 'vp9';
            try {
                const first = await getFirstEncodableVideoCodec(codecPreferences || ['vp9','vp8','avc']);
                if (first) chosenCodec = first as string;
            } catch (err) {
                // fallback to vp9
            }

            // bitrate: prefer explicit bitrateKbps if provided, otherwise map quality
            const bitrate = typeof bitrateKbps === 'number' && bitrateKbps > 0
                ? bitrateKbps * 1000
                : (quality === 'low' ? 5e5 : quality === 'high' ? 6e6 : 2e6);

            // create output target
            const target = new BufferTarget();
            let formatInstance: any = new WebMOutputFormat();
            let usedFormatName: 'webm' | 'mp4' = 'webm';
            if (requestedFormat === 'mp4' && MP4OutputFormat) {
                try {
                    formatInstance = new MP4OutputFormat();
                    usedFormatName = 'mp4';
                } catch (e) {
                    formatInstance = new WebMOutputFormat();
                    usedFormatName = 'webm';
                }
            }
            output = new Output({ format: formatInstance, target });

            // create a VideoSampleSource to accept VideoSample instances
            videoSource = new VideoSampleSource({ codec: chosenCodec as any, bitrate: bitrate });
            output.addVideoTrack(videoSource as any);

            await output.start();
            receivedFrames = 0;
            // record and reply started to main thread (inform which format was chosen)
            usedFormat = usedFormatName;
            postMessage({ command: 'started', usedFormat });
            return;
        }

        if (command === 'frame') {
            // queue the frame for processing to ensure sequential add() and avoid races
            const { timestamp = 0, duration = 0, index } = e.data.meta || {};
            const imageBitmap: ImageBitmap = e.data.imageBitmap;

            frameQueue.push({ imageBitmap, meta: { timestamp, duration, index } });
            // start processing if not already
            processQueue().catch(err => postMessage({ command: 'error', message: (err as Error).message }));
            return;
        }

        if (command === 'finalize') {
            if (!output) {
                postMessage({ command: 'error', message: 'Nothing to finalize' });
                return;
            }

            // finalize and return buffer
            await output.finalize();
            const buf = (output.target as BufferTarget).buffer;
            // Transfer the ArrayBuffer back and include format used
            (postMessage as any)({ command: 'complete', buffer: buf, usedFormat }, buf ? [buf] : []);

            // cleanup
            output = null;
            videoSource = null;
            expectedFrames = null;
            receivedFrames = 0;
            return;
        }

        // unknown command
    } catch (err) {
        postMessage({ command: 'error', message: (err as Error).message });
    }
};