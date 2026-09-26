import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { uploadCoverImage } from '@/lib/api/media';
import { validateImageFile } from '@/lib/mediaValidation';
import { validateAuthorPhotoUrl, type AuthorByline } from '@/lib/authorByline';

type Props = {
  value: AuthorByline;
  onChange: (value: AuthorByline) => void;
  uploadEnabled: boolean;
  uploadStatusText?: string | null;
  onUploadPendingChange: (pending: boolean) => void;
};

export default function AuthorBylineSection({ value, onChange, uploadEnabled, uploadStatusText, onUploadPendingChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadVersion = useRef(0);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => () => {
    uploadVersion.current += 1;
    onUploadPendingChange(false);
  }, [onUploadPendingChange]);

  function cancelPhotoUpload() {
    uploadVersion.current += 1;
    setUploading(false);
    setUploadError('');
    onUploadPendingChange(false);
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file || !uploadEnabled || uploading) return;
    const validation = validateImageFile(file, { maxBytes: 5 * 1024 * 1024 });
    if (!validation.ok || (file.type && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
      setUploadError(validation.error || 'Only PNG, JPEG, or WEBP images are allowed');
      return;
    }
    const version = ++uploadVersion.current;
    setUploading(true);
    setUploadError('');
    onUploadPendingChange(true);
    try {
      const uploaded = await uploadCoverImage(file);
      if (version !== uploadVersion.current) return;
      const current = latest.current.value;
      if (!current.enabled) return;
      validateAuthorPhotoUrl(uploaded.url);
      latest.current.onChange({ ...current, snapshot: { ...current.snapshot, photoUrl: uploaded.url } });
    } catch (error) {
      if (version === uploadVersion.current) setUploadError(error instanceof Error ? error.message : 'Author photo upload failed.');
    } finally {
      if (version === uploadVersion.current) {
        setUploading(false);
        onUploadPendingChange(false);
      }
    }
  }

  function changeSnapshot(field: 'name' | 'publicDesignation' | 'photoUrl' | 'shortBio', text: string) {
    onChange({ ...value, snapshot: { ...value.snapshot, [field]: text } });
  }

  return (
    <section className="space-y-3 border-t border-slate-200 pt-3" aria-label="Author Byline">
      <label className="flex items-center gap-2 text-xs font-medium">
        <input type="checkbox" checked={value.enabled} onChange={(event) => { cancelPhotoUpload(); onChange({ enabled: event.target.checked }); }} />
        Author Byline
      </label>
      {value.enabled && (
        <>
          <label className="block text-xs font-medium">
            Author Name *
            <input value={value.snapshot?.name || ''} required maxLength={160} onChange={(event) => changeSnapshot('name', event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-sm" />
          </label>
          <div className="space-y-2">
            <div className="text-xs font-medium">Author Photo (optional)</div>
            {value.snapshot?.photoUrl && <img src={value.snapshot.photoUrl} alt="Author photo preview" className="h-20 w-20 rounded object-cover" />}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary inline-flex items-center gap-2 px-2 py-1 text-xs" disabled={!uploadEnabled || uploading} onClick={() => fileInput.current?.click()}>
                <Upload size={14} aria-hidden="true" />
                {uploading ? 'Uploading Photo...' : value.snapshot?.photoUrl ? 'Replace Photo' : 'Upload Photo'}
              </button>
              {(value.snapshot?.photoUrl || uploading) && (
                <button type="button" className="btn-secondary inline-flex items-center gap-2 px-2 py-1 text-xs" onClick={() => { cancelPhotoUpload(); changeSnapshot('photoUrl', ''); }}>
                  <Trash2 size={14} aria-hidden="true" /> Remove Photo
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Author photo file" className="hidden" disabled={!uploadEnabled || uploading} onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void uploadPhoto(file);
              }} />
            </div>
            {uploading && <p role="status" className="text-xs text-slate-600">Uploading photo...</p>}
            {!uploadEnabled && uploadStatusText && <p className="text-xs text-slate-600">{uploadStatusText}</p>}
            {uploadError && <p role="alert" className="text-xs text-red-700">{uploadError}</p>}
          </div>
          <label className="block text-xs font-medium">
            Public Designation / Role (optional)
            <input value={value.snapshot?.publicDesignation || ''} maxLength={160} onChange={(event) => changeSnapshot('publicDesignation', event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium">
            Short Bio (optional)
            <textarea value={value.snapshot?.shortBio || ''} maxLength={600} rows={3} onChange={(event) => changeSnapshot('shortBio', event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-sm" />
          </label>
        </>
      )}
    </section>
  );
}