import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ClipEditorView } from './components/ClipEditorView';
import { ClipLibraryView } from './components/ClipLibraryView';
import { LiveDeckView } from './components/LiveDeckView';
import { OverlayKitView } from './components/OverlayKitView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { playClipSavedChime, playStingerAudio } from './lib/audioStingers';
import { renderBroadcastFrame } from './lib/canvasOverlay';
import {
  RollingReplayBuffer,
  formatDuration,
  triggerBlobDownload,
} from './lib/replayBuffer';
import {
  BannerStingerType,
  ClipMomentMarker,
  MomentCategory,
  OverlayConfig,
  SCENE_PRESETS,
  STREAMER_AVATAR_PATH,
  SavedClip,
  ScenePreset,
  StreamSourceType,
  StudioTab,
} from './types/studio';

function generateThumbnailFromCanvas(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return '';
  }
}

async function extractVideoMetadata(
  blobUrl: string
): Promise<{ durationSec: number; thumbnailUrl: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = blobUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadeddata = () => {
      const durationSec =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
      const seekTarget = Math.min(1.0, durationSec * 0.25);
      video.currentTime = seekTarget;
    };

    video.onseeked = () => {
      let thumbnailUrl = '';
      try {
        const c = document.createElement('canvas');
        c.width = 480;
        c.height = 270;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, c.width, c.height);
          thumbnailUrl = c.toDataURL('image/jpeg', 0.8);
        }
      } catch {
        thumbnailUrl = '';
      }
      const durationSec =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
      cleanup();
      resolve({ durationSec, thumbnailUrl });
    };

    video.onerror = () => {
      cleanup();
      resolve({ durationSec: 10, thumbnailUrl: '' });
    };
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('live');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Stream Source State
  const [sourceType, setSourceType] = useState<StreamSourceType>('leonida-feed');
  const [activeScene, setActiveScene] = useState<ScenePreset>(SCENE_PRESETS[0]);
  const [isFeedPlaying, setIsFeedPlaying] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Local Uploaded Video State
  const [localVideoDuration, setLocalVideoDuration] = useState(0);
  const [localVideoTime, setLocalVideoTime] = useState(0);

  // Replay Buffer State
  const [bufferWindowSec, setBufferWindowSec] = useState(30);
  const [bufferFillSec, setBufferFillSec] = useState(0);
  const [bufferActive, setBufferActive] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // Overlays & HUD State
  const [overlays, setOverlays] = useState<OverlayConfig>({
    showWantedStars: true,
    wantedLevel: SCENE_PRESETS[0].defaultWanted,
    showDistrictCard: true,
    districtName: SCENE_PRESETS[0].district,
    showTelemetryHud: true,
    showFacecam: true,
    facecamCorner: 'top-left',
    streamerHandle: '@ViceCityLive',
    activeStinger: 'none',
    showMinimap: true,
  });

  // Clips & Markers
  const [markers, setMarkers] = useState<ClipMomentMarker[]>([]);
  const [clips, setClips] = useState<SavedClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Transient Notification Toast
  const [toast, setToast] = useState<{ message: string; clipId?: string } | null>(null);

  // DOM & Media Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const replayBufferRef = useRef<RollingReplayBuffer | null>(null);
  const sceneImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const flashAlphaRef = useRef(0);
  const streamTimeRef = useRef(0);

  // Preload generated images once
  useEffect(() => {
    SCENE_PRESETS.forEach((preset) => {
      const img = new Image();
      img.src = preset.imagePath;
      sceneImagesRef.current[preset.id] = img;
    });
    const avatar = new Image();
    avatar.src = STREAMER_AVATAR_PATH;
    avatarImageRef.current = avatar;
  }, []);

  // Create hidden source video element for screen / camera / local VOD
  useEffect(() => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    sourceVideoRef.current = v;

    return () => {
      v.pause();
      v.srcObject = null;
      v.removeAttribute('src');
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Initialize & run RollingReplayBuffer on the live broadcast canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.captureStream !== 'function') return;

    const stream = canvas.captureStream(30);
    const buffer = new RollingReplayBuffer(stream, bufferWindowSec);
    buffer.start();
    replayBufferRef.current = buffer;
    setBufferActive(true);

    const fillInterval = window.setInterval(() => {
      if (replayBufferRef.current) {
        setBufferFillSec(replayBufferRef.current.getElapsedFillSec());
      }
    }, 350);

    return () => {
      window.clearInterval(fillInterval);
      buffer.stop();
      replayBufferRef.current = null;
      setBufferActive(false);
    };
  }, []);

  // Sync bufferWindowSec changes
  useEffect(() => {
    replayBufferRef.current?.setBufferWindow(bufferWindowSec);
  }, [bufferWindowSec]);

  // Continuous broadcast canvas compositor loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      if (isFeedPlaying) {
        streamTimeRef.current += dt;
      }
      if (flashAlphaRef.current > 0) {
        flashAlphaRef.current = Math.max(0, flashAlphaRef.current - dt * 2.4);
      }

      const canvas = canvasRef.current;
      const sourceVideo = sourceVideoRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const useVideo = sourceType !== 'leonida-feed';
          renderBroadcastFrame({
            ctx,
            width: 1280,
            height: 720,
            timeSec: streamTimeRef.current,
            scene: activeScene,
            sceneImage: sceneImagesRef.current[activeScene.id] || null,
            avatarImage: avatarImageRef.current,
            videoElement: sourceVideo,
            useVideoSource: useVideo,
            overlays,
            flashAlpha: flashAlphaRef.current,
          });
        }
      }

      if (sourceType === 'local-video' && sourceVideo && !sourceVideo.paused) {
        setLocalVideoTime(sourceVideo.currentTime);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeScene, isFeedPlaying, overlays, sourceType]);

  // Auto-dismiss notification toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const stopActiveInputStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    const v = sourceVideoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      if (v.src && v.src.startsWith('blob:')) {
        URL.revokeObjectURL(v.src);
      }
      v.removeAttribute('src');
    }
    setLocalVideoDuration(0);
    setLocalVideoTime(0);
  }, []);

  const handleSelectSource = useCallback(
    async (nextSource: StreamSourceType) => {
      setSourceError(null);
      if (nextSource === 'leonida-feed') {
        stopActiveInputStream();
        setSourceType('leonida-feed');
        setIsFeedPlaying(true);
        return;
      }

      if (nextSource === 'screen') {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false,
          });
          stopActiveInputStream();
          mediaStreamRef.current = stream;
          const v = sourceVideoRef.current;
          if (v) {
            v.srcObject = stream;
            await v.play();
          }
          stream.getVideoTracks()[0]?.addEventListener('ended', () => {
            setSourceType('leonida-feed');
          });
          setSourceType('screen');
          setIsFeedPlaying(true);
        } catch {
          setSourceError(
            'Screen capture permission was cancelled or unavailable in this browser.'
          );
        }
        return;
      }

      if (nextSource === 'camera') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          stopActiveInputStream();
          mediaStreamRef.current = stream;
          const v = sourceVideoRef.current;
          if (v) {
            v.srcObject = stream;
            await v.play();
          }
          setSourceType('camera');
          setIsFeedPlaying(true);
        } catch {
          setSourceError(
            'Camera or capture card access was denied or no video device was detected.'
          );
        }
      }
    },
    [stopActiveInputStream]
  );

  const handleUploadVideoFile = useCallback(
    async (file: File) => {
      setSourceError(null);
      stopActiveInputStream();
      const url = URL.createObjectURL(file);
      const v = sourceVideoRef.current;
      if (v) {
        v.src = url;
        v.onloadedmetadata = () => {
          setLocalVideoDuration(Number.isFinite(v.duration) ? v.duration : 0);
        };
        try {
          await v.play();
        } catch {
          // Ignore autoplay restriction if triggered asynchronously
        }
      }
      setSourceType('local-video');
      setIsFeedPlaying(true);
    },
    [stopActiveInputStream]
  );

  const handleImportClipDirectly = useCallback(async (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    const { durationSec, thumbnailUrl } = await extractVideoMetadata(blobUrl);
    const cleanTitle = file.name.replace(/\.[^.]+$/, '') || 'Imported Gameplay Clip';

    const newClip: SavedClip = {
      id: `clip-${Date.now()}`,
      title: cleanTitle,
      category: 'Heist',
      district: 'Ocean Beach, Vice City',
      createdAt: new Date().toISOString(),
      durationSec,
      trimStartSec: 0,
      trimEndSec: durationSec,
      aspectRatio: '16:9',
      verticalLayout: 'crop-center',
      cropPanX: 0,
      blob: file,
      blobUrl,
      thumbnailUrl,
      fileSizeBytes: file.size,
      wantedLevel: 3,
      stinger: 'none',
      sourceLabel: 'Imported Video',
    };

    setClips((prev) => [newClip, ...prev]);
    setSelectedClipId(newClip.id);
    setActiveTab('editor');
    setToast({ message: `Imported "${cleanTitle}" into Clip Editor`, clipId: newClip.id });
  }, []);

  const handleToggleFeedPlay = useCallback(() => {
    const v = sourceVideoRef.current;
    setIsFeedPlaying((prev) => {
      const next = !prev;
      if (sourceType !== 'leonida-feed' && v) {
        if (next) v.play().catch(() => {});
        else v.pause();
      }
      return next;
    });
  }, [sourceType]);

  const handleSelectScene = useCallback((scene: ScenePreset) => {
    setActiveScene(scene);
    setOverlays((prev) => ({
      ...prev,
      wantedLevel: scene.defaultWanted,
      showWantedStars: scene.defaultWanted > 0,
      districtName: scene.district,
    }));
  }, []);

  const handleUpdateOverlays = useCallback((patch: Partial<OverlayConfig>) => {
    setOverlays((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleTriggerStinger = useCallback(
    (stinger: BannerStingerType) => {
      setOverlays((prev) => ({ ...prev, activeStinger: stinger }));
      if (stinger !== 'none') {
        playStingerAudio(stinger, muted);
      }
    },
    [muted]
  );

  const handleAddMarker = useCallback(
    (category: MomentCategory, label: string) => {
      const marker: ClipMomentMarker = {
        id: `m-${Date.now()}`,
        label,
        category,
        timestampSec: streamTimeRef.current,
        createdAt: new Date().toISOString(),
      };
      setMarkers((prev) => [marker, ...prev].slice(0, 20));
      if (category === 'Pursuit') {
        playStingerAudio('wanted', muted);
        setOverlays((prev) => ({
          ...prev,
          showWantedStars: true,
          wantedLevel: Math.min(5, Math.max(1, prev.wantedLevel + 1)),
        }));
      } else if (category === 'Wasted') {
        handleTriggerStinger('WASTED');
      } else if (category === 'Heist') {
        handleTriggerStinger('MISSION PASSED');
      }
    },
    [handleTriggerStinger, muted]
  );

  const handleCaptureClip = useCallback(async () => {
    if (capturing || !replayBufferRef.current) return;
    setCapturing(true);
    flashAlphaRef.current = 0.7;
    playClipSavedChime(muted);

    try {
      const result = await replayBufferRef.current.captureClip();
      const canvas = canvasRef.current;
      const thumbnailUrl = canvas ? generateThumbnailFromCanvas(canvas) : '';

      if (result && result.blob.size > 0) {
        const blobUrl = URL.createObjectURL(result.blob);
        const latestMarker = markers[0];
        const category: MomentCategory = latestMarker?.category || 'Pursuit';
        const titleBase =
          sourceType === 'leonida-feed' ? activeScene.title : 'Live Stream Highlight';
        const clipNumber = clips.length + 1;

        const saved: SavedClip = {
          id: `clip-${Date.now()}`,
          title: `${titleBase} #${clipNumber}`,
          category,
          district: overlays.districtName || activeScene.district,
          createdAt: new Date().toISOString(),
          durationSec: result.durationSec,
          trimStartSec: 0,
          trimEndSec: result.durationSec,
          aspectRatio: '16:9',
          verticalLayout: 'crop-center',
          cropPanX: 0,
          blob: result.blob,
          blobUrl,
          thumbnailUrl,
          fileSizeBytes: result.blob.size,
          wantedLevel: overlays.wantedLevel,
          stinger: overlays.activeStinger,
          sourceLabel:
            sourceType === 'leonida-feed' ? activeScene.title : 'Live Stream Capture',
        };

        setClips((prev) => [saved, ...prev]);
        setSelectedClipId((prevId) => prevId || saved.id);
        setToast({
          message: `Saved ${formatDuration(saved.durationSec)} clip to library`,
          clipId: saved.id,
        });
      }
    } finally {
      setCapturing(false);
    }
  }, [activeScene, capturing, clips.length, markers, muted, overlays, sourceType]);

  // Global keyboard shortcuts (C = Save Clip, M = Drop Marker)
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      if (ev.key.toLowerCase() === 'c') {
        ev.preventDefault();
        handleCaptureClip();
      } else if (ev.key.toLowerCase() === 'm') {
        ev.preventDefault();
        handleAddMarker('Stunt', 'Manual Highlight');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAddMarker, handleCaptureClip]);

  const handleUpdateClip = useCallback((id: string, patch: Partial<SavedClip>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const handleDeleteClip = useCallback(
    (id: string) => {
      setClips((prev) => {
        const target = prev.find((c) => c.id === id);
        if (target?.blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(target.blobUrl);
        }
        return prev.filter((c) => c.id !== id);
      });
      if (selectedClipId === id) {
        setSelectedClipId(null);
      }
    },
    [selectedClipId]
  );

  const handleDownloadClip = useCallback((clip: SavedClip) => {
    const slug = clip.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    triggerBlobDownload(clip.blob, `${slug || 'viceclip'}.webm`);
  }, []);

  const handleEditClip = useCallback((clipId: string) => {
    setSelectedClipId(clipId);
    setActiveTab('editor');
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        clipCount={clips.length}
        bufferActive={bufferActive}
        streamerHandle={overlays.streamerHandle}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onCaptureClip={handleCaptureClip}
          capturing={capturing}
          bufferActive={bufferActive}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {/* Keep LiveDeckView mounted so the rolling MediaRecorder buffer stays continuous */}
          <div className={activeTab === 'live' ? 'block' : 'hidden'}>
            <LiveDeckView
              canvasRef={canvasRef}
              sourceType={sourceType}
              onSelectSource={handleSelectSource}
              onUploadVideoFile={handleUploadVideoFile}
              activeScene={activeScene}
              onSelectScene={handleSelectScene}
              isFeedPlaying={isFeedPlaying}
              onToggleFeedPlay={handleToggleFeedPlay}
              bufferWindowSec={bufferWindowSec}
              onChangeBufferWindow={setBufferWindowSec}
              bufferFillSec={bufferFillSec}
              bufferActive={bufferActive}
              capturing={capturing}
              onCaptureClip={handleCaptureClip}
              muted={muted}
              onToggleMuted={() => setMuted((m) => !m)}
              overlays={overlays}
              onUpdateOverlays={handleUpdateOverlays}
              onTriggerStinger={handleTriggerStinger}
              markers={markers}
              onAddMarker={handleAddMarker}
              recentClips={clips}
              onEditClip={handleEditClip}
              onDownloadClip={handleDownloadClip}
              sourceError={sourceError}
              localVideoDuration={localVideoDuration}
              localVideoTime={localVideoTime}
              onSeekLocalVideo={(sec) => {
                if (sourceVideoRef.current) {
                  sourceVideoRef.current.currentTime = sec;
                  setLocalVideoTime(sec);
                }
              }}
            />
          </div>

          {activeTab === 'editor' && (
            <ClipEditorView
              clips={clips}
              selectedClipId={selectedClipId}
              onSelectClipId={setSelectedClipId}
              onUpdateClip={handleUpdateClip}
              overlays={overlays}
              onGoLive={() => setActiveTab('live')}
              onImportClipFile={handleImportClipDirectly}
            />
          )}

          {activeTab === 'library' && (
            <ClipLibraryView
              clips={clips}
              onEditClip={handleEditClip}
              onDownloadClip={handleDownloadClip}
              onDeleteClip={handleDeleteClip}
              onGoLive={() => setActiveTab('live')}
              onImportClipFile={handleImportClipDirectly}
            />
          )}

          {activeTab === 'overlays' && (
            <OverlayKitView
              overlays={overlays}
              onUpdateOverlays={handleUpdateOverlays}
              onTriggerStinger={handleTriggerStinger}
            />
          )}
        </main>
      </div>

      {/* Non-intrusive Clip Saved Notification Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-[#181F2C] border border-white/[0.14] rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 max-w-sm"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-slate-100">{toast.message}</span>
          {toast.clipId && (
            <button
              type="button"
              onClick={() => {
                const id = toast.clipId!;
                setToast(null);
                handleEditClip(id);
              }}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 whitespace-nowrap shrink-0 ml-1 cursor-pointer"
            >
              Trim Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
