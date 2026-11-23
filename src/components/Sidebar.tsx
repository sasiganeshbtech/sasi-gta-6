import React from 'react';
import {
  Film,
  FolderKanban,
  Layers,
  Radio,
  Scissors,
  X,
} from 'lucide-react';
import { STREAMER_AVATAR_PATH, StudioTab } from '../types/studio';

interface SidebarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  clipCount: number;
  bufferActive: boolean;
  streamerHandle: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'live', label: 'Live Deck', icon: Radio },
  { id: 'editor', label: 'Clip Editor', icon: Scissors },
  { id: 'library', label: 'Clip Library', icon: FolderKanban },
  { id: 'overlays', label: 'Overlay Kit', icon: Layers },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  clipCount,
  bufferActive,
  streamerHandle,
  mobileOpen,
  onCloseMobile,
}) => {
  const navContent = (
    <div className="flex h-full flex-col bg-[#0E121A] border-r border-white/[0.08]">
      {/* Brand Wordmark (single text element) */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/[0.08]">
        <a
          href="#live"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('live');
            onCloseMobile();
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
        >
          ViceClip Studio
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Workspace navigation" className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isActive
                  ? 'bg-rose-500/12 text-rose-200 border border-rose-500/30'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-rose-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'library' && (
                <span className="font-mono text-xs tabular-nums text-slate-400 ml-2">
                  {clipCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Keyboard Shortcut Guide & Streamer Profile */}
      <div className="px-4 py-4 border-t border-white/[0.08] space-y-4">
        <div className="space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>Capture clip</span>
            <kbd className="font-mono text-[11px] text-slate-200 bg-white/[0.06] px-1.5 py-0.5 rounded">
              C
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span>Drop marker</span>
            <kbd className="font-mono text-[11px] text-slate-200 bg-white/[0.06] px-1.5 py-0.5 rounded">
              M
            </kbd>
          </div>
        </div>

        <div className="pt-3 border-t border-white/[0.06] flex items-center gap-3">
          <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-slate-800 shrink-0">
            <img
              src={STREAMER_AVATAR_PATH}
              alt="Streamer profile"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 -z-10 flex items-center justify-center bg-gradient-to-br from-rose-900/60 to-slate-900 text-slate-300">
              <Film className="h-4 w-4" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-100 truncate">
              {streamerHandle || '@ViceCityLive'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {bufferActive && (
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                />
              )}
              <span className="truncate">
                {bufferActive ? 'Buffer active' : 'Buffer standby'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed 240px sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile slide-over sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{navContent}</div>
        </div>
      )}
    </>
  );
};
