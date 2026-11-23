import React, { useRef } from 'react';
import {
  Camera,
  Download,
  Film,
  Flag,
  Monitor,
  Pause,
  Play,
  Scissors,
  Sparkles,
  Star,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../lib/replayBuffer';
import {
  BannerStingerType,
  ClipMomentMarker,
  MomentCategory,
  OverlayConfig,
  SCENE_PRESETS,
  SavedClip,
  ScenePreset,
  StreamSourceType,
} from '../types/studio';

interface LiveDeckViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  sourceType: StreamSourceType;
  onSelectSource: (source: StreamSourceType) => void;
  onUploadVideoFile: (file: File) => void;
  activeScene: ScenePreset;
  onSelectScene: (scene: ScenePreset) => void;
  isFeedPlaying: boolean;
  onToggleFeedPlay: () => void;
  bufferWindowSec: number;
  onChangeBufferWindow: (sec: number) => void;
  bufferFillSec: number;
  bufferActive: boolean;
  capturing: boolean;
  onCaptureClip: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  overlays: OverlayConfig;
  onUpdateOverlays: (patch: Partial<OverlayConfig>) => void;
  onTriggerStinger: (stinger: BannerStingerType) => void;
  markers: ClipMomentMarker[];
  onAddMarker: (category: MomentCategory, label: string) => void;
  recentClips: SavedClip[];
  onEditClip: (clipId: string) => void;
  onDownloadClip: (clip: SavedClip) => void;
  sourceError: string | null;
  localVideoDuration: number;
  localVideoTime: number;
  onSeekLocalVideo: (timeSec: number) => void;
}

const MOMENT_ACTIONS: { category: MomentCategory; label: string }[] = [
  { category: 'Pursuit', label: 'Wanted Spike' },
  { category: 'Heist', label: 'Heist Escape' },
  { category: 'Stunt', label: 'Stunt Jump' },
  { category: 'Wasted', label: 'Wasted Moment' },
  { category: 'Chat', label: 'Chat Reaction' },
];

const STINGER_BUTTONS: BannerStingerType[] = [
  'MISSION PASSED',
  'RESPECT +',
  'WASTED',
  'BUSTED',
];

export const LiveDeckView: React.FC<LiveDeckViewProps> = ({
  canvasRef,
  sourceType,
  onSelectSource,
  onUploadVideoFile,
  activeScene,
  onSelectScene,
  isFeedPlaying,
  onToggleFeedPlay,
  bufferWindowSec,
  onChangeBufferWindow,
  bufferFillSec,
  bufferActive,
  capturing,
  onCaptureClip,
  muted,
  onToggleMuted,
  overlays,
  onUpdateOverlays,
  onTriggerStinger,
  markers,
  onAddMarker,
  recentClips,
  onEditClip,
  onDownloadClip,
  sourceError,
  localVideoDuration,
  localVideoTime,
  onSeekLocalVideo,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fillPct = Math.min(100, Math.round((bufferFillSec / bufferWindowSec) * 100));

  const sourceLabel =
    sourceType === 'leonida-feed'
      ? activeScene.title
      : sourceType === 'screen'
        ? 'Screen Capture'
        : sourceType === 'camera'
          ? 'Camera / Capture Card'
          : 'Uploaded Video';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left/Main Column: Stream Monitor & Replay Buffer Timeline */}
      <div className="xl:col-span-8 space-y-5">
        {/* Source Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131822] border border-white/[0.08] rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectSource('leonida-feed')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceType === 'leonida-feed'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              <span>Leonida Feed</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSource('screen')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceType === 'screen'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Capture Screen</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSource('camera')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceType === 'camera'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Capture Card</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceType === 'local-video'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Video</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadVideoFile(file);
                e.currentTarget.value = '';
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleFeedPlay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isFeedPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isFeedPlaying ? 'Pause' : 'Resume'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleMuted}
              aria-label={muted ? 'Unmute studio stingers' : 'Mute studio stingers'}
              className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {sourceError && (
          <div
            role="alert"
            className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-200"
          >
            {sourceError}
          </div>
        )}

        {/* Primary Broadcast Monitor Canvas */}
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              {bufferActive && (
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full bg-rose-500 shrink-0"
                />
              )}
              <span className="font-medium text-slate-200">
                {bufferActive ? 'Recording buffer' : 'Buffer paused'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{sourceLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">1280×720 · 30 fps</span>
            </div>
            <span className="truncate text-slate-400">{overlays.districtName}</span>
          </div>

          <div className="relative aspect-video bg-[#080A0F] w-full">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-contain block"
            />
          </div>

          {/* Local VOD scrubber when a user uploads a video */}
          {sourceType === 'local-video' && localVideoDuration > 0 && (
            <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-4">
              <span className="font-mono text-xs tabular-nums text-slate-300 whitespace-nowrap">
                {formatDuration(localVideoTime)}
              </span>
              <input
                type="range"
                min={0}
                max={localVideoDuration}
                step={0.1}
                value={localVideoTime}
                onChange={(e) => onSeekLocalVideo(Number(e.target.value))}
                aria-label="Seek uploaded video"
                className="studio-slider flex-1"
              />
              <span className="font-mono text-xs tabular-nums text-slate-400 whitespace-nowrap">
                {formatDuration(localVideoDuration)}
              </span>
            </div>
          )}

          {/* Replay Buffer Timeline Strip */}
          <div className="px-4 py-4 border-t border-white/[0.06] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-slate-100">
                  Rolling Replay Buffer
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  {formatDuration(bufferFillSec)} / {formatDuration(bufferWindowSec)} buffered ({fillPct}%)
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  role="group"
                  aria-label="Replay buffer duration"
                  className="flex items-center gap-1 p-1 bg-[#0B0E14] border border-white/[0.08] rounded-lg"
                >
                  {[15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onChangeBufferWindow(sec)}
                      className={`px-2.5 py-1 rounded-md font-mono text-xs tabular-nums transition-colors cursor-pointer ${
                        bufferWindowSec === sec
                          ? 'bg-white/[0.12] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onCaptureClip}
                  disabled={capturing || !bufferActive}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/40 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {capturing ? 'Capturing...' : `Save Last ${bufferWindowSec}s`}
                </button>
              </div>
            </div>

            {/* Visual Buffer Bar with Moment Marker Ticks */}
            <div className="relative h-2.5 w-full rounded-full bg-[#0B0E14] overflow-hidden border border-white/[0.06]">
              <div
                className="h-full bg-rose-500 transition-[width] duration-300"
                style={{ width: `${fillPct}%` }}
              />
            </div>

            {markers.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                <span className="text-slate-300 font-medium">Latest markers:</span>
                {markers.slice(0, 4).map((m) => (
                  <span key={m.id} className="font-mono tabular-nums">
                    {m.label} ({formatDuration(m.timestampSec)})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leonida Feed Scene Selector (when built-in feed is active) */}
        {sourceType === 'leonida-feed' && (
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Leonida Stream Feed Scenes
              </h2>
              <span className="text-xs text-slate-400">
                Switch active gameplay backdrop
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SCENE_PRESETS.map((scene) => {
                const selected = scene.id === activeScene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => onSelectScene(scene)}
                    className={`group text-left rounded-lg overflow-hidden border transition-colors cursor-pointer ${
                      selected
                        ? 'border-rose-500 bg-rose-500/10'
                        : 'border-white/[0.08] bg-[#0B0E14] hover:border-white/[0.2]'
                    }`}
                  >
                    <div className="aspect-video w-full overflow-hidden bg-slate-900">
                      <img
                        src={scene.imagePath}
                        alt={scene.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {scene.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {scene.district} · {scene.defaultWanted} Stars
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Live Moment Tagging, HUD Controls & Recent Clips */}
      <div className="xl:col-span-4 space-y-5">
        {/* Quick Moment Tagging */}
        <section className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Tag Stream Moment
            </h2>
            <span className="text-xs text-slate-400">Hotkey M</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MOMENT_ACTIONS.map((action) => (
              <button
                key={action.category}
                type="button"
                onClick={() => onAddMarker(action.category, action.label)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium bg-[#0B0E14] hover:bg-white/[0.06] border border-white/[0.08] text-slate-200 transition-colors cursor-pointer text-left"
              >
                <Flag className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Live Broadcast HUD Quick Controls */}
        <section className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Live HUD Triggers
          </h2>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Wanted Level</span>
              <span className="font-mono tabular-nums text-slate-400">
                {overlays.wantedLevel} / 5
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() =>
                    onUpdateOverlays({
                      wantedLevel: lvl,
                      showWantedStars: lvl > 0,
                    })
                  }
                  aria-label={`Set wanted level ${lvl}`}
                  className={`flex-1 py-1.5 rounded-md text-xs font-mono tabular-nums flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                    overlays.wantedLevel === lvl
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                      : 'bg-[#0B0E14] border-white/[0.08] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl === 0 ? (
                    <span>0</span>
                  ) : (
                    <>
                      <span>{lvl}</span>
                      <Star className="h-3 w-3 fill-current" />
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Flash Banner Stinger</span>
              {overlays.activeStinger !== 'none' && (
                <button
                  type="button"
                  onClick={() => onTriggerStinger('none')}
                  className="text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STINGER_BUTTONS.map((stinger) => {
                const active = overlays.activeStinger === stinger;
                return (
                  <button
                    key={stinger}
                    type="button"
                    onClick={() => onTriggerStinger(active ? 'none' : stinger)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap truncate cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-[#0B0E14] border-white/[0.08] text-slate-300 hover:border-white/[0.2]'
                    }`}
                  >
                    {stinger}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Recent Captured Clips */}
        <section className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Recent Captures
            </h2>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {recentClips.length} saved
            </span>
          </div>

          {recentClips.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <Sparkles className="h-5 w-5 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
                Click Save Clip or press C to capture the rolling replay buffer into your clip bin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {recentClips.slice(0, 4).map((clip) => (
                <div key={clip.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
                  <div className="h-12 w-20 rounded-md overflow-hidden bg-slate-900 shrink-0 border border-white/[0.06]">
                    {clip.thumbnailUrl ? (
                      <img
                        src={clip.thumbnailUrl}
                        alt={clip.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-500">
                        <Film className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {clip.title}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate mt-0.5">
                      {formatDuration(clip.trimEndSec - clip.trimStartSec)} · {formatBytes(clip.fileSizeBytes)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditClip(clip.id)}
                      aria-label={`Trim and edit ${clip.title}`}
                      className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      <Scissors className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownloadClip(clip)}
                      aria-label={`Download ${clip.title}`}
                      className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
