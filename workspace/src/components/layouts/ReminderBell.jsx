import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../common/Button';

// The reminder sweep raises eleven kinds of nudge — quiet clients, overdue
// promises, contracts renewing, tender deadlines, proposals going cold,
// documents past review, visits with no write-up, unscored e-mail batches,
// birthdays, anniversaries, events. Until now the only place any of them
// appeared was a panel inside Events & Forums, so a tender closing tomorrow
// was announced on a screen about conferences, and everything else was raised
// into a queue nobody could open.
//
// This is the front door: one bell, on every screen, showing everything that
// is due.

// Where each kind of reminder comes from, so a row says what it is about
// before you read the message.
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
};

// Which module to send somebody to when they act on one.
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
};

const ReminderBell = ({ onOpenModule }) => {
  const [reminders, setReminders] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

  const today = reminders.filter((r) => r.reminderType === 'today' || r.reminderType === 'overdue');
  const upcoming = reminders.filter((r) => !today.includes(r));

  const dismiss = async (id) => {
    setReminders((prev) => prev.filter((r) => r._id !== id));
    try {
      await bdApi.actionReminder(id);
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  // The sweep is cron'd for 07:00, but a host that sleeps can miss it, and
  // after a batch of work you want the queue recomputed now.
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

  const Row = ({ reminder }) => (
    <li className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo(reminder)}
          className="text-left min-w-0 flex-1 cursor-pointer group"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {SOURCE_LABEL[reminder.sourceType] || reminder.sourceType}
            {reminder.responsiblePerson ? ` · ${reminder.responsiblePerson}` : ''}
          </span>
          <p className="text-sm text-navy-900 group-hover:text-navy-700">{reminder.message}</p>
        </button>
        <button
          type="button"
          onClick={() => dismiss(reminder._id)}
          aria-label="Dismiss this reminder"
          className="text-slate-400 hover:text-navy-800 cursor-pointer text-xs shrink-0"
        >
          ✕
        </button>
      </div>
    </li>
  );

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
        {today.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
            {today.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Clicking anywhere else closes it, the way a menu should. */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-10 z-40 w-[min(24rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy-900">
                Reminders {reminders.length > 0 && `(${reminders.length})`}
              </h3>
              <Button variant="secondary" onClick={checkNow} disabled={busy}>
                {busy ? 'Checking…' : 'Check now'}
              </Button>
            </div>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                {error}
              </p>
            )}

            {reminders.length === 0 && !error && (
              <p className="text-xs text-slate-500 py-2">
                Nothing needs chasing right now. The sweep runs every morning.
              </p>
            )}

            {today.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700 mb-1.5">
                  Needs attention today
                </p>
                <ul className="space-y-1.5">
                  {today.map((r) => <Row key={r._id} reminder={r} />)}
                </ul>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Coming up
                </p>
                <ul className="space-y-1.5">
                  {upcoming.map((r) => <Row key={r._id} reminder={r} />)}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReminderBell;
