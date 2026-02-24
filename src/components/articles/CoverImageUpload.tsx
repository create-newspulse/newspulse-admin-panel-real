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

export default function CoverImageUpload({ url, file, onChangeFile, onRemove }: CoverImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const previewSrc = objectUrl || (url || '').trim() || '';
  const hasPreview = !!previewSrc;

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name || 'image',
      size: formatBytes(file.size || 0),
    };
  }, [file]);

  const pick = () => inputRef.current?.click();

  const onPickFile = (f: File) => {
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
      className="space-y-2"
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const f = e.dataTransfer?.files?.[0];
        onDropFile(f);
      }}
    >
      <div className="text-sm font-semibold">Cover Image</div>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {!hasPreview ? (
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
            <button type="button" className="btn" onClick={pick}>
              {hasPreview ? 'Replace' : 'Upload Image'}
            </button>

            {hasPreview && (
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
            {hasPreview ? (
              <img src={previewSrc} alt="Cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-[11px] text-slate-500">{isDragging ? 'Drop image' : 'Preview'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
