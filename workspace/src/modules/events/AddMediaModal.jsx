import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { bdApi } from '../../context/services/api';

const MAX_MB = 200;
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|m4v)$/i;

const kindForFile = (f) => {
  if (f.type.startsWith('video/') || VIDEO_EXT.test(f.name)) return 'Video';
  if (f.type.startsWith('image/')) return 'Photo';
  if (f.type.startsWith('audio/')) return 'Audio';
  return 'Link';
};

// Photos and podcast audio are hosted in-app; recorded video is attached as a
// link so multi-gigabyte files stay on SharePoint/YouTube where they belong.
const AddMediaModal = ({ open, onClose, events = [], milestones = [], onSaved }) => {
  const [mode, setMode] = useState('upload');
  const [owner, setOwner] = useState('');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('Video');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Set when a chosen file can't be hosted here — drives the guided link request.
  const [linkRequest, setLinkRequest] = useState(null);
  const fileRef = useRef(null);
  const urlRef = useRef(null);

  // Put the cursor straight in the URL field when the system asks for a link.
  useEffect(() => {
    if (linkRequest && mode === 'link') urlRef.current?.focus();
  }, [linkRequest, mode]);

  const reset = () => {
    setMode('upload'); setOwner(''); setLabel(''); setUrl('');
    setKind('Video'); setFile(null); setError(null); setLinkRequest(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const pickFile = (f) => {
    if (!f) return;
    setError(null);
    const sizeMB = f.size / 1024 / 1024;
    const isVideo = f.type.startsWith('video/') || VIDEO_EXT.test(f.name);
    const tooBig = f.size > MAX_MB * 1024 * 1024;

    // Rather than dead-ending on an error, hand the user straight to the link
    // flow with the reason, a pre-filled label and the right media type.
    if (isVideo || tooBig) {
      setFile(null);
      setKind(kindForFile(f));
      setLabel((prev) => prev || f.name.replace(/\.[^.]+$/, ''));
      setLinkRequest({ fileName: f.name, sizeMB, reason: isVideo ? 'video' : 'size' });
      setMode('link');
      return;
    }

    if (!f.type.startsWith('image/') && !f.type.startsWith('audio/')) {
      setError('Only photos and audio files can be uploaded. Use a link for anything else.');
      return;
    }

    setLinkRequest(null);
    setFile(f);
    if (!label) setLabel(f.name);
  };

  const save = async () => {
    setError(null);
    if (!owner) return setError('Choose which event or milestone this belongs to.');
    const [ownerType, ownerId] = owner.split(':');

    setBusy(true);
    try {
      if (mode === 'upload') {
        if (!file) return setError('Choose a photo or audio file first.');
        await bdApi.uploadMediaFile(ownerType, ownerId, file, label);
      } else {
        if (!url.trim()) return setError('Paste a link.');
        await bdApi.addMediaLink(ownerType, ownerId, { url: url.trim(), label, kind });
      }
      await onSaved();
      handleClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
      <Button type="button" variant="primary" onClick={save} disabled={busy}>
        {busy ? 'Saving...' : 'Add to Archive'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add to Media Hub"
      description="Attach a photo, recording or podcast clip to an event or milestone."
      footer={footer}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Attach to *</label>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full form-input">
            <option value="">— choose an event or milestone —</option>
            {events.length > 0 && (
              <optgroup label="Events">
                {events.map((e) => <option key={e._id} value={`Event:${e._id}`}>{e.title}</option>)}
              </optgroup>
            )}
            {milestones.length > 0 && (
              <optgroup label="Milestones">
                {milestones.map((m) => <option key={m._id} value={`Milestone:${m._id}`}>{m.participantName}</option>)}
              </optgroup>
            )}
          </select>
          {events.length === 0 && milestones.length === 0 && (
            <p className="text-[11px] text-amber-700 mt-1">Create an event or milestone first — media attaches to one of them.</p>
          )}
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {[
            { key: 'upload', label: 'Upload photo / audio' },
            { key: 'link', label: 'Attach a link' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setMode(t.key);
                setError(null);
                // Going back to upload means they're choosing a different file.
                if (t.key === 'upload') setLinkRequest(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                mode === t.key ? 'border-navy-700 text-navy-800' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'upload' ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); pickFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-navy-500 bg-navy-50'
                : file ? 'border-forest-300 bg-forest-50/50 hover:border-forest-400'
                : 'border-slate-300 hover:border-navy-400 hover:bg-slate-50 bg-white'
            }`}
          >
            {/* Video and oversize files are accepted by the picker on purpose —
                pickFile catches them and switches to the guided link flow. */}
            <input ref={fileRef} type="file" accept="image/*,audio/*,video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            {file ? (
              <p className="text-sm text-navy-700">
                {file.type.startsWith('image/') ? '🖼' : '🎙'} {file.name}
                <span className="text-xs text-slate-500 ml-2">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-500">Drag &amp; drop a photo or audio file, or click to browse</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Up to {MAX_MB}MB. Drop a video or anything larger and we'll ask you for a link instead.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {linkRequest && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-xs font-semibold text-amber-900">
                  {linkRequest.reason === 'size'
                    ? `This file is too large to store here (${linkRequest.sizeMB.toFixed(0)}MB, limit ${MAX_MB}MB)`
                    : 'Video is not stored in the app'}
                </p>
                <p className="text-xs text-amber-800 break-all">
                  <span className="font-medium">{linkRequest.fileName}</span> — upload it to SharePoint, YouTube or Drive, then paste the link below so it still appears in the archive.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Link URL *</label>
              <input ref={urlRef} type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full form-input" placeholder="SharePoint / YouTube / Drive URL" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full form-input">
                {['Video', 'Audio', 'Photo', 'Document', 'Link'].map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-600 mb-1">Label</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full form-input" placeholder="e.g. Episode 4 recording, Birthday lunch photos" />
        </div>

        {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}
      </div>
    </Modal>
  );
};

export default AddMediaModal;
