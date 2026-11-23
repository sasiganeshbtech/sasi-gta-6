import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Film,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Smartphone,
  Monitor,
  Upload,
} from 'lucide-react';
import { renderBroadcastFrame } from '../lib/canvasOverlay';
import {
  exportTrimmedClipWithOverlays,
  formatDuration,
  triggerBlobDownload,
} from '../lib/replayBuffer';
import {
  BannerStingerType,
  ExportAspectRatio,
  LEONIDA_DISTRICTS,
  OverlayConfig,
  SCENE_PRESETS,
  STREAMER_AVATAR_PATH,
  SavedClip,
  VerticalLayoutMode,
} from '../types/studio';

interface ClipEditorViewProps {
  clips: SavedClip[];
  selectedClipId: string | null;
  onSelectClipId: (id: string) => void;
  onUpdateClip: (id: string, patch: Partial<SavedClip>) => void;
  overlays: OverlayConfig;
  onGoLive: () => void;
  onImportClipFile: (file: File) => void;
}

const STINGER_OPTIONS: BannerStingerType[] = [
  'none',
  'MISSION PASSED',
  'RESPECT +',
  'WASTED',
  'BUSTED',
];

export const ClipEditorView: React.FC<ClipEditorViewProps> = ({
  clips,
  selectedClipId,
  onSelectClipId,
  onUpdateClip,
  overlays,
  onGoLive,
  onImportClipFile,
}) => {
  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0] || null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load avatar image once for split-facecam / corner-cam previews
  useEffect(() => {
    const img = new Image();
    img.src = STREAMER_AVATAR_PATH;
    avatarImgRef.current = img;
  }, []);

  // Sync video element source when activeClip changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    setIsPlaying(false);
    setExportError(null);
    video.src = activeClip.blobUrl;
    video.load();

    const handleLoadedMetadata = () => {
      const dur =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : activeClip.durationSec;
      setVideoDuration(dur);
      const safeStart = Math.min(activeClip.trimStartSec, Math.max(0, dur - 0.5));
      video.currentTime = safeStart;
      setCurrentTime(safeStart);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [activeClip?.id, activeClip?.blobUrl]);

  // Continuous canvas render loop for live 16:9 / 9:16 + GTA 6 overlay preview
  useEffect(() => {
    if (!activeClip) return;
    let rafId = 0;

    const renderLoop = () => {
      const canvas = previewCanvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const targetW = activeClip.aspectRatio === '9:16' ? 540 : 960;
        const targetH = activeClip.aspectRatio === '9:16' ? 960 : 540;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderBroadcastFrame({
            ctx,
            width: targetW,
            height: targetH,
            timeSec: video.currentTime || 0,
            scene: SCENE_PRESETS[0],
            sceneImage: null,
            avatarImage: avatarImgRef.current,
            videoElement: video,
            useVideoSource: true,
            overlays: {
              ...overlays,
              activeStinger: activeClip.stinger,
              wantedLevel: activeClip.wantedLevel,
              showWantedStars: activeClip.wantedLevel > 0 && overlays.showWantedStars,
              districtName: activeClip.district,
            },
            cropPanX: activeClip.cropPanX,
            splitFacecam:
              activeClip.aspectRatio === '9:16' &&
              activeClip.verticalLayout === 'split-facecam',
          });
        }

        // Loop cleanly within [trimStartSec, trimEndSec]
        if (!video.paused) {
          setCurrentTime(video.currentTime);
          if (video.currentTime >= activeClip.trimEndSec) {
            video.currentTime = activeClip.trimStartSec;
          }
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [activeClip, overlays]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    if (video.paused) {
      if (video.currentTime < activeClip.trimStartSec || video.currentTime >= activeClip.trimEndSec) {
        video.currentTime = activeClip.trimStartSec;
      }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = t;
    setCurrentTime(t);
  };

  const handleExportRendered = async () => {
    if (!activeClip || exporting) return;
    setExporting(true);
    setExportPct(0);
    setExportError(null);

    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
      setIsPlaying(false);
    }

    try {
      const renderedBlob = await exportTrimmedClipWithOverlays({
        sourceUrl: activeClip.blobUrl,
        trimStartSec: activeClip.trimStartSec,
        trimEndSec: activeClip.trimEndSec,
        aspectRatio: activeClip.aspectRatio,
        verticalLayout: activeClip.verticalLayout,
        cropPanX: activeClip.cropPanX,
        overlays,
        stingerOverride: activeClip.stinger,
        wantedOverride: activeClip.wantedLevel,
        districtOverride: activeClip.district,
        avatarImage: avatarImgRef.current,
        onProgress: setExportPct,
      });

      const slug = activeClip.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const ratioTag = activeClip.aspectRatio === '9:16' ? '9x16-short' : '16x9';
      triggerBlobDownload(renderedBlob, `${slug || 'viceclip'}-${ratioTag}.webm`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  if (!activeClip) {
    return (
      <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-10 text-center max-w-xl mx-auto mt-8 space-y-4">
        <div className="h-12 w-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-300">
          <Scissors className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-semibold text-slate-100">
            No clips ready to edit
          </h2>
          <p className="text-sm text-slate-400">
            Capture a highlight from the Live Deck rolling buffer or import a gameplay video to trim and reframe for Shorts or YouTube.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onGoLive}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-colors cursor-pointer"
          >
            Go to Live Deck
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 transition-colors cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Import Video</span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportClipFile(f);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>
    );
  }

  const maxDur = Math.max(1, videoDuration || activeClip.durationSec);
  const trimLength = Math.max(0.5, activeClip.trimEndSec - activeClip.trimStartSec);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Hidden source video driving canvas preview */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* Left/Main Column: Aspect Ratio Preview + Timeline Trimmer */}
      <div className="xl:col-span-8 space-y-5">
        {/* Clip Selector & Aspect Switcher */}
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <label htmlFor="clip-select" className="text-xs font-medium text-slate-400 shrink-0">
              Active Clip
            </label>
            <select
              id="clip-select"
              value={activeClip.id}
              onChange={(e) => onSelectClipId(e.target.value)}
              className="bg-[#0B0E14] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-100 max-w-[260px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {clips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({formatDuration(c.durationSec)})
                </option>
              ))}
            </select>
          </div>

          <div
            role="group"
            aria-label="Export aspect ratio"
            className="flex items-center gap-1 p-1 bg-[#0B0E14] border border-white/[0.08] rounded-lg"
          >
            {(
              [
                ['16:9', '16:9 Landscape', Monitor],
                ['9:16', '9:16 Shorts / Reels', Smartphone],
              ] as [ExportAspectRatio, string, React.ComponentType<{ className?: string }>][]
            ).map(([ratio, label, Icon]) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onUpdateClip(activeClip.id, { aspectRatio: ratio })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeClip.aspectRatio === ratio
                    ? 'bg-rose-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview Stage */}
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="truncate font-medium text-slate-200">{activeClip.title}</span>
            <span className="font-mono tabular-nums whitespace-nowrap">
              {activeClip.aspectRatio === '9:16' ? '720×1280' : '1280×720'} · Trim {formatDuration(trimLength)}
            </span>
          </div>

          <div className="bg-[#080A0F] p-4 flex items-center justify-center min-h-[380px] max-h-[540px]">
            <canvas
              ref={previewCanvasRef}
              className={`rounded-lg border border-white/[0.08] bg-black ${
                activeClip.aspectRatio === '9:16'
                  ? 'h-[480px] w-auto aspect-[9/16]'
                  : 'w-full max-w-[820px] aspect-video'
              }`}
            />
          </div>

          {/* Interactive Timeline Scrubber & In/Out Handles */}
          <div className="p-4 border-t border-white/[0.06] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-white transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{isPlaying ? 'Pause' : 'Play Trim'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(activeClip.id, {
                      trimStartSec: Math.min(currentTime, Math.max(0, activeClip.trimEndSec - 0.5)),
                    })
                  }
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-[#0B0E14] border border-white/[0.08] hover:border-white/[0.2] text-slate-200 transition-colors cursor-pointer"
                >
                  Set In
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(activeClip.id, {
                      trimEndSec: Math.max(currentTime, Math.min(maxDur, activeClip.trimStartSec + 0.5)),
                    })
                  }
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-[#0B0E14] border border-white/[0.08] hover:border-white/[0.2] text-slate-200 transition-colors cursor-pointer"
                >
                  Set Out
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip(activeClip.id, {
                      trimStartSec: 0,
                      trimEndSec: maxDur,
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="font-mono text-xs tabular-nums text-slate-300">
                {formatDuration(currentTime)} / {formatDuration(maxDur)}
              </div>
            </div>

            {/* Playhead Scrub Bar */}
            <div className="space-y-2">
              <div className="relative h-7 bg-[#0B0E14] border border-white/[0.08] rounded-lg overflow-hidden">
                <div
                  className="absolute inset-y-0 bg-rose-500/20 border-x-2 border-rose-500 pointer-events-none"
                  style={{
                    left: `${(activeClip.trimStartSec / maxDur) * 100}%`,
                    width: `${((activeClip.trimEndSec - activeClip.trimStartSec) / maxDur) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={maxDur}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  aria-label="Timeline playhead"
                  className="studio-slider absolute inset-0 w-full h-full opacity-90 px-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Trim Start (In)</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {formatDuration(activeClip.trimStartSec)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, activeClip.trimEndSec - 0.5)}
                    step={0.1}
                    value={activeClip.trimStartSec}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateClip(activeClip.id, { trimStartSec: val });
                      handleSeek(val);
                    }}
                    aria-label="Trim start point"
                    className="studio-slider w-full"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Trim End (Out)</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {formatDuration(activeClip.trimEndSec)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(maxDur, activeClip.trimStartSec + 0.5)}
                    max={maxDur}
                    step={0.1}
                    value={activeClip.trimEndSec}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateClip(activeClip.id, { trimEndSec: val });
                    }}
                    aria-label="Trim end point"
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Framing, GTA 6 Clip Stinger & Export */}
      <div className="xl:col-span-4 space-y-5">
        <section className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Clip Details & Reframing
          </h2>

          <div className="space-y-1.5">
            <label htmlFor="clip-title-input" className="text-xs text-slate-400 block">
              Clip Title
            </label>
            <input
              id="clip-title-input"
              type="text"
              value={activeClip.title}
              onChange={(e) => onUpdateClip(activeClip.id, { title: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            />
          </div>

          {activeClip.aspectRatio === '9:16' && (
            <>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-400 block">Vertical Layout</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['crop-center', 'Full Gameplay'],
                      ['split-facecam', 'Split Facecam'],
                    ] as [VerticalLayoutMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateClip(activeClip.id, { verticalLayout: mode })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        activeClip.verticalLayout === mode
                          ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                          : 'bg-[#0B0E14] border-white/[0.08] text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Horizontal Crop Pan</span>
                  <span className="font-mono tabular-nums text-slate-300">
                    {Math.round(activeClip.cropPanX * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={activeClip.cropPanX}
                  onChange={(e) =>
                    onUpdateClip(activeClip.id, { cropPanX: Number(e.target.value) })
                  }
                  aria-label="Vertical crop horizontal pan"
                  className="studio-slider w-full"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
            <label htmlFor="clip-district-select" className="text-xs text-slate-400 block">
              Location Stamp
            </label>
            <select
              id="clip-district-select"
              value={activeClip.district}
              onChange={(e) => onUpdateClip(activeClip.id, { district: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {LEONIDA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-slate-400 block">Wanted Stars Overlay</span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onUpdateClip(activeClip.id, { wantedLevel: lvl })}
                  className={`flex-1 py-1.5 rounded-md font-mono text-xs tabular-nums border transition-colors cursor-pointer ${
                    activeClip.wantedLevel === lvl
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                      : 'bg-[#0B0E14] border-white/[0.08] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-slate-400 block">Banner Stinger</span>
            <div className="flex flex-wrap gap-1.5">
              {STINGER_OPTIONS.map((stinger) => (
                <button
                  key={stinger}
                  type="button"
                  onClick={() => onUpdateClip(activeClip.id, { stinger })}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    activeClip.stinger === stinger
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-[#0B0E14] border-white/[0.08] text-slate-300 hover:text-white'
                  }`}
                >
                  {stinger === 'none' ? 'None' : stinger}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Export Section */}
        <section className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Export Highlight
            </h2>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {activeClip.aspectRatio} · {formatDuration(trimLength)}
            </span>
          </div>

          {exportError && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
              {exportError}
            </div>
          )}

          {exporting && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Rendering overlays & trim...</span>
                <span className="font-mono tabular-nums">{exportPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#0B0E14] overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-[width] duration-150"
                  style={{ width: `${exportPct}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleExportRendered}
            disabled={exporting}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/40 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            <span>
              {exporting
                ? `Rendering (${exportPct}%)`
                : `Export ${activeClip.aspectRatio} WebM`}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerBlobDownload(
                activeClip.blob,
                `${activeClip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-raw.webm`
              )
            }
            className="w-full py-2 px-4 rounded-lg text-xs font-medium bg-[#0B0E14] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Film className="h-3.5 w-3.5" />
            <span>Download Raw Buffer Capture</span>
          </button>
        </section>
      </div>
    </div>
  );
};
