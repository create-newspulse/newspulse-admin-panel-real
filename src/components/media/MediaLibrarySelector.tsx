import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Image as ImageIcon, Play, Search, Video, X } from 'lucide-react';
import {
  fetchMediaLibraryAssets,
  formatMediaFileSize,
  formatMediaUploadedDate,
  type MediaLibraryAsset,
  type MediaLibraryAssetType,
} from '@/lib/mediaLibrary';

type MediaLibrarySelectorMode = 'image' | 'video' | 'all';

export type { MediaLibraryAsset };

export type MediaLibrarySelectorProps = {
  open: boolean;
  mode: MediaLibrarySelectorMode;
  title: string;
  actionLabel: string;
  onClose: () => void;
  onSelect: (asset: MediaLibraryAsset) => void;
};

function typeAllowed(assetType: MediaLibraryAssetType, mode: MediaLibrarySelectorMode) {
  return mode === 'all' || assetType === mode;
}

function modeLabel(mode: MediaLibrarySelectorMode) {
  if (mode === 'image') return 'Images only';
  if (mode === 'video') return 'Videos only';
  return 'Images and videos';
}

function AssetPreview({ asset }: { asset: MediaLibraryAsset }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [asset.id, asset.url, asset.thumbnailUrl, asset.posterUrl]);

  if (asset.mediaType === 'video') {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-slate-950 text-white">
        {asset.posterUrl && !failed ? (
          <img src={asset.posterUrl} alt={asset.filename} className="h-full w-full object-cover opacity-80" onError={() => setFailed(true)} />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 to-transparent" />
        <div className="absolute flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/15 shadow-lg">
          <Play className="ml-0.5 h-5 w-5" />
        </div>
      </div>
    );
  }

  const src = asset.thumbnailUrl || asset.url;
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <ImageIcon className="h-8 w-8" />
      </div>
    );
  }

  return <img src={src} alt={asset.filename} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}

export default function MediaLibrarySelector({ open, mode, title, actionLabel, onClose, onSelect }: MediaLibrarySelectorProps) {
  const [items, setItems] = useState<MediaLibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError('');
    void fetchMediaLibraryAssets()
      .then((next) => {
        if (!alive) return;
        setItems(next);
      })
      .catch((err: any) => {
        if (!alive) return;
        setError(String(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load Media Library'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((asset) => {
      if (!typeAllowed(asset.mediaType, mode)) return false;
      if (!needle) return true;
      return [asset.filename, asset.url, asset.source, ...asset.tags].join(' ').toLowerCase().includes(needle);
    });
  }, [items, mode, search]);

  const selectedAsset = filteredItems.find((asset) => asset.id === selectedId) || null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Media Library</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
            <div className="mt-1 text-sm text-slate-500">{modeLabel(mode)}</div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900" aria-label="Close Media Library selector">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search filename or tags" className="w-full bg-transparent text-sm outline-none" />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Loading Media Library...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No matching assets found.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((asset) => {
                const selected = selectedAsset?.id === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedId(asset.id)}
                    onDoubleClick={() => onSelect(asset)}
                    className={`overflow-hidden rounded-lg border bg-white text-left shadow-sm transition ${selected ? 'border-slate-950 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className={`relative aspect-video overflow-hidden ${asset.mediaType === 'video' ? 'bg-slate-950' : 'bg-slate-100'}`}>
                      <AssetPreview asset={asset} />
                      <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold shadow-sm ${asset.mediaType === 'video' ? 'bg-slate-950/80 text-white' : 'bg-white/90 text-slate-700'}`}>
                        {asset.mediaType === 'video' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                        {asset.mediaType === 'video' ? 'Video' : 'Image'}
                      </span>
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="truncate text-sm font-semibold text-slate-900" title={asset.filename}>{asset.filename}</div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{formatMediaFileSize(asset.fileSize)}</span>
                        <span>Used {asset.usageCount}</span>
                        <span>{formatMediaUploadedDate(asset.uploadedAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm text-slate-600">
            {selectedAsset ? <span className="truncate">Selected: <span className="font-semibold text-slate-900">{selectedAsset.filename}</span></span> : 'Select an asset to continue.'}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {selectedAsset ? (
              <>
                <button type="button" onClick={() => window.open(selectedAsset.url, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Eye className="h-4 w-4" />
                  View
                </button>
                <button type="button" onClick={() => void navigator.clipboard.writeText(selectedAsset.url)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Copy className="h-4 w-4" />
                  Copy URL
                </button>
              </>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" disabled={!selectedAsset} onClick={() => selectedAsset && onSelect(selectedAsset)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
