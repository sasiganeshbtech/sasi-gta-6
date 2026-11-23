import React from 'react';
import { Menu } from 'lucide-react';
import { StudioTab } from '../types/studio';

interface TopBarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onCaptureClip: () => void;
  capturing: boolean;
  bufferActive: boolean;
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<StudioTab, string> = {
  live: 'Live Deck',
  editor: 'Clip Editor',
  library: 'Clip Library',
  overlays: 'Overlay Kit',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onCaptureClip,
  capturing,
  bufferActive,
  onOpenMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0B0E14]/95 backdrop-blur-sm border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Contextual Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm whitespace-nowrap shrink-0">
          <span className="text-slate-400">Studio</span>
          <span className="text-slate-600" aria-hidden="true">/</span>
          <h1 className="font-display font-semibold text-slate-100">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Clean Single-Line Nav Links */}
      <nav aria-label="Primary studio sections" className="hidden md:flex items-center gap-6 text-sm font-medium">
        {(
          [
            ['live', 'Live Deck'],
            ['editor', 'Clip Editor'],
            ['library', 'Clip Library'],
            ['overlays', 'Overlay Kit'],
          ] as [StudioTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectTab(id)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              activeTab === id
                ? 'text-white border-rose-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onCaptureClip}
          disabled={capturing || !bufferActive}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/40 disabled:text-white/60 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14]"
        >
          {capturing ? 'Saving Clip...' : 'Save Clip'}
        </button>
      </div>
    </header>
  );
};
