import { useState } from 'react';
import { bdApi } from '../../context/services/api';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { PROJECT_STATUSES, emptyProjectForm, toDateInput } from './taskConstants';

const ProjectFormModal = ({ open, onClose, onSaved, currentUser, existing = null, owners = [] }) => {
  const isEditing = Boolean(existing);

  const [form, setForm] = useState(() =>
    existing
      ? { ...emptyProjectForm, ...existing, targetDate: toDateInput(existing.targetDate) }
      : { ...emptyProjectForm, owner: currentUser || '' }
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Give the project a name.');
    setSubmitting(true);
    try {
      const saved = isEditing
        ? await bdApi.updateProject(existing._id, form)
        : await bdApi.addProject(form);
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
      await bdApi.deleteProject(existing._id);
      onSaved(null);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      {isEditing && !confirmDelete ? (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
      ) : <span />}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="project-form" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isEditing ? `Edit — ${existing.name}` : 'New project'}
      description="A named bucket with an owner and a target date. Progress is counted from its tasks."
      footer={footer}
    >
      <form id="project-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {confirmDelete && (
          <div className="px-3 py-3 rounded-lg bg-amber-50 border border-amber-300 space-y-2">
            <p className="text-xs text-amber-900">
              Deleting <strong>{existing.name}</strong> keeps its {existing.taskCount || 0} task(s) —
              they simply become unfiled. Nothing is lost.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              <Button variant="danger" onClick={remove}>Delete project</Button>
            </div>
          </div>
        )}

        <div>
          <label className="form-label">Project name <span className="text-red-600">*</span></label>
          <input
            type="text" value={form.name} onChange={update('name')}
            placeholder="Q3 Rebrand" className="form-input" autoFocus
          />
        </div>

        <div>
          <label className="form-label">What is it for?</label>
          <textarea value={form.description} onChange={update('description')} rows={2} className="form-input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Owner</label>
            <input
              type="text" list="project-owners" value={form.owner}
              onChange={update('owner')} className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Target date</label>
            <input type="date" value={form.targetDate} onChange={update('targetDate')} className="form-input" />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={update('status')} className="form-input">
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <datalist id="project-owners">
          {owners.map((o) => <option key={o} value={o} />)}
        </datalist>
      </form>
    </Modal>
  );
};

export default ProjectFormModal;
