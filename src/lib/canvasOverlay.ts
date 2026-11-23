import {
  BannerStingerType,
  OverlayConfig,
  ScenePreset,
} from '../types/studio';

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  timeSec: number;
  scene: ScenePreset;
  sceneImage: HTMLImageElement | null;
  avatarImage: HTMLImageElement | null;
  videoElement: HTMLVideoElement | null;
  useVideoSource: boolean;
  overlays: OverlayConfig;
  cropPanX?: number; // -1 to 1 when drawing 9:16
  splitFacecam?: boolean;
  flashAlpha?: number;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  filled: boolean
): void {
  const spikes = 5;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();

  if (filled) {
    ctx.fillStyle = '#FB7185';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFF1F2';
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();
  }
}

function drawCoverMedia(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  srcW: number,
  srcH: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  panX = 0,
  zoom = 1
): void {
  if (!srcW || !srcH) return;
  const targetRatio = dw / dh;
  const sourceRatio = srcW / srcH;

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (sourceRatio > targetRatio) {
    sw = srcH * targetRatio;
    const maxOffset = srcW - sw;
    sx = maxOffset * (0.5 + panX * 0.5);
  } else {
    sh = srcW / targetRatio;
    sy = (srcH - sh) * 0.5;
  }

  if (zoom > 1) {
    const zoomedW = sw / zoom;
    const zoomedH = sh / zoom;
    sx += (sw - zoomedW) * 0.5;
    sy += (sh - zoomedH) * 0.5;
    sw = zoomedW;
    sh = zoomedH;
  }

  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
}

export function renderBroadcastFrame(params: RenderFrameParams): void {
  const {
    ctx,
    width,
    height,
    timeSec,
    scene,
    sceneImage,
    avatarImage,
    videoElement,
    useVideoSource,
    overlays,
    cropPanX = 0,
    splitFacecam = false,
    flashAlpha = 0,
  } = params;

  ctx.save();
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, width, height);

  const isVertical = height > width;
  const gameplayY = isVertical && splitFacecam ? Math.round(height * 0.34) : 0;
  const gameplayH = isVertical && splitFacecam ? height - gameplayY : height;

  // 1. Base Gameplay Frame (Live Video or Simulated Leonida Feed)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, gameplayY, width, gameplayH);
  ctx.clip();

  if (useVideoSource && videoElement && videoElement.readyState >= 2) {
    const vw = videoElement.videoWidth || 1280;
    const vh = videoElement.videoHeight || 720;
    drawCoverMedia(ctx, videoElement, vw, vh, 0, gameplayY, width, gameplayH, cropPanX, 1);
  } else if (sceneImage && sceneImage.complete && sceneImage.naturalWidth > 0) {
    // Subtle kinetic motion so the live stream canvas looks alive & records crisp motion
    const panOsc = Math.sin(timeSec * 0.35) * 0.12;
    const zoomOsc = 1.04 + Math.sin(timeSec * 0.55) * 0.025;
    const effectivePan = isVertical ? Math.max(-1, Math.min(1, cropPanX + panOsc * 0.35)) : panOsc;
    drawCoverMedia(
      ctx,
      sceneImage,
      sceneImage.naturalWidth,
      sceneImage.naturalHeight,
      0,
      gameplayY,
      width,
      gameplayH,
      effectivePan,
      zoomOsc
    );
  } else {
    const fallbackGrad = ctx.createLinearGradient(0, gameplayY, width, gameplayY + gameplayH);
    fallbackGrad.addColorStop(0, '#1B1626');
    fallbackGrad.addColorStop(0.55, '#331D2C');
    fallbackGrad.addColorStop(1, '#111622');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(0, gameplayY, width, gameplayH);
  }

  // Subtle top/bottom vignette scrim for HUD legibility (4.5:1+ contrast)
  const topScrim = ctx.createLinearGradient(0, gameplayY, 0, gameplayY + Math.min(180, gameplayH * 0.35));
  topScrim.addColorStop(0, 'rgba(7, 10, 16, 0.72)');
  topScrim.addColorStop(1, 'rgba(7, 10, 16, 0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, gameplayY, width, Math.min(180, gameplayH * 0.35));

  const botScrim = ctx.createLinearGradient(0, gameplayY + gameplayH - 170, 0, gameplayY + gameplayH);
  botScrim.addColorStop(0, 'rgba(7, 10, 16, 0)');
  botScrim.addColorStop(1, 'rgba(7, 10, 16, 0.78)');
  ctx.fillStyle = botScrim;
  ctx.fillRect(0, gameplayY + gameplayH - 170, width, 170);

  // Police pursuit light wash when wantedLevel >= 3
  if (overlays.showWantedStars && overlays.wantedLevel >= 3) {
    const pulse = Math.sin(timeSec * 8);
    const sirenColor = pulse > 0 ? 'rgba(244, 63, 94, 0.09)' : 'rgba(56, 189, 248, 0.08)';
    ctx.fillStyle = sirenColor;
    ctx.fillRect(0, gameplayY, width, gameplayH);
  }

  ctx.restore();

  // 2. Split-Screen Top Facecam for 9:16 Shorts if enabled
  if (isVertical && splitFacecam) {
    const camH = gameplayY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, camH);
    ctx.clip();

    if (avatarImage && avatarImage.complete && avatarImage.naturalWidth > 0) {
      drawCoverMedia(
        ctx,
        avatarImage,
        avatarImage.naturalWidth,
        avatarImage.naturalHeight,
        0,
        0,
        width,
        camH,
        0,
        1.02
      );
    } else {
      ctx.fillStyle = '#151B26';
      ctx.fillRect(0, 0, width, camH);
    }

    // Divider hairline between facecam and gameplay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(0, camH - 2, width, 2);
    ctx.restore();
  }

  // 3. Standard Corner Facecam (when not using split-facecam top bar)
  if (overlays.showFacecam && !(isVertical && splitFacecam)) {
    const camW = isVertical ? Math.round(width * 0.34) : Math.round(width * 0.19);
    const camH = Math.round(camW * 0.72);
    const pad = isVertical ? 20 : 28;
    let cx = pad;
    let cy = gameplayY + pad;

    if (overlays.facecamCorner === 'top-right') {
      cx = width - camW - pad;
      cy = gameplayY + pad;
    } else if (overlays.facecamCorner === 'bottom-left') {
      cx = pad;
      cy = height - camH - pad - (overlays.showMinimap && !isVertical ? 140 : 0);
    } else if (overlays.facecamCorner === 'bottom-right') {
      cx = width - camW - pad;
      cy = height - camH - pad;
    }

    ctx.save();
    drawRoundedRectPath(ctx, cx, cy, camW, camH, 10);
    ctx.clip();
    if (avatarImage && avatarImage.complete && avatarImage.naturalWidth > 0) {
      drawCoverMedia(
        ctx,
        avatarImage,
        avatarImage.naturalWidth,
        avatarImage.naturalHeight,
        cx,
        cy,
        camW,
        camH,
        0,
        1.04
      );
    } else {
      ctx.fillStyle = '#171E2C';
      ctx.fillRect(cx, cy, camW, camH);
    }
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, cx, cy, camW, camH, 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
    ctx.stroke();

    // Small handle label inside bottom of facecam
    if (overlays.streamerHandle.trim()) {
      const label = overlays.streamerHandle.trim();
      ctx.font = `600 ${isVertical ? 12 : 13}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = 'rgba(11, 14, 20, 0.78)';
      ctx.fillRect(cx, cy + camH - 24, camW, 24);
      ctx.fillStyle = '#F8FAFC';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + 10, cy + camH - 12);
    }
    ctx.restore();
  }

  // 4. Wanted Level Stars (Top Right)
  if (overlays.showWantedStars) {
    const starPadRight = isVertical ? 22 : 30;
    const starTop = gameplayY + (isVertical ? 26 : 30);
    const spacing = isVertical ? 26 : 30;
    const starOuter = isVertical ? 9.5 : 11;
    const starInner = isVertical ? 4.2 : 4.8;
    const isFlashing = overlays.wantedLevel > 0 && Math.sin(timeSec * 6) > -0.25;

    for (let i = 0; i < 5; i++) {
      const starIndexFromLeft = 4 - i;
      const sx = width - starPadRight - i * spacing;
      const filled = starIndexFromLeft < overlays.wantedLevel && isFlashing;
      drawStar(ctx, sx, starTop, starOuter, starInner, filled);
    }
  }

  // 5. Telemetry HUD (Cash + Speed + Time) under Wanted Stars
  if (overlays.showTelemetryHud) {
    const rightX = width - (isVertical ? 20 : 28);
    const baseY = gameplayY + (overlays.showWantedStars ? 56 : 30);
    const liveCash = scene.cashBalance + Math.floor(timeSec * 12) * 5;
    const liveSpeed = Math.max(
      18,
      Math.round(scene.baseSpeedMph + Math.sin(timeSec * 1.9) * 14 + Math.cos(timeSec * 0.7) * 6)
    );

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${isVertical ? 18 : 22}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#4ADE80';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 6;
    ctx.fillText(`$${liveCash.toLocaleString('en-US')}`, rightX, baseY);

    ctx.font = `600 ${isVertical ? 13 : 14}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(`${liveSpeed} MPH`, rightX, baseY + (isVertical ? 24 : 28));
    ctx.restore();
  }

  // 6. Minimap Radar (Bottom Left)
  if (overlays.showMinimap) {
    const mapW = isVertical ? 132 : 188;
    const mapH = isVertical ? 84 : 114;
    const mx = isVertical ? 18 : 28;
    const my = height - mapH - (isVertical ? 22 : 26);

    ctx.save();
    drawRoundedRectPath(ctx, mx, my, mapW, mapH, 6);
    ctx.fillStyle = 'rgba(13, 18, 28, 0.82)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.stroke();

    ctx.clip();
    // Stylized Leonida grid roads inside minimap
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 2;
    const drift = (timeSec * 18) % 36;
    for (let gx = -36; gx < mapW + 36; gx += 36) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, mapH);
      ctx.stroke();
    }
    for (let gy = -36; gy < mapH + 36; gy += 36) {
      ctx.beginPath();
      ctx.moveTo(mx, my + gy + drift);
      ctx.lineTo(mx + mapW, my + gy + drift);
      ctx.stroke();
    }

    // Main coastal route line
    ctx.strokeStyle = '#FB7185';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx + 14, my + mapH - 12);
    ctx.lineTo(mx + mapW * 0.45, my + mapH * 0.55);
    ctx.lineTo(mx + mapW - 22, my + 18);
    ctx.stroke();

    // Player chevron
    const px = mx + mapW * 0.45;
    const py = my + mapH * 0.55;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(px, py - 7);
    ctx.lineTo(px + 6, py + 6);
    ctx.lineTo(px, py + 3);
    ctx.lineTo(px - 6, py + 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // 7. District Location Card (Bottom Right or Above Minimap)
  if (overlays.showDistrictCard && overlays.districtName.trim()) {
    const dx = isVertical ? width - 20 : width - 28;
    const dy = height - (isVertical ? 26 : 30);

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 8;

    ctx.font = `700 ${isVertical ? 17 : 22}px "Outfit", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(overlays.districtName.trim(), dx, dy);

    if (overlays.streamerHandle.trim() && !overlays.showFacecam) {
      ctx.font = `500 ${isVertical ? 12 : 13}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FDA4AF';
      ctx.fillText(overlays.streamerHandle.trim(), dx, dy - (isVertical ? 24 : 28));
    }
    ctx.restore();
  }

  // 8. Active Banner Stinger (MISSION PASSED / WASTED / BUSTED / RESPECT +)
  if (overlays.activeStinger !== 'none') {
    drawStingerBanner(ctx, width, gameplayY + gameplayH * 0.5, overlays.activeStinger, isVertical);
  }

  // 9. Capture Flash feedback
  if (flashAlpha > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, flashAlpha)})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

function drawStingerBanner(
  ctx: CanvasRenderingContext2D,
  width: number,
  centerY: number,
  stinger: Exclude<BannerStingerType, 'none'>,
  isVertical: boolean
): void {
  const bandH = isVertical ? 96 : 116;
  ctx.save();

  ctx.fillStyle = 'rgba(7, 10, 16, 0.82)';
  ctx.fillRect(0, centerY - bandH / 2, width, bandH);

  const isNegative = stinger === 'WASTED' || stinger === 'BUSTED';
  const accent = isNegative ? '#EF4444' : '#FBBF24';

  ctx.fillStyle = accent;
  ctx.fillRect(0, centerY - bandH / 2, width, 2);
  ctx.fillRect(0, centerY + bandH / 2 - 2, width, 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${isVertical ? 34 : 48}px "Outfit", sans-serif`;
  ctx.fillStyle = accent;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 12;
  ctx.fillText(stinger, width / 2, centerY - 6);

  ctx.font = `500 ${isVertical ? 12 : 14}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#E2E8F0';
  const subtitle = isNegative
    ? 'Highlight clipped from live Leonida broadcast'
    : 'Leonida Stream Highlight · +1,500 RP';
  ctx.fillText(subtitle, width / 2, centerY + (isVertical ? 24 : 28));

  ctx.restore();
}
