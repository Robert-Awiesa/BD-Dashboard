import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../common/Button';
import RescheduleReminderModal from '../common/RescheduleReminderModal';
import CompleteReminderModal from '../common/CompleteReminderModal';

const SOURCE_LABEL = {
  Tender: 'Tender',
  Eoi: 'EOI',
  Client: 'Client',
  Interaction: 'Field visit',
  Proposal: 'Proposal',
  Document: 'Document',
  OutreachCampaign: 'Campaign',
  Campaign: 'Campaign',
  Event: 'Event',
  Milestone: 'Celebration',
  Holiday: 'Ghana Public Holiday',
};

const SOURCE_MODULE = {
  Tender: 'tenders',
  Eoi: 'tenders',
  Client: 'client-relations',
  Interaction: 'field-visits',
  Proposal: 'proposals',
  Document: 'reports',
  OutreachCampaign: 'social-media',
  Campaign: 'social-media',
  Event: 'events',
  Milestone: 'events',
  Holiday: 'events',
};

const ReminderBell = ({ onOpenModule }) => {
  const [reminders, setReminders] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [reschedulingReminder, setReschedulingReminder] = useState(null);
  const [completingReminder, setCompletingReminder] = useState(null);

  const load = () =>
    bdApi.getReminders()
      .then((rows) => setReminders(rows.filter((r) => !r.actioned)))
      .catch((err) => setError(err.message));

  useEffect(() => {
    let ignore = false;
    bdApi.getReminders()
      .then((rows) => { if (!ignore) setReminders(rows.filter((r) => !r.actioned)); })
      .catch((err) => { if (!ignore) setError(err.message); });
    return () => { ignore = true; };
  }, []);

  const urgent = reminders.filter((r) => r.reminderType === 'overdue' || r.reminderType === 'today');
  const upcoming = reminders.filter((r) => !urgent.includes(r));

  const dismiss = async (id) => {
    setReminders((prev) => prev.filter((r) => r._id !== id));
    try {
      await bdApi.actionReminder(id);
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const checkNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await bdApi.evaluateReminders();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const goTo = (reminder) => {
    const target = SOURCE_MODULE[reminder.sourceType];
    if (!target) return;
    setOpen(false);
    onOpenModule?.(target);
  };

  const handleRescheduled = async (id, data) => {
    await bdApi.rescheduleReminder(id, data);
    setReminders((prev) => prev.filter((r) => r._id !== id));
    load();
  };

  const handleCompleted = async (id, data) => {
    await bdApi.completeReminder(id, data);
    setReminders((prev) => prev.filter((r) => r._id !== id));
    load();
  };

  const Row = ({ reminder }) => {
    const isOverdue = reminder.reminderType === 'overdue';
    const isToday = reminder.reminderType === 'today';

    return (
      <li
        className={`rounded-lg border px-3 py-2 bg-white transition-all shadow-2xs ${
          isOverdue
            ? 'border-red-300 border-l-4 border-l-red-600 bg-red-50/20'
            : isToday
            ? 'border-amber-300 border-l-4 border-l-amber-500 bg-amber-50/20'
            : 'border-slate-200 border-l-4 border-l-sky-500'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => goTo(reminder)}
            className="text-left min-w-0 flex-1 cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.2 rounded ${
                  isOverdue
                    ? 'bg-red-100 text-red-800'
                    : isToday
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isOverdue ? 'MISSED / OVERDUE' : isToday ? 'DUE TODAY' : 'UPCOMING'}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {SOURCE_LABEL[reminder.sourceType] || reminder.sourceType}
                {reminder.responsiblePerson ? ` · ${reminder.responsiblePerson}` : ''}
              </span>
            </div>
            <p className="text-xs font-medium text-navy-950 group-hover:text-navy-700 mt-1">
              {reminder.message}
            </p>
          </button>

          <button
            type="button"
            onClick={() => dismiss(reminder._id)}
            aria-label="Dismiss this reminder"
            className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs shrink-0 p-0.5"
          >
            ✕
          </button>
        </div>

        {/* Action Buttons for Reschedule & Early Completion */}
        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setCompletingReminder(reminder)}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer transition-colors"
          >
            ✅ Mark Met & Log
          </button>
          <button
            type="button"
            onClick={() => setReschedulingReminder(reminder)}
            className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 cursor-pointer transition-colors"
          >
            📅 Reschedule
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={reminders.length ? `${reminders.length} reminder(s)` : 'Reminders'}
        aria-expanded={open}
        className="relative w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-600 hover:text-navy-700 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8.25a6 6 0 0 0-12 0c0 5.25-2.25 6.75-2.25 6.75h16.5S18 13.5 18 8.25Z" />
          <path d="M13.73 18.75a2 2 0 0 1-3.46 0" />
        </svg>
        {urgent.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center animate-pulse">
            {urgent.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-10 z-40 w-[min(26rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-navy-950 flex items-center gap-1.5">
                  🔔 Reminders Hub {reminders.length > 0 && `(${reminders.length})`}
                </h3>
                <p className="text-[11px] text-slate-500">Proactive deadline tracking & activity resolution</p>
              </div>
              <Button variant="secondary" onClick={checkNow} disabled={busy} className="text-xs px-2.5 py-1">
                {busy ? 'Sweeping…' : 'Check now'}
              </Button>
            </div>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                {error}
              </p>
            )}

            {reminders.length === 0 && !error && (
              <div className="text-center py-6 text-slate-500 text-xs">
                <span className="text-2xl block mb-1">🎉</span>
                Nothing needs chasing right now. All deadlines met!
              </div>
            )}

            {urgent.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-1.5 flex items-center gap-1">
                  <span>🚨</span> Needs Immediate Resolution ({urgent.length})
                </p>
                <ul className="space-y-2">
                  {urgent.map((r) => <Row key={r._id} reminder={r} />)}
                </ul>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1">
                  <span>📅</span> Approaching Deadlines ({upcoming.length})
                </p>
                <ul className="space-y-2">
                  {upcoming.map((r) => <Row key={r._id} reminder={r} />)}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {/* Resolution Modals */}
      {reschedulingReminder && (
        <RescheduleReminderModal
          open={!!reschedulingReminder}
          onClose={() => setReschedulingReminder(null)}
          reminder={reschedulingReminder}
          onRescheduled={handleRescheduled}
        />
      )}

      {completingReminder && (
        <CompleteReminderModal
          open={!!completingReminder}
          onClose={() => setCompletingReminder(null)}
          reminder={completingReminder}
          onCompleted={handleCompleted}
        />
      )}
    </div>
  );
};

export default ReminderBell;
