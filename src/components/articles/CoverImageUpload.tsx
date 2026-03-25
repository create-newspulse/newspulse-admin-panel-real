import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ACCEPT_ATTR = 'image/png,image/jpeg,image/webp';

export type CoverImageUploadProps = {
  url?: string; // existing remote cover image URL (edit mode)
  file?: File | null; // selected local file (not uploaded yet)
  onChangeFile: (file: File | null) => void;
  onRemove: () => void; // clears both url + file in parent
  disabled?: boolean;
  disabledText?: string | null;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  const rounded = idx === 0 ? String(Math.round(size)) : size.toFixed(1);
  return `${rounded} ${units[idx]}`;
}

export default function CoverImageUpload({ url, file, onChangeFile, onRemove, disabled = false, disabledText = null }: CoverImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const normalizedDisabledText = useMemo(() => {
    const raw = String(disabledText || '').trim();
    if (!raw) return '';
    return raw.replace(/^cover image upload unavailable\s*:\s*/i, '').trim();
  }, [disabledText]);

  const status = useMemo(() => {
    const checking = disabled && /\bchecking\b/i.test(String(disabledText || ''));
    const failed = disabled && /^\s*status\s+check\s+failed\b/i.test(String(disabledText || ''));
    if (checking) {
      return {
        label: 'Checking',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
        detail: normalizedDisabledText || String(disabledText || '').trim(),
      };
    }
    if (failed) {
      return {
        label: 'Check failed',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        detail: normalizedDisabledText || String(disabledText || '').trim() || 'Could not verify upload service',
      };
    }
    if (disabled) {
      return {
        label: 'Unavailable',
        className: 'bg-red-100 text-red-700 border-red-200',
        detail: normalizedDisabledText || 'Uploads are disabled',
      };
    }
    return {
      label: 'Available',
      className: 'bg-green-100 text-green-700 border-green-200',
      detail: '',
    };
  }, [disabled, disabledText, normalizedDisabledText]);

  const sanitizeRemoteUrl = (raw: string | undefined): string => {
    const s = String(raw || '').trim();
    if (!s) return '';
    const stripQueryHash = (v: string) => v.split(/[?#]/)[0];
    const stripTrailingSlash = (v: string) => v.replace(/\/+$/, '');

    // Never treat upload endpoints as an image URL.
    const forbiddenPaths = new Set([
      '/uploads/cover',
      '/admin-api/uploads/cover',
      '/api/uploads/cover',
      '/media/upload',
      '/admin-api/media/upload',
      '/api/media/upload',
    ]);

    const looksLikeAbsolute = /^https?:\/\//i.test(s);
    if (looksLikeAbsolute) {
      try {
        const u = new URL(s);
        const p = stripTrailingSlash(stripQueryHash(u.pathname || ''));
        if (forbiddenPaths.has(p)) return '';
      } catch {
        // If URL parsing fails, treat as invalid.
        return '';
      }
      return s;
    }

    const p = stripTrailingSlash(stripQueryHash(s));
    if (forbiddenPaths.has(p)) return '';
    return s;
  };

  useEffect(() => {
    if (!file) {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const next = URL.createObjectURL(file);
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });

    return () => {
      URL.revokeObjectURL(next);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const remoteSrc = sanitizeRemoteUrl(url);
  const hasRealPreview = !!(objectUrl || remoteSrc);
  const previewSrc = objectUrl || remoteSrc || '/fallback.svg';

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name || 'image',
      size: formatBytes(file.size || 0),
    };
  }, [file]);

  const pick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onPickFile = (f: File) => {
    if (disabled) return;
    if (f.size > MAX_BYTES) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    if (f.type && !ACCEPTED_TYPES.has(f.type)) {
      toast.error('Only PNG, JPEG, or WEBP images are allowed');
      return;
    }
    onChangeFile(f);
  };

  const onDropFile = (f: File | null | undefined) => {
    if (!f) return;
    onPickFile(f);
  };

  return (
    <div
      className="space-y-3"
      onDragEnter={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const f = e.dataTransfer?.files?.[0];
        onDropFile(f);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Cover Image</div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${status.className}`}>{status.label}</span>
      </div>

      {disabled && status.detail ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-700">
            <span className="font-medium">Reason:</span> {status.detail}
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {!hasRealPreview ? (
            <div className="text-xs text-slate-600">No cover image</div>
          ) : fileMeta ? (
            <div className="text-xs text-slate-600">
              <div className="font-medium text-slate-700 truncate">{fileMeta.name}</div>
              <div>{fileMeta.size}</div>
            </div>
          ) : url ? (
            <div className="text-xs text-slate-600">Current cover image</div>
          ) : null}

          <div className="flex items-center gap-2">
            <button type="button" className="btn" onClick={pick} disabled={disabled} title={disabledText || undefined}>
              {hasRealPreview ? 'Replace' : 'Upload Image'}
            </button>

            {hasRealPreview && (
              <button
                type="button"
                className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50"
                onClick={() => {
                  try {
                    if (inputRef.current) inputRef.current.value = '';
                  } catch {}
                  onRemove();
                }}
              >
                Remove
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              disabled={disabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                onPickFile(f);
              }}
            />
          </div>
        </div>

        <div className="w-28 shrink-0">
          <div
            className={
              "w-full aspect-video rounded-md border bg-slate-50 overflow-hidden flex items-center justify-center " +
              (isDragging ? 'border-slate-400' : 'border-slate-200')
            }
          >
            <img
              src={previewSrc}
              alt={hasRealPreview ? 'Cover preview' : 'Cover placeholder'}
              className={"w-full h-full object-cover " + (hasRealPreview ? '' : 'opacity-70')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
