import React from 'react';
import type { AxiosInstance } from 'axios';
import { validateImageFile, validateImageUrl } from '@/lib/mediaValidation';
import { getMediaStatus } from '@/lib/api/media';

export type CoverImagePickerProps = {
  value: string | undefined;
  onChange: (nextUrl: string) => void;
  label?: string;
  maxSizeMB?: number;
  uploadEnabled?: boolean;
  uploadEndpoint?: string;
  apiClient: AxiosInstance;
};

function isValidHttpUrl(u: string): boolean {
  const s = (u || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export default function CoverImagePicker({
  value,
  onChange,
  label = 'Cover Image',
  maxSizeMB = 2,
  uploadEnabled = false,
  uploadEndpoint = '/media/upload',
  apiClient,
}: CoverImagePickerProps) {
  const [tab, setTab] = React.useState<'url' | 'upload'>('url');

  const [backendUploadEnabled, setBackendUploadEnabled] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await getMediaStatus(apiClient);
      if (!cancelled) setBackendUploadEnabled(status.uploadEnabled);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  // Debounced preview source to avoid flicker while typing/pasting.
  const [debouncedUrl, setDebouncedUrl] = React.useState<string>((value || '').trim());
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const [previewReady, setPreviewReady] = React.useState(false);
  const [previewFailed, setPreviewFailed] = React.useState(false);

  const url = (value || '').trim();
  const urlValid = url ? isValidHttpUrl(url) : false;

  React.useEffect(() => {
    setPreviewReady(false);
    setPreviewFailed(false);
    const next = (value || '').trim();
    const t = window.setTimeout(() => {
      setDebouncedUrl(next);
      setRefreshNonce((n) => n + 1);
    }, 500);
    return () => window.clearTimeout(t);
  }, [value]);

  React.useEffect(() => {
    // If user entered a non-http URL, show failed state (soft warning).
    if (url && !urlValid) {
      setPreviewReady(false);
      setPreviewFailed(true);
    }
  }, [url, urlValid]);

  const urlValidation = React.useMemo(() => validateImageUrl(url), [url]);

  const effectiveUploadEnabled = uploadEnabled && backendUploadEnabled === true;

  const uploadDisabledMessage = React.useMemo(() => {
    if (!uploadEnabled) return 'Upload disabled by configuration.';
    if (backendUploadEnabled === null) return 'Checking upload availability…';
    if (!effectiveUploadEnabled) return 'Upload not configured. Add storage envs to enable uploads.';
    return null;
  }, [backendUploadEnabled, effectiveUploadEnabled, uploadEnabled]);

  // Upload state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!selectedFile) {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setLocalPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [selectedFile]);

  const statusPill = React.useMemo(() => {
    if (!url) {
      return { text: 'No cover image', cls: 'border-amber-200 bg-amber-50 text-amber-800' };
    }
    if (previewReady && !previewFailed) {
      return { text: 'Preview ready', cls: 'border-green-200 bg-green-50 text-green-800' };
    }
    if (previewFailed || (url && !urlValid)) {
      return { text: 'Preview failed', cls: 'border-red-200 bg-red-50 text-red-700' };
    }
    return { text: 'Loading preview…', cls: 'border-slate-200 bg-slate-50 text-slate-700' };
  }, [previewFailed, previewReady, url, urlValid]);

  async function pasteFromClipboard() {
    setUploadError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      onChange(text.trim());
    } catch {
      // No toast dependency here; keep it silent and show inline.
      setUploadError('Clipboard access denied. Paste manually.');
    }
  }

  function forceRefresh() {
    setPreviewReady(false);
    setPreviewFailed(false);
    setDebouncedUrl(url);
    setRefreshNonce((n) => n + 1);
  }

  function onPickFile(file: File | null) {
    setUploadError(null);
    setSelectedFile(null);
    if (!file) return;

    const maxBytes = Math.max(0.5, maxSizeMB) * 1024 * 1024;
    const v = validateImageFile(file, { maxBytes });
    if (!v.ok) {
      setUploadError(v.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);
  }

  async function doUpload() {
    if (!effectiveUploadEnabled) return;
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      // Admin upload contract uses field name: cover
      fd.append('cover', selectedFile);
      // Keep legacy compatibility for older/demo backends.
      fd.append('file', selectedFile);

      let res: any;
      try {
        res = await apiClient.post(uploadEndpoint, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          // @ts-expect-error custom flag consumed by api.ts interceptor
          skipErrorLog: true,
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const msg = String(err?.response?.data?.message || '').toLowerCase();
        const notFound = status === 404 || msg.includes('route not found');

        // If the configured endpoint is missing, try the legacy uploads route.
        if (notFound && uploadEndpoint !== '/uploads/cover') {
          res = await apiClient.post('/uploads/cover', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            // @ts-expect-error custom flag
            skipErrorLog: true,
          });
        } else {
          throw err;
        }
      }

      const raw = res?.data as any;
      const nextUrl =
        raw?.url ||
        raw?.secure_url ||
        raw?.data?.url ||
        raw?.data?.secure_url ||
        raw?.data?.imageUrl ||
        raw?.imageUrl;

      if (!nextUrl) throw new Error('Upload succeeded but no URL was returned');

      onChange(String(nextUrl));
      setSelectedFile(null);
      setTab('url');
      forceRefresh();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setUploadError('Upload not configured on backend.');
      } else {
        setUploadError(err?.response?.data?.message || err?.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${statusPill.cls}`}>{statusPill.text}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-7">
          <div className="w-full aspect-video rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
            {!url || !urlValid ? (
              <div className="text-xs text-slate-500 text-center px-3">
                <div className="font-medium">No image selected</div>
                <div className="mt-1">Paste an image URL or upload a file.</div>
              </div>
            ) : (
              <img
                key={`${debouncedUrl}::${refreshNonce}`}
                src={debouncedUrl}
                alt="Cover"
                className="w-full h-full object-cover"
                onLoad={() => {
                  setPreviewReady(true);
                  setPreviewFailed(false);
                }}
                onError={() => {
                  setPreviewReady(false);
                  setPreviewFailed(true);
                }}
              />
            )}
          </div>

          {url && urlValidation.warning && (
            <div className="mt-2 text-xs text-amber-700">{urlValidation.warning}</div>
          )}
          {url && !urlValid && (
            <div className="mt-2 text-xs text-amber-700">URL should start with http:// or https://</div>
          )}
        </div>

        <div className="md:col-span-5">
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              className={`px-3 py-2 text-xs border-r border-slate-200 ${tab === 'url' ? 'bg-slate-100 font-semibold' : 'bg-white hover:bg-slate-50'}`}
              onClick={() => setTab('url')}
            >
              URL
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-xs ${tab === 'upload' ? 'bg-slate-100 font-semibold' : 'bg-white hover:bg-slate-50'} ${effectiveUploadEnabled ? '' : 'opacity-70'}`}
              onClick={() => setTab('upload')}
              title={uploadDisabledMessage || undefined}
            >
              Upload
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            {tab === 'url' ? (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium">Image URL</label>
                  <input
                    value={url}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 flex-wrap">
                  <button type="button" className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50" onClick={() => void pasteFromClipboard()}>
                    Paste
                  </button>
                  <button type="button" className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50" onClick={forceRefresh}>
                    Preview
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                    disabled={!urlValid}
                    onClick={() => {
                      if (!urlValid) return;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    title={!urlValid ? 'Enter a valid http(s) URL first' : undefined}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                    onClick={() => {
                      onChange('');
                      setPreviewReady(false);
                      setPreviewFailed(false);
                    }}
                  >
                    Remove
                  </button>
                </div>

                {uploadError && <div className="text-xs text-red-600">{uploadError}</div>}
              </div>
            ) : (
              <div className="space-y-3">
                {!effectiveUploadEnabled ? (
                  <div className="text-sm text-slate-700">
                    <div className="font-medium">Upload not available</div>
                    <div className="mt-1 text-xs text-slate-600">{uploadDisabledMessage || 'Upload not configured'}</div>
                  </div>
                ) : (
                  <>
                    <div
                      className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        onPickFile(file || null);
                      }}
                    >
                      <div className="text-sm font-medium">Drag & drop an image</div>
                      <div className="mt-1 text-xs text-slate-600">JPG/PNG/WebP up to {maxSizeMB}MB</div>
                      <div className="mt-3">
                        <button
                          type="button"
                          className="text-xs px-3 py-2 rounded border bg-white hover:bg-slate-50"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Browse
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            e.target.value = '';
                            onPickFile(file);
                          }}
                        />
                      </div>
                    </div>

                    {localPreviewUrl && (
                      <div className="rounded border border-slate-200 overflow-hidden">
                        <img src={localPreviewUrl} alt="Local preview" className="w-full h-40 object-cover" />
                      </div>
                    )}

                    {uploadError && <div className="text-xs text-red-600">{uploadError}</div>}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="text-xs px-3 py-2 rounded border bg-white hover:bg-slate-50"
                        disabled={uploading}
                        onClick={() => {
                          setSelectedFile(null);
                          setUploadError(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={!selectedFile || uploading}
                        onClick={() => void doUpload()}
                      >
                        {uploading ? 'Uploading…' : 'Upload'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
