import {
  BannerStingerType,
  ExportAspectRatio,
  OverlayConfig,
  SCENE_PRESETS,
  VerticalLayoutMode,
} from '../types/studio';
import { renderBroadcastFrame } from './canvasOverlay';

export function pickSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface RecorderSlot {
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
}

/**
 * Dual-staggered MediaRecorder rolling buffer.
 * Guarantees every saved replay buffer clip starts with an intact WebM EBML header
 * and spans up to the configured buffer window cleanly.
 */
export class RollingReplayBuffer {
  private stream: MediaStream;
  private mimeType: string;
  private bufferWindowSec: number;
  private slotA: RecorderSlot | null = null;
  private slotB: RecorderSlot | null = null;
  private rotationTimer: number | null = null;
  private running = false;

  constructor(stream: MediaStream, bufferWindowSec = 30) {
    this.stream = stream;
    this.bufferWindowSec = bufferWindowSec;
    this.mimeType = pickSupportedMimeType();
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.slotA = this.createAndStartSlot();

    this.rotationTimer = window.setInterval(() => {
      if (!this.running) return;
      const now = Date.now();
      const halfWindowMs = this.bufferWindowSec * 1000;

      // Start slot B after 1 full buffer window, then rotate the older slot every window
      if (!this.slotB && this.slotA && now - this.slotA.startedAt >= halfWindowMs) {
        this.slotB = this.createAndStartSlot();
        return;
      }

      if (this.slotA && this.slotB) {
        if (now - this.slotA.startedAt >= halfWindowMs * 2) {
          this.discardSlot(this.slotA);
          this.slotA = this.createAndStartSlot();
        } else if (now - this.slotB.startedAt >= halfWindowMs * 2) {
          this.discardSlot(this.slotB);
          this.slotB = this.createAndStartSlot();
        }
      }
    }, 1000);
  }

  public setBufferWindow(seconds: number): void {
    this.bufferWindowSec = seconds;
  }

  public getElapsedFillSec(): number {
    if (!this.running) return 0;
    const now = Date.now();
    const ageA = this.slotA ? (now - this.slotA.startedAt) / 1000 : 0;
    const ageB = this.slotB ? (now - this.slotB.startedAt) / 1000 : 0;
    return Math.min(this.bufferWindowSec, Math.max(ageA, ageB));
  }

  public async captureClip(): Promise<{ blob: Blob; durationSec: number } | null> {
    if (!this.running) return null;
    const now = Date.now();

    // Pick the older active slot so we capture the longest valid contiguous segment
    let targetSlotKey: 'A' | 'B' = 'A';
    if (this.slotA && this.slotB) {
      targetSlotKey = this.slotA.startedAt <= this.slotB.startedAt ? 'A' : 'B';
    } else if (this.slotB && !this.slotA) {
      targetSlotKey = 'B';
    }

    const slot = targetSlotKey === 'A' ? this.slotA : this.slotB;
    if (!slot) return null;

    const elapsedSec = Math.max(1.2, (now - slot.startedAt) / 1000);

    // Replace the harvested slot immediately with a fresh recorder so buffer never stops
    const replacement = this.createAndStartSlot();
    if (targetSlotKey === 'A') {
      this.slotA = replacement;
    } else {
      this.slotB = replacement;
    }

    const blob = await this.finalizeSlot(slot);
    if (!blob || blob.size === 0) return null;

    return {
      blob,
      durationSec: Math.min(this.bufferWindowSec * 2, Number(elapsedSec.toFixed(1))),
    };
  }

  public stop(): void {
    this.running = false;
    if (this.rotationTimer !== null) {
      window.clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
    this.discardSlot(this.slotA);
    this.discardSlot(this.slotB);
    this.slotA = null;
    this.slotB = null;
  }

  private createAndStartSlot(): RecorderSlot {
    const options: MediaRecorderOptions = this.mimeType
      ? { mimeType: this.mimeType, videoBitsPerSecond: 4_500_000 }
      : { videoBitsPerSecond: 4_500_000 };

    const recorder = new MediaRecorder(this.stream, options);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };
    recorder.start(500);
    return {
      recorder,
      chunks,
      startedAt: Date.now(),
    };
  }

  private discardSlot(slot: RecorderSlot | null): void {
    if (!slot) return;
    try {
      if (slot.recorder.state !== 'inactive') {
        slot.recorder.stop();
      }
    } catch {
      // Ignore cleanup stop errors
    }
  }

  private finalizeSlot(slot: RecorderSlot): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (slot.recorder.state === 'inactive') {
        resolve(new Blob(slot.chunks, { type: this.mimeType || 'video/webm' }));
        return;
      }

      slot.recorder.onstop = () => {
        const blob = new Blob(slot.chunks, { type: this.mimeType || 'video/webm' });
        resolve(blob);
      };
      slot.recorder.onerror = () => resolve(null);
      try {
        slot.recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }
}

export async function exportTrimmedClipWithOverlays(options: {
  sourceUrl: string;
  trimStartSec: number;
  trimEndSec: number;
  aspectRatio: ExportAspectRatio;
  verticalLayout: VerticalLayoutMode;
  cropPanX: number;
  overlays: OverlayConfig;
  stingerOverride: BannerStingerType;
  wantedOverride: number;
  districtOverride: string;
  avatarImage: HTMLImageElement | null;
  onProgress: (pct: number) => void;
}): Promise<Blob> {
  const {
    sourceUrl,
    trimStartSec,
    trimEndSec,
    aspectRatio,
    verticalLayout,
    cropPanX,
    overlays,
    stingerOverride,
    wantedOverride,
    districtOverride,
    avatarImage,
    onProgress,
  } = options;

  const outW = aspectRatio === '9:16' ? 720 : 1280;
  const outH = aspectRatio === '9:16' ? 1280 : 720;

  const video = document.createElement('video');
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Could not decode source clip for export.'));
  });

  const safeStart = Math.max(0, trimStartSec);
  const safeEnd = Math.max(safeStart + 0.5, trimEndSec);
  const totalSpan = safeEnd - safeStart;

  video.currentTime = safeStart;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const stream = canvas.captureStream(30);
  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : { videoBitsPerSecond: 5_000_000 }
  );

  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const mergedOverlays: OverlayConfig = {
    ...overlays,
    activeStinger: stingerOverride,
    wantedLevel: wantedOverride,
    districtName: districtOverride,
  };

  return new Promise<Blob>((resolve, reject) => {
    let rafId = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(rafId);
      video.pause();
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      onProgress(100);
      resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
    };

    recorder.onerror = () => {
      finished = true;
      cancelAnimationFrame(rafId);
      reject(new Error('Recording export failed.'));
    };

    recorder.start(250);
    video.play().catch(reject);

    const tick = () => {
      if (finished) return;
      const elapsed = Math.max(0, video.currentTime - safeStart);
      const pct = Math.min(99, Math.round((elapsed / totalSpan) * 100));
      onProgress(pct);

      renderBroadcastFrame({
        ctx,
        width: outW,
        height: outH,
        timeSec: video.currentTime,
        scene: SCENE_PRESETS[0],
        sceneImage: null,
        avatarImage,
        videoElement: video,
        useVideoSource: true,
        overlays: mergedOverlays,
        cropPanX,
        splitFacecam: aspectRatio === '9:16' && verticalLayout === 'split-facecam',
      });

      if (video.currentTime >= safeEnd || video.ended) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
