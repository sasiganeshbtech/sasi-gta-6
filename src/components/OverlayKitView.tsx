import React, { useEffect, useRef } from 'react';
import { renderBroadcastFrame } from '../lib/canvasOverlay';
import {
  BannerStingerType,
  LEONIDA_DISTRICTS,
  OverlayConfig,
  SCENE_PRESETS,
  STREAMER_AVATAR_PATH,
} from '../types/studio';

interface OverlayKitViewProps {
  overlays: OverlayConfig;
  onUpdateOverlays: (patch: Partial<OverlayConfig>) => void;
  onTriggerStinger: (stinger: BannerStingerType) => void;
}

const FACECAM_CORNERS: { id: OverlayConfig['facecamCorner']; label: string }[] = [
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

const STINGER_PRESETS: BannerStingerType[] = [
  'none',
  'MISSION PASSED',
  'RESPECT +',
  'WASTED',
  'BUSTED',
];

export const OverlayKitView: React.FC<OverlayKitViewProps> = ({
  overlays,
  onUpdateOverlays,
  onTriggerStinger,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneImgRef = useRef<HTMLImageElement | null>(null);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const sImg = new Image();
    sImg.src = SCENE_PRESETS[0].imagePath;
    sceneImgRef.current = sImg;

    const aImg = new Image();
    aImg.src = STREAMER_AVATAR_PATH;
    avatarImgRef.current = aImg;
  }, []);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();

    const loop = () => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const t = (performance.now() - start) / 1000;
          renderBroadcastFrame({
            ctx,
            width: 1280,
            height: 720,
            timeSec: t,
            scene: SCENE_PRESETS[0],
            sceneImage: sceneImgRef.current,
            avatarImage: avatarImgRef.current,
            videoElement: null,
            useVideoSource: false,
            overlays,
          });
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [overlays]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Live Overlay Preview */}
      <div className="xl:col-span-7 bg-[#131822] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-200">Broadcast HUD Live Preview</span>
          <span className="font-mono tabular-nums">1280×720 Overlay Layer</span>
        </div>
        <div className="aspect-video bg-[#080A0F]">
          <canvas
            ref={previewCanvasRef}
            width={1280}
            height={720}
            className="w-full h-full object-contain block"
          />
        </div>
      </div>

      {/* Overlay Controls */}
      <div className="xl:col-span-5 bg-[#131822] border border-white/[0.08] rounded-xl p-5 space-y-5">
        <h2 className="font-display text-base font-semibold text-slate-100">
          Leonida Broadcast Overlay Kit
        </h2>

        {/* Channel Handle */}
        <div className="space-y-1.5">
          <label htmlFor="overlay-handle" className="text-xs font-medium text-slate-300 block">
            Streamer Handle / Watermark
          </label>
          <input
            id="overlay-handle"
            type="text"
            value={overlays.streamerHandle}
            onChange={(e) => onUpdateOverlays({ streamerHandle: e.target.value })}
            placeholder="@ViceCityLive"
            className="w-full bg-[#0B0E14] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          />
        </div>

        {/* District Location */}
        <div className="space-y-1.5">
          <label htmlFor="overlay-district" className="text-xs font-medium text-slate-300 block">
            Leonida District Stamp
          </label>
          <select
            id="overlay-district"
            value={overlays.districtName}
            onChange={(e) => onUpdateOverlays({ districtName: e.target.value })}
            className="w-full bg-[#0B0E14] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {LEONIDA_DISTRICTS.map((dist) => (
              <option key={dist} value={dist}>
                {dist}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle switches */}
        <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
          <span className="text-xs font-medium text-slate-300 block">Active HUD Modules</span>
          {[
            ['showWantedStars', 'Wanted Stars Meter'] as const,
            ['showTelemetryHud', 'Cash & Speedometer Telemetry'] as const,
            ['showMinimap', 'Coastal Minimap Radar'] as const,
            ['showDistrictCard', 'District Location Stamp'] as const,
            ['showFacecam', 'Streamer Facecam Frame'] as const,
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between py-1.5 text-sm text-slate-200 cursor-pointer"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={overlays[key]}
                onChange={(e) => onUpdateOverlays({ [key]: e.target.checked })}
                className="h-4 w-4 accent-rose-500 rounded cursor-pointer"
              />
            </label>
          ))}
        </div>

        {/* Facecam Corner */}
        {overlays.showFacecam && (
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <span className="text-xs font-medium text-slate-300 block">Facecam Corner</span>
            <div className="grid grid-cols-2 gap-2">
              {FACECAM_CORNERS.map((corner) => (
                <button
                  key={corner.id}
                  type="button"
                  onClick={() => onUpdateOverlays({ facecamCorner: corner.id })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    overlays.facecamCorner === corner.id
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                      : 'bg-[#0B0E14] border-white/[0.08] text-slate-300 hover:text-white'
                  }`}
                >
                  {corner.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Banner Stinger */}
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <span className="text-xs font-medium text-slate-300 block">
            Stinger Banner Preview
          </span>
          <div className="flex flex-wrap gap-2">
            {STINGER_PRESETS.map((stinger) => (
              <button
                key={stinger}
                type="button"
                onClick={() => onTriggerStinger(stinger)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  overlays.activeStinger === stinger
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-[#0B0E14] border-white/[0.08] text-slate-300 hover:text-white'
                }`}
              >
                {stinger === 'none' ? 'None' : stinger}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
