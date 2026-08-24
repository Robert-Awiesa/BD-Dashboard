import { useState } from 'react';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { MODALITY_ICON, statusBadgeTone, formatDateRange } from './eventConstants';

const rsvpTone = { Confirmed: 'text-forest-700', Declined: 'text-red-600', Pending: 'text-amber-700' };

const EventCard = ({ event, onEdit, onDelete, onToggleTask, onUpdateAttendee, onEnterMetrics }) => {
  const [expanded, setExpanded] = useState(false);

  const status = event.derivedStatus;
  const tasks = event.prepChecklist || [];
  const attendees = event.attendees || [];
  const doneCount = tasks.filter((t) => t.completed).length;
  const progress = event.prepProgress ?? 0;
  const confirmed = attendees.filter((a) => a.status === 'Confirmed').length;
  const canEnterMetrics = status === 'Completed';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-navy-900 text-sm truncate">{event.title}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{event.eventType}{event.episodeNumber ? ` · ${event.episodeNumber}` : ''}</p>
          </div>
          <Badge label={status} status={statusBadgeTone(status)} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>🗓 {formatDateRange(event.startDate, event.endDate)}</span>
          <span>{MODALITY_ICON[event.modality]} {event.modality}</span>
          {event.assignedLead && <span>👤 {event.assignedLead}</span>}
        </div>

        {/* A hybrid event shows both, because attendees pick one. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {event.streamingLink && (
            <a href={event.streamingLink} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-700 hover:underline break-all">
              🔗 Join link
            </a>
          )}
          {event.locationDetails && (
            <p className="text-xs text-slate-500">📍 {event.locationDetails}</p>
          )}
        </div>

        {(event.linkedScript || event.linkedCampaign) && (
          <div className="flex flex-wrap gap-1.5">
            {event.linkedScript && (
              <span className="text-[11px] px-1.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded">
                📄 {event.linkedScript.title || 'Script linked'}
              </span>
            )}
            {event.linkedCampaign && (
              <span className="text-[11px] px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded">
                📢 {event.linkedCampaign.campaignName || 'Campaign linked'}
              </span>
            )}
          </div>
        )}

        {tasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Prep progress</span>
              <span>{doneCount}/{tasks.length}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-forest-500' : 'bg-navy-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={() => setExpanded((e) => !e)} className="text-xs text-navy-700 hover:underline cursor-pointer">
            {expanded ? '▾ Hide details' : `▸ Prep & RSVP (${tasks.length} tasks · ${confirmed}/${attendees.length} confirmed)`}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEdit(event)} className="text-xs text-navy-700 hover:underline cursor-pointer">Edit</button>
            <button type="button" onClick={() => onDelete(event._id)} className="text-xs text-red-600 hover:underline cursor-pointer">Delete</button>
            {canEnterMetrics && (
              <Button variant="success" className="text-xs px-2.5 py-1.5" onClick={() => onEnterMetrics(event)}>
                {event.metricsEnteredAt ? 'View Metrics' : 'Enter Metrics'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
          <div>
            <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Prep Checklist</h5>
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400">No prep tasks added.</p>
            ) : (
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li key={t._id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={(e) => onToggleTask(event._id, t._id, e.target.checked)}
                    />
                    <span className={t.completed ? 'line-through text-slate-400' : 'text-slate-700'}>{t.taskName}</span>
                    {t.assignedTo && <span className="text-xs text-slate-500">· {t.assignedTo}</span>}
                    {t.dueDate && (
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(t.dueDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Attendance ({confirmed} confirmed of {attendees.length})
            </h5>
            {attendees.length === 0 ? (
              <p className="text-xs text-slate-400">No internal attendees recorded.</p>
            ) : (
              <ul className="space-y-1.5">
                {attendees.map((a) => (
                  <li key={a._id} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-700">{a.memberName}</span>
                    <span className="text-xs text-slate-500">· {a.role}</span>
                    <select
                      value={a.status}
                      onChange={(e) => onUpdateAttendee(event._id, a._id, { status: e.target.value })}
                      className={`form-input ml-auto text-xs py-1 w-28 ${rsvpTone[a.status] || ''}`}
                    >
                      <option value="Confirmed">Confirmed</option>
                      <option value="Pending">Pending</option>
                      <option value="Declined">Declined</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {event.speakers?.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Speakers</h5>
              <ul className="space-y-1">
                {event.speakers.map((s) => (
                  <li key={s._id} className="text-sm text-slate-700">
                    {s.name}
                    {s.title && <span className="text-xs text-slate-500"> · {s.title}</span>}
                    {s.organization && <span className="text-xs text-slate-500"> · {s.organization}</span>}
                    {s.linkedin && (
                      <a href={s.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-700 hover:underline ml-1.5">in↗</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventCard;
