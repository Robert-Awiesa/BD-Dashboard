import { useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import {
  PRIORITIES,
  TASK_STATUSES,
  emptyTaskForm,
  toDateInput,
} from './taskConstants';

// The full form is the *optional* path — quick capture on the landing page is
// the primary one. This exists for when a task genuinely needs an owner, a
// date and a project, not as the price of writing something down.
const TaskFormModal = ({ open, onClose, onSaved, currentUser, existing = null, projects = [], owners = [] }) => {
  const isEditing = Boolean(existing);

  const [form, setForm] = useState(() => {
    if (existing) {
      return {
        ...emptyTaskForm,
        ...existing,
        dueDate: toDateInput(existing.dueDate),
        project: existing.project?._id || existing.project || '',
      };
    }
    return { ...emptyTaskForm, owner: currentUser || '' };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Give the task a title.');

    setSubmitting(true);
    try {
      const payload = { ...form, createdBy: currentUser };
      const saved = isEditing
        ? await bdApi.updateTask(existing._id, payload)
        : await bdApi.addTask(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    try {
      await bdApi.deleteTask(existing._id);
      onSaved(null);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      {isEditing ? (
        <Button variant="danger" onClick={remove}>Delete</Button>
      ) : <span />}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="task-form" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add task'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isEditing ? 'Edit task' : 'New task'}
      description="Standalone work. Anything belonging to an event, client or DG phase is tracked on that record instead."
      footer={footer}
    >
      <form id="task-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="form-label">Title <span className="text-red-600">*</span></label>
          <input
            type="text" value={form.title} onChange={update('title')}
            placeholder="Redesign the pitch deck" className="form-input" autoFocus
          />
        </div>

        <div>
          <label className="form-label">Notes</label>
          <textarea value={form.description} onChange={update('description')} rows={3} className="form-input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Owner</label>
            <input
              type="text" list="task-owners" value={form.owner} onChange={update('owner')}
              placeholder="Who is doing it" className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Due date</label>
            <input type="date" value={form.dueDate} onChange={update('dueDate')} className="form-input" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={update('status')} className="form-input">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Priority</label>
            <select value={form.priority} onChange={update('priority')} className="form-input">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {form.status === 'Blocked' && (
          <div>
            <label className="form-label">What is it blocked on?</label>
            <input
              type="text" value={form.blockedReason} onChange={update('blockedReason')}
              placeholder="Waiting on the agency quote" className="form-input"
            />
          </div>
        )}

        <div>
          <label className="form-label">Project</label>
          <select value={form.project} onChange={update('project')} className="form-input">
            <option value="">— unfiled —</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>

        <datalist id="task-owners">
          {owners.map((o) => <option key={o} value={o} />)}
        </datalist>
      </form>
    </Modal>
  );
};

export default TaskFormModal;
