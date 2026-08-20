import { useEffect, useRef, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import TaskFormModal from './TaskFormModal';
import ProjectFormModal from './ProjectFormModal';
import {
  BUCKETS,
  PRIORITY_BADGE,
  PROJECT_STATUS_BADGE,
  SOURCE_CHIP,
  STATUS_BADGE,
  bucketFor,
  dueLabel,
  formatDate,
} from './taskConstants';

const TABS = [
  { id: 'work', label: 'My work' },
  { id: 'tasks', label: 'All tasks' },
  { id: 'projects', label: 'Projects' },
];

const StatTile = ({ label, value, tone = 'default' }) => {
  const tones = { default: 'text-navy-900', warn: 'text-amber-700', danger: 'text-red-700', muted: 'text-slate-400' };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className={`text-xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</p>
    </div>
  );
};

// One row for every kind of work, owned or borrowed. The source chip is what
// tells you where it actually lives — and borrowed rows get a tick box but no
// edit affordance, because editing belongs to the owning module.
const WorkRow = ({ item, onToggle, onEdit, busy }) => {
  const chip = SOURCE_CHIP[item.source] || SOURCE_CHIP.Task;
  const overdue = item.daysToDue !== null && item.daysToDue < 0;

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
      <input
        type="checkbox"
        checked={item.done}
        disabled={busy}
        onChange={() => onToggle(item)}
        className="mt-1 accent-forest-600 cursor-pointer shrink-0"
        aria-label={`Mark "${item.title}" ${item.done ? 'not done' : 'done'}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.editableHere ? (
            <button
              onClick={() => onEdit(item)}
              className="text-sm text-navy-900 hover:text-navy-700 hover:underline text-left cursor-pointer"
            >
              {item.title}
            </button>
          ) : (
            <span className="text-sm text-navy-900">{item.title}</span>
          )}
          {item.priority && item.priority !== 'Medium' && (
            <Badge label={item.priority} status={PRIORITY_BADGE[item.priority]} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${chip.className}`}>
            {chip.icon} {item.source}
          </span>
          {item.context && <span className="text-[11px] text-slate-500 truncate">{item.context}</span>}
          {item.owner && <span className="text-[11px] text-slate-400">· {item.owner}</span>}
        </div>
      </div>
      <span className={`shrink-0 text-[11px] whitespace-nowrap ${overdue ? 'text-red-700 font-medium' : 'text-slate-500'}`}>
        {dueLabel(item.daysToDue)}
      </span>
    </div>
  );
};

const TasksModule = () => {
  const { currentUser, clientDataVersion } = useDashboard();

  const [tab, setTab] = useState('work');
  // `null` means "not chosen yet", which derives to the active team member.
  // Derived rather than synced through an effect so there is no render where
  // the list is briefly showing the wrong person's work.
  const [ownerChoice, setOwnerChoice] = useState(null);
  const owner = ownerChoice === null ? (currentUser || '') : ownerChoice;
  const [work, setWork] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [owners, setOwners] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [busyKey, setBusyKey] = useState(null);

  const [capture, setCapture] = useState('');
  const [capturing, setCapturing] = useState(false);
  const captureRef = useRef(null);

  const [taskForm, setTaskForm] = useState({ open: false, task: null });
  const [projectForm, setProjectForm] = useState({ open: false, project: null });
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = () => setRefreshToken((t) => t + 1);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      bdApi.getMyWork({ owner, includeDone: showDone ? 'true' : '' }),
      bdApi.getWorkStats(owner),
      bdApi.getTasks({ includeDone: 'true' }),
      bdApi.getProjects(),
      bdApi.getWorkOwners(),
    ])
      .then(([w, s, t, p, o]) => {
        if (ignore) return;
        setWork(w);
        setStats(s);
        setTasks(t);
        setProjects(p);
        setOwners(o);
        setError(null);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [owner, showDone, refreshToken, clientDataVersion]);

  // One field, one Enter. Details are optional and can be added later — if
  // capture costs a form, nothing gets captured.
  const quickCapture = async (e) => {
    e.preventDefault();
    const title = capture.trim();
    if (!title) return;
    setCapturing(true);
    try {
      await bdApi.addTask({ title, owner: owner || currentUser, createdBy: currentUser });
      setCapture('');
      refresh();
      captureRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturing(false);
    }
  };

  // Routes the write back to whichever module owns the item.
  const toggle = async (item) => {
    setBusyKey(item.key);
    try {
      await bdApi.setWorkItemDone(item.origin, !item.done);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  };

  const editItem = (item) => {
    const task = tasks.find((t) => t._id === item.origin.id);
    if (task) setTaskForm({ open: true, task });
  };

  const grouped = BUCKETS.map((bucket) => ({
    ...bucket,
    items: work.filter((i) => !i.done && bucketFor(i) === bucket.id),
  })).filter((g) => g.items.length > 0);

  const doneItems = work.filter((i) => i.done);

  const modals = (
    <>
      {taskForm.open && (
        <TaskFormModal
          open
          onClose={() => setTaskForm({ open: false, task: null })}
          onSaved={refresh}
          currentUser={currentUser}
          existing={taskForm.task}
          projects={projects}
          owners={owners}
        />
      )}
      {projectForm.open && (
        <ProjectFormModal
          open
          onClose={() => setProjectForm({ open: false, project: null })}
          onSaved={refresh}
          currentUser={currentUser}
          existing={projectForm.project}
          owners={owners}
        />
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Tasks & Projects</h1>
          <p className="text-sm text-slate-600">
            Everything on your plate — standalone work here, plus what you owe from events, clients and the DG programme.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setProjectForm({ open: true, project: null })}>
            + New project
          </Button>
          <Button variant="primary" onClick={() => setTaskForm({ open: true, task: null })}>
            + New task
          </Button>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {!currentUser && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Set the active team member in Reports &amp; Docs — new tasks are assigned to that name by default.
        </div>
      )}

      {/* Quick capture: the primary way work gets written down. */}
      <form onSubmit={quickCapture} className="flex gap-2">
        <input
          ref={captureRef}
          type="text"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          placeholder="Type a task and press Enter — details optional"
          className="form-input"
          disabled={capturing}
        />
        <Button variant="primary" type="submit" disabled={capturing || !capture.trim()}>
          {capturing ? 'Adding…' : 'Add'}
        </Button>
      </form>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Open items" value={stats.totals.open} />
          <StatTile label="Overdue" value={stats.totals.overdue} tone={stats.totals.overdue > 0 ? 'danger' : 'default'} />
          <StatTile label="Due today" value={stats.totals.today} tone={stats.totals.today > 0 ? 'warn' : 'default'} />
          <StatTile label="This week" value={stats.totals.thisWeek} />
          <StatTile label="Later" value={stats.totals.later} />
          <StatTile label="No date" value={stats.totals.noDate} tone="muted" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
                tab === t.id ? 'border-navy-700 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'
              }`}
            >
              {t.label}
              {t.id === 'projects' && projects.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{projects.length}</span>
              )}
            </button>
          ))}
        </div>
        {tab === 'work' && (
          <div className="flex items-center gap-2 pb-1.5">
            {/* Anyone can look at anyone's list — the workspace is open, and
                "what is Ada carrying this week" is a fair question. */}
            <select
              value={owner}
              onChange={(e) => setOwnerChoice(e.target.value)}
              className="form-input text-sm"
              aria-label="Whose work"
            >
              <option value="">Everyone</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)}
                className="accent-navy-700 cursor-pointer"
              />
              Show done
            </label>
          </div>
        )}
      </div>

      {/* --- My work --- */}
      {tab === 'work' && (
        loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        ) : grouped.length === 0 && doneItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="text-3xl mb-2" aria-hidden="true">✅</p>
            <h3 className="text-base font-semibold text-navy-900">
              {owner ? `Nothing on ${owner}'s plate` : 'Nothing outstanding'}
            </h3>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              This list also picks up event prep tasks, client commitments and DG phase tasks assigned to you —
              so an empty list here really does mean clear.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className={`px-4 py-2 border-b border-slate-200 ${
                  group.tone === 'danger' ? 'bg-red-50' : group.tone === 'warn' ? 'bg-amber-50' : 'bg-slate-50'
                }`}>
                  <h3 className={`text-xs font-semibold ${
                    group.tone === 'danger' ? 'text-red-800' : group.tone === 'warn' ? 'text-amber-800' : 'text-navy-900'
                  }`}>
                    {group.label} <span className="text-slate-500 font-normal">({group.items.length})</span>
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <WorkRow
                      key={item.key} item={item} onToggle={toggle}
                      onEdit={editItem} busy={busyKey === item.key}
                    />
                  ))}
                </div>
              </div>
            ))}

            {showDone && doneItems.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden opacity-70">
                <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-xs font-semibold text-slate-600">Done ({doneItems.length})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {doneItems.map((item) => (
                    <WorkRow
                      key={item.key} item={item} onToggle={toggle}
                      onEdit={editItem} busy={busyKey === item.key}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* --- All tasks (owned work only) --- */}
      {tab === 'tasks' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Standalone work owned by this module. Event, client and DG obligations live on their own records
            and appear under <strong>My work</strong>.
          </p>
          {tasks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-600">No standalone tasks yet. Use the box above.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
              {tasks.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setTaskForm({ open: true, task: t })}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-sm ${t.status === 'Done' ? 'text-slate-400 line-through' : 'text-navy-900'}`}>
                        {t.title}
                      </span>
                      <Badge label={t.status} status={STATUS_BADGE[t.status]} />
                      {t.priority !== 'Medium' && <Badge label={t.priority} status={PRIORITY_BADGE[t.priority]} />}
                    </div>
                    <span className={`text-[11px] shrink-0 ${t.overdue ? 'text-red-700' : 'text-slate-500'}`}>
                      {t.dueDate ? formatDate(t.dueDate) : 'no date'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 mt-0.5 text-[11px] text-slate-500">
                    {t.owner && <span>{t.owner}</span>}
                    {t.project && <span>· {t.project.name}</span>}
                    {t.status === 'Blocked' && t.blockedReason && (
                      <span className="text-red-700">· blocked: {t.blockedReason}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Projects --- */}
      {tab === 'projects' && (
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-600">
                No projects yet. A project is just a named bucket for grouping tasks.
              </p>
              <div className="flex justify-center mt-3">
                <Button variant="primary" onClick={() => setProjectForm({ open: true, project: null })}>
                  + New project
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p) => {
                const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
                return (
                  <button
                    key={p._id}
                    onClick={() => setProjectForm({ open: true, project: p })}
                    className="text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-navy-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-navy-900 truncate">{p.name}</h3>
                      <Badge label={p.status} status={PROJECT_STATUS_BADGE[p.status]} />
                    </div>
                    {p.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{p.description}</p>}

                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-forest-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
                        <span>{p.doneCount}/{p.taskCount} done</span>
                        <span>
                          {p.owner && `${p.owner} · `}
                          {p.targetDate ? formatDate(p.targetDate) : 'no target'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modals}
    </div>
  );
};

export default TasksModule;
