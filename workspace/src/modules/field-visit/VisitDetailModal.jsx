import { useRef, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import {
  SENTIMENTS,
  SENTIMENT_ICON,
  STATUS_BADGE,
  formatDate,
  formatDuration,
  relativeDays,
} from './fieldVisitConstants';

const MetaRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-navy-900 font-medium text-right min-w-0">{children}</span>
  </div>
);

const VisitDetailModal = ({ open, onClose, visit, onChanged, onEdit, onDelete }) => {
  const { currentUser, bumpClientData } = useDashboard();
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [report, setReport] = useState({ observations: '', sentiment: 'Neutral', durationMinutes: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef(null);

  if (!visit) return null;

  const planned = visit.visitStatus === 'Planned';
  const awaiting = visit.awaitingReport;

  const complete = async (e) => {
    e.preventDefault();
    setCompleting(true);
    setError(null);
    try {
      const updated = await bdApi.completeFieldVisit(visit._id, { ...report, completedBy: currentUser });
      bumpClientData();
      onChanged(updated);
      setReport({ observations: '', sentiment: 'Neutral', durationMinutes: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setCompleting(false);
    }
  };

  const addPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChanged(await bdApi.uploadVisitPhoto(visit._id, file));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (photoId) => {
    try {
      onChanged(await bdApi.deleteVisitPhoto(visit._id, photoId));
    } catch (err) {
      setError(err.message);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        Recorded by {visit.loggedBy} · {formatDate(visit.createdAt)}
      </span>
      <div className="flex flex-wrap gap-2">
        {!confirmDelete && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
        )}
        <Button variant="primary" onClick={() => onEdit(visit)}>✎ Edit</Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={visit.locationName || 'Site visit'}
      description={`${visit.client?.name || 'Unknown client'} · ${formatDate(visit.occurredAt)}`}
      footer={footer}
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge label={visit.visitStatus} status={STATUS_BADGE[visit.visitStatus]} />
          {visit.visitType === 'Discovery' && <Badge label="Discovery Session" status="purple" />}
          {awaiting && <Badge label="Awaiting write-up" status="danger" />}
          {planned && <span className="text-xs text-slate-500">{relativeDays(visit.occurredAt)}</span>}
          {visit.sentiment && !planned && (
            <span className="text-sm" title={visit.sentiment}>{SENTIMENT_ICON[visit.sentiment]}</span>
          )}
        </div>

        {confirmDelete && (
          <div className="px-3 py-3 rounded-lg bg-red-50 border border-red-300 space-y-2">
            <p className="text-xs text-red-800">
              Delete this visit? It disappears from the client timeline too, and any photos go with it.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              <Button variant="danger" onClick={() => onDelete(visit)}>Delete visit</Button>
            </div>
          </div>
        )}

        {/* Writing up is the whole point of the trip, so it is the first thing
            offered on any visit that still lacks a report. */}
        {(planned || awaiting) && (
          <form onSubmit={complete} className="rounded-xl border border-navy-200 bg-navy-50 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-navy-900">
                {planned ? 'Been already? Write it up.' : 'This visit has no write-up yet.'}
              </p>
              <p className="text-xs text-slate-600">
                {planned
                  ? 'Marking it done records the contact against the client.'
                  : 'Add what you found while it is still fresh.'}
              </p>
            </div>
            <textarea
              value={report.observations}
              onChange={(e) => setReport((r) => ({ ...r, observations: e.target.value }))}
              rows={3}
              placeholder="Site conditions, what they said, what happens next…"
              className="form-input"
            />
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex gap-1.5">
                {SENTIMENTS.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => setReport((r) => ({ ...r, sentiment: s }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      report.sentiment === s
                        ? 'bg-navy-700 text-white border-navy-700'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400'
                    }`}
                  >
                    {SENTIMENT_ICON[s]} {s}
                  </button>
                ))}
              </div>
              <Button variant="primary" type="submit" disabled={completing || !report.observations.trim()}>
                {completing ? 'Saving…' : planned ? 'Mark visited & file report' : 'File the report'}
              </Button>
            </div>
          </form>
        )}

        {/* --- Discovery Session Structured View --- */}
        {visit.discoveryDetails && (
          <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-purple-200 pb-2">
              <h3 className="text-sm font-bold text-purple-950 uppercase tracking-wide">
                📋 Discovery Session Report
              </h3>
              {visit.discoveryDetails.clientRequest && (
                <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded">
                  Request: {visit.discoveryDetails.clientRequest}
                </span>
              )}
            </div>

            {visit.discoveryDetails.summary && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-purple-800">Executive Summary</p>
                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">{visit.discoveryDetails.summary}</p>
              </div>
            )}

            {visit.discoveryDetails.painPoints?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-red-800 mb-2">Pain Points & Challenges</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {visit.discoveryDetails.painPoints.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
                      <p className="text-xs font-semibold text-navy-900">• {item.title}</p>
                      {item.description && <p className="text-[11px] text-slate-600 mt-0.5">{item.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visit.discoveryDetails.propositions?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 mb-2">Proposed Solutions & System Needs</p>
                <div className="space-y-2">
                  {visit.discoveryDetails.propositions.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
                      <p className="text-xs font-semibold text-navy-900">{idx + 1}. {item.title}</p>
                      {item.description && <p className="text-[11px] text-slate-600 mt-0.5">{item.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-purple-200/60">
              {visit.discoveryDetails.usersCount && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-500">Target System Users: </span>
                  <span className="text-xs font-medium text-navy-900">{visit.discoveryDetails.usersCount}</span>
                </div>
              )}
              {visit.discoveryDetails.operation && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-500">Operation: </span>
                  <span className="text-xs font-medium text-navy-900">{visit.discoveryDetails.operation}</span>
                </div>
              )}
              {visit.discoveryDetails.processFlow && (
                <div className="sm:col-span-2">
                  <span className="text-[11px] font-semibold text-slate-500">Process Flow: </span>
                  <p className="text-xs font-medium text-navy-900 mt-0.5 bg-white p-2 rounded border border-slate-200">
                    {visit.discoveryDetails.processFlow}
                  </p>
                </div>
              )}
              {visit.discoveryDetails.additionalNotes && (
                <div className="sm:col-span-2">
                  <span className="text-[11px] font-semibold text-slate-500">Additional Notes: </span>
                  <span className="text-xs text-slate-700">{visit.discoveryDetails.additionalNotes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!visit.discoveryDetails && visit.purpose && (
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Purpose</p>
            <p className="text-sm text-slate-700 mt-0.5">{visit.purpose}</p>
          </div>
        )}

        {!visit.discoveryDetails && visit.observations && (
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What we found</p>
            <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{visit.observations}</p>
          </div>
        )}

        {/* --- Photos --- */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-navy-900">
              Photos {visit.photos?.length > 0 && `(${visit.photos.length})`}
            </p>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '📷 Add photo'}
            </Button>
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => addPhoto(e.target.files?.[0])}
          />
          {visit.photos?.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {visit.photos.map((p) => (
                <div key={p._id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={p.url} alt={p.caption || 'Visit photo'} className="w-full h-28 object-cover" />
                  <button
                    onClick={() => removePhoto(p._id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-slate-600 hover:text-red-700 text-sm leading-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              No photos yet — site conditions are much easier to show than describe.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <MetaRow label="Client">{visit.client?.name || '—'}</MetaRow>
          <MetaRow label="Site">{visit.locationName || '—'}</MetaRow>
          {visit.address && <MetaRow label="Address">{visit.address}</MetaRow>}
          <MetaRow label="Date">{formatDate(visit.occurredAt)}</MetaRow>
          {visit.durationMinutes > 0 && <MetaRow label="Time on site">{formatDuration(visit.durationMinutes)}</MetaRow>}
          {visit.teamAttendees?.length > 0 && <MetaRow label="Our team">{visit.teamAttendees.join(', ')}</MetaRow>}
          {visit.clientAttendees?.length > 0 && <MetaRow label="We met">{visit.clientAttendees.join(', ')}</MetaRow>}
          <MetaRow label="Logged by">{visit.loggedBy}</MetaRow>
        </div>

        {/* Booked, walked, written up, corrected — often by different people
            days apart. Without this, a write-up that contradicts the plan looks
            like a mistake rather than a decision somebody took. */}
        {visit.history?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              History
            </p>
            <ol className="space-y-1.5">
              {[...visit.history].reverse().map((h) => (
                <li key={h._id || h.at} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-navy-900">{h.action}</span>
                    <span className="text-[11px] text-slate-500">
                      {h.by || 'unknown'} · {formatDate(h.at)}
                    </span>
                  </div>
                  {h.changes?.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {h.changes.map((c) => (
                        <li key={c.field} className="text-[11px] text-slate-600">
                          <span className="text-slate-500">{c.field}:</span>{' '}
                          <span className="line-through text-slate-400">{c.from}</span>{' '}
                          <span aria-hidden="true">→</span> {c.to}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-xs text-slate-500">
          This visit also appears on {visit.client?.name || 'the client'}&rsquo;s timeline in Client Relations.
        </p>
      </div>
    </Modal>
  );
};

export default VisitDetailModal;
