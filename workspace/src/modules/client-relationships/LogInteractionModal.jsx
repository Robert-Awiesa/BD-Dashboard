import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { INTERACTION_ICON, INTERACTION_TYPES, SENTIMENTS, SENTIMENT_ICON } from './clientConstants';

/**
 * The ten-second log.
 *
 * This is the load-bearing screen of the whole module: if filing a call takes a
 * twelve-field form, nobody files anything and Client Relations becomes an
 * empty directory within a month. So the required path is three controls —
 * which client, what kind of touch, one line of what happened — and everything
 * else is tucked behind "Add more detail".
 *
 * Reachable from the header's Quick Log on every screen, and from a client
 * record (where `lockedClient` pre-selects and hides the picker).
 */
const LogInteractionModal = ({ open, onClose, onLogged, lockedClient = null }) => {
  const { currentUser, bumpClientData } = useDashboard();

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    client: lockedClient?._id || '',
    type: 'Call',
    summary: '',
    detail: '',
    contactName: '',
    sentiment: 'Neutral',
    occurredAt: new Date().toISOString().slice(0, 10),
    followUpNeeded: false,
    commitmentDescription: '',
    commitmentDue: '',
  });

  useEffect(() => {
    let ignore = false;
    bdApi.getClients({ sort: 'name' })
      .then((list) => { if (!ignore) setClients(list); })
      .catch(() => { if (!ignore) setClients([]); })
      .finally(() => { if (!ignore) setLoadingClients(false); });
    return () => { ignore = true; };
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) return setError('Set the active team member in Reports & Docs first — logs are attributed to that name.');
    if (!form.client) return setError('Pick which client this was with.');
    if (!form.summary.trim()) return setError('Add a one-line summary of what happened.');

    setSubmitting(true);
    try {
      const saved = await bdApi.logInteraction({
        ...form,
        loggedBy: currentUser,
        commitmentOwner: currentUser,
        occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
      });
      bumpClientData();
      onLogged?.(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        Logged by <strong className="text-navy-800">{currentUser || '—'}</strong>
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="log-interaction-form" disabled={submitting}>
          {submitting ? 'Saving…' : 'Log it'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={lockedClient ? `Log interaction — ${lockedClient.name}` : 'Log a client interaction'}
      description="One line is enough. Detail is optional and can be added later."
      footer={footer}
    >
      <form id="log-interaction-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {!lockedClient && (
          <div>
            <label className="form-label">Client <span className="text-red-600">*</span></label>
            <select value={form.client} onChange={update('client')} className="form-input" autoFocus>
              <option value="">{loadingClients ? 'Loading…' : 'Select a client…'}</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            {!loadingClients && clients.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No clients yet — add one in Client Relations first.
              </p>
            )}
          </div>
        )}

        {/* Type as buttons rather than a dropdown: one tap, no menu. */}
        <div>
          <label className="form-label">What kind of touch?</label>
          <div className="flex flex-wrap gap-1.5">
            {INTERACTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  form.type === t
                    ? 'bg-navy-700 text-white border-navy-700'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400'
                }`}
              >
                {INTERACTION_ICON[t]} {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">What happened? <span className="text-red-600">*</span></label>
          <input
            type="text"
            value={form.summary}
            onChange={update('summary')}
            placeholder="Quarterly check-in — happy, wants pricing for two more sites"
            className="form-input"
            autoFocus={Boolean(lockedClient)}
          />
        </div>

        <div>
          <label className="form-label">How did it feel?</label>
          <div className="flex gap-1.5">
            {SENTIMENTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, sentiment: s }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  form.sentiment === s
                    ? 'bg-navy-700 text-white border-navy-700'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-navy-400'
                }`}
              >
                {SENTIMENT_ICON[s]} {s}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-navy-700 hover:text-navy-900 cursor-pointer"
        >
          {expanded ? '− Less' : '+ Add more detail, a date, or a commitment'}
        </button>

        {expanded && (
          <div className="space-y-4 pt-1 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <div>
                <label className="form-label">When</label>
                <input type="date" value={form.occurredAt} onChange={update('occurredAt')} className="form-input" />
              </div>
              <div>
                <label className="form-label">Who you spoke to</label>
                <input type="text" value={form.contactName} onChange={update('contactName')} className="form-input" placeholder="Ama Owusu" />
              </div>
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea value={form.detail} onChange={update('detail')} rows={3} className="form-input" />
            </div>

            {/* Promising something and recording it is one action for the user,
                so the commitment is captured here rather than in a second form. */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
              <p className="text-xs font-semibold text-navy-900">Did you promise them anything?</p>
              <input
                type="text"
                value={form.commitmentDescription}
                onChange={update('commitmentDescription')}
                placeholder="Send revised pricing for the two new sites"
                className="form-input"
              />
              {form.commitmentDescription.trim() && (
                <div>
                  <label className="form-label">By when</label>
                  <input type="date" value={form.commitmentDue} onChange={update('commitmentDue')} className="form-input" />
                  <p className="text-xs text-slate-500 mt-1">
                    Overdue promises flag the account in the attention queue.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default LogInteractionModal;
