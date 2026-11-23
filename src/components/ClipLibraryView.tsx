import React, { useRef, useState } from 'react';
import {
  Download,
  Film,
  Play,
  Scissors,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../lib/replayBuffer';
import { MomentCategory, SavedClip } from '../types/studio';

interface ClipLibraryViewProps {
  clips: SavedClip[];
  onEditClip: (clipId: string) => void;
  onDownloadClip: (clip: SavedClip) => void;
  onDeleteClip: (clipId: string) => void;
  onGoLive: () => void;
  onImportClipFile: (file: File) => void;
}

const CATEGORIES: ('All' | MomentCategory)[] = [
  'All',
  'Pursuit',
  'Heist',
  'Stunt',
  'Wasted',
  'Chat',
];

export const ClipLibraryView: React.FC<ClipLibraryViewProps> = ({
  clips,
  onEditClip,
  onDownloadClip,
  onDeleteClip,
  onGoLive,
  onImportClipFile,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | MomentCategory>('All');
  const [previewClip, setPreviewClip] = useState<SavedClip | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredClips = clips.filter((clip) => {
    const matchesCategory = categoryFilter === 'All' || clip.category === categoryFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      clip.title.toLowerCase().includes(q) ||
      clip.district.toLowerCase().includes(q) ||
      clip.category.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clips by title or district..."
            aria-label="Search saved clips"
            className="w-full bg-[#0B0E14] border border-white/[0.1] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter clips by moment category"
            className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0E14] border border-white/[0.08] rounded-lg"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-rose-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import Video</span>
          </button>
          <input
            ref={fileInputRef}
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

      {/* Empty State */}
      {clips.length === 0 ? (
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="h-12 w-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-300">
            <Film className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Your clip library is empty
            </h2>
            <p className="text-sm text-slate-400">
              Save a highlight from the Live Deck rolling buffer or import a local GTA 6 gameplay recording to trim and export.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onGoLive}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-colors cursor-pointer"
            >
              Capture First Clip
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 transition-colors cursor-pointer"
            >
              Import Gameplay Video
            </button>
          </div>
        </div>
      ) : filteredClips.length === 0 ? (
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-10 text-center space-y-2">
          <p className="text-sm text-slate-300 font-medium">No clips match your current filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategoryFilter('All');
            }}
            className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        /* Populated Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredClips.map((clip) => {
            const trimmedDur = Math.max(0.5, clip.trimEndSec - clip.trimStartSec);
            return (
              <article
                key={clip.id}
                className="bg-[#131822] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setPreviewClip(clip)}
                  className="group relative aspect-video w-full bg-[#080A0F] overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  {clip.thumbnailUrl ? (
                    <img
                      src={clip.thumbnailUrl}
                      alt={clip.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-500">
                      <Film className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="h-11 w-11 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </span>
                  </div>
                  <div className="absolute bottom-2.5 right-3 font-mono text-xs tabular-nums text-white font-semibold">
                    {formatDuration(trimmedDur)}
                  </div>
                </button>

                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-display text-base font-semibold text-slate-100 truncate">
                      {clip.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                      <span>{clip.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{clip.district}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{clip.aspectRatio}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(clip.fileSizeBytes)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditClip(clip.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-slate-100 transition-colors cursor-pointer"
                      >
                        <Scissors className="h-3.5 w-3.5" />
                        <span>Trim & Reframe</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadClip(clip)}
                        aria-label={`Download ${clip.title}`}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteClip(clip.id)}
                      aria-label={`Delete ${clip.title}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Video Playback Preview Modal */}
      {previewClip && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewClip.title}`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#131822] border border-white/[0.12] rounded-xl w-full max-w-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-semibold text-slate-100 truncate">
                  {previewClip.title}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {previewClip.category} · {previewClip.district} · {formatDuration(previewClip.durationSec)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClip(null)}
                aria-label="Close video preview"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-black aspect-video">
              <video
                src={previewClip.blobUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const id = previewClip.id;
                  setPreviewClip(null);
                  onEditClip(id);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-colors cursor-pointer"
              >
                Open in Clip Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
