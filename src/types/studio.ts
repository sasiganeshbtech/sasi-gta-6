export type StudioTab = 'live' | 'editor' | 'library' | 'overlays';

export type StreamSourceType = 'leonida-feed' | 'screen' | 'camera' | 'local-video';

export type ScenePresetId = 'ocean-drive' | 'downtown-getaway' | 'port-gellhorn';

export type MomentCategory = 'Pursuit' | 'Heist' | 'Stunt' | 'Wasted' | 'Chat';

export type BannerStingerType =
  | 'none'
  | 'MISSION PASSED'
  | 'RESPECT +'
  | 'WASTED'
  | 'BUSTED';

export type ExportAspectRatio = '16:9' | '9:16';

export type VerticalLayoutMode = 'crop-center' | 'split-facecam';

export interface ScenePreset {
  id: ScenePresetId;
  title: string;
  district: string;
  imagePath: string;
  defaultWanted: number;
  baseSpeedMph: number;
  cashBalance: number;
}

export interface OverlayConfig {
  showWantedStars: boolean;
  wantedLevel: number;
  showDistrictCard: boolean;
  districtName: string;
  showTelemetryHud: boolean;
  showFacecam: boolean;
  facecamCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  streamerHandle: string;
  activeStinger: BannerStingerType;
  showMinimap: boolean;
}

export interface ClipMomentMarker {
  id: string;
  label: string;
  category: MomentCategory;
  timestampSec: number;
  createdAt: string;
}

export interface SavedClip {
  id: string;
  title: string;
  category: MomentCategory;
  district: string;
  createdAt: string;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  aspectRatio: ExportAspectRatio;
  verticalLayout: VerticalLayoutMode;
  cropPanX: number; // -1 to 1
  blob: Blob;
  blobUrl: string;
  thumbnailUrl: string;
  fileSizeBytes: number;
  wantedLevel: number;
  stinger: BannerStingerType;
  sourceLabel: string;
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'ocean-drive',
    title: 'Ocean Drive Cruise',
    district: 'Ocean Beach, Vice City',
    imagePath: '/src/assets/images/vice_ocean_drive_1795436768407.jpg',
    defaultWanted: 2,
    baseSpeedMph: 84,
    cashBalance: 142850,
  },
  {
    id: 'downtown-getaway',
    title: 'Downtown Intersection Drift',
    district: 'Downtown Vice City',
    imagePath: '/src/assets/images/leonida_heist_getaway_1795436767981.jpg',
    defaultWanted: 4,
    baseSpeedMph: 118,
    cashBalance: 389400,
  },
  {
    id: 'port-gellhorn',
    title: 'Grassrivers Harbor Escape',
    district: 'Port Gellhorn, Leonida',
    imagePath: '/src/assets/images/port_gellhorn_chopper_1795436770182.jpg',
    defaultWanted: 5,
    baseSpeedMph: 72,
    cashBalance: 615200,
  },
];

export const STREAMER_AVATAR_PATH = '/src/assets/images/streamer_avatar_1795436770237.jpg';

export const LEONIDA_DISTRICTS = [
  'Ocean Beach, Vice City',
  'Downtown Vice City',
  'Port Gellhorn, Leonida',
  'Grassrivers Wetlands',
  'Vice Keys Causeway',
  'Starfish Island',
];
