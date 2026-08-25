import { useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';

// Each DG stage carries its own attributes and its own spend, on top of the
// activities it always runs through. The fields are not hard-coded here — the
// server publishes them per stage in /dg-event/meta, so adding one is a single
// line in STAGE_SPEC and this renders it without changing.

const money = (value) => {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const emptyExpense = { description: '', amount: '', incurredAt: '', paidBy: '' };

const DgStagePanel = ({ dgEventId, phase, spec, currentUser, onChanged }) => {
  // Attributes arrive as a plain object from the API's Map serialisation.
  const stored = phase.attributes || {};
  const [attrs, setAttrs] = useState(() =>
    Object.fromEntries((spec?.fields || []).map((f) => [f.key, stored[f.key] ?? '']))
  );
  const [expense, setExpense] = useState(emptyExpense);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAttributes = () =>
    run(() => bdApi.setDgPhaseAttributes(dgEventId, phase._id, attrs));

  const addExpense = () =>
    run(async () => {
      const saved = await bdApi.addDgPhaseExpense(dgEventId, phase._id, {
        ...expense,
        paidBy: expense.paidBy || currentUser || '',
      });
      setExpense(emptyExpense);
      return saved;
    });

  const removeExpense = (expenseId) =>
    run(() => bdApi.deleteDgPhaseExpense(dgEventId, phase._id, expenseId));

  const setBlocked = (blocked) =>
    run(() =>
      bdApi.updateDgPhase(dgEventId, phase._id, {
        blocked,
        blockedReason: blocked ? phase.blockedReason || '' : '',
      })
    );

  const saveStageFields = (updates) =>
    run(() => bdApi.updateDgPhase(dgEventId, phase._id, updates));

  const spent = (phase.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-4 pt-3 border-t border-slate-200">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Who owns this stage and when it runs. Stages overlap, so each carries
          its own dates rather than inheriting a position in a queue. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="form-label">Stage owner</label>
          <input
            type="text"
            defaultValue={phase.owner || ''}
            onBlur={(e) => e.target.value !== (phase.owner || '') && saveStageFields({ owner: e.target.value })}
            className="form-input"
            placeholder="Who is running it"
          />
        </div>
        <div>
          <label className="form-label">Starts</label>
          <input
            type="date"
            defaultValue={phase.startDate ? String(phase.startDate).slice(0, 10) : ''}
            onBlur={(e) => saveStageFields({ startDate: e.target.value })}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Target</label>
          <input
            type="date"
            defaultValue={phase.targetDate ? String(phase.targetDate).slice(0, 10) : ''}
            onBlur={(e) => saveStageFields({ targetDate: e.target.value })}
            className="form-input"
          />
        </div>
      </div>

      {/* Blocked is a judgement, not something the clock can derive — and it
          needs a reason or nobody else can pick it up. */}
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(phase.blocked)}
            onChange={(e) => setBlocked(e.target.checked)}
            className="accent-red-600 cursor-pointer"
            disabled={busy}
          />
          This stage is blocked
        </label>
        {phase.blocked && (
          <input
            type="text"
            defaultValue={phase.blockedReason || ''}
            onBlur={(e) => saveStageFields({ blocked: true, blockedReason: e.target.value })}
            placeholder="What is blocking it?"
            className="form-input mt-2"
          />
        )}
      </div>

      {/* The stage's own attributes, rendered from the server's spec. */}
      {(spec?.fields || []).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            {phase.name} details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {spec.fields.map((field) => (
              <div key={field.key}>
                <label className="form-label" htmlFor={`${phase._id}-${field.key}`}>{field.label}</label>
                {field.type === 'choice' ? (
                  <select
                    id={`${phase._id}-${field.key}`}
                    value={attrs[field.key] || ''}
                    onChange={(e) => setAttrs((a) => ({ ...a, [field.key]: e.target.value }))}
                    className="form-input"
                  >
                    <option value="">Select…</option>
                    {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    id={`${phase._id}-${field.key}`}
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    inputMode={field.type === 'number' ? 'numeric' : undefined}
                    value={attrs[field.key] || ''}
                    onChange={(e) => setAttrs((a) => ({ ...a, [field.key]: e.target.value }))}
                    className="form-input"
                    placeholder={field.type === 'link' ? 'https://…' : ''}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-2">
            <Button variant="secondary" onClick={saveAttributes} disabled={busy}>
              {busy ? 'Saving…' : 'Save details'}
            </Button>
          </div>
        </div>
      )}

      {/* Spend is recorded where it happens; the event total is the sum. */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Expenses
          </p>
          <span className="text-xs text-slate-600">
            {spent > 0 ? `${money(spent)} on this stage` : 'nothing spent yet'}
          </span>
        </div>

        {(phase.expenses || []).length > 0 && (
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white mb-2">
            {phase.expenses.map((e) => (
              <li key={e._id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0">
                  <span className="text-sm text-navy-900">{e.description}</span>
                  <span className="block text-[11px] text-slate-500">
                    {formatDate(e.incurredAt)}{e.paidBy ? ` · ${e.paidBy}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-navy-900">{money(e.amount)}</span>
                  <button
                    type="button"
                    onClick={() => removeExpense(e._id)}
                    aria-label={`Remove ${e.description}`}
                    className="text-slate-400 hover:text-red-600 cursor-pointer text-xs"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2">
          <input
            type="text"
            value={expense.description}
            onChange={(e) => setExpense((x) => ({ ...x, description: e.target.value }))}
            placeholder="What was it for"
            className="form-input"
          />
          <input
            type="number"
            min="0"
            value={expense.amount}
            onChange={(e) => setExpense((x) => ({ ...x, amount: e.target.value }))}
            placeholder="Amount"
            className="form-input"
          />
          <input
            type="date"
            value={expense.incurredAt}
            onChange={(e) => setExpense((x) => ({ ...x, incurredAt: e.target.value }))}
            className="form-input"
          />
          <Button variant="secondary" onClick={addExpense} disabled={busy}>Add</Button>
        </div>
      </div>
    </div>
  );
};

export default DgStagePanel;
