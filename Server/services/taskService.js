// ============================================
// Tasks & Projects.
//
// Ownership rule, applied throughout this file:
//   a task belongs to whichever module gives it meaning.
// This service OWNS standalone work (the Task collection) and only MIRRORS the
// rest — event prep checklists, DG phase tasks, client commitments stay on the
// records they belong to. Nothing here copies them; `getMyWork` reads through
// and the caller writes back to the owning module's own endpoint.
// ============================================

const Task = require('../models/Task');
const Project = require('../models/Project');
const Event = require('../models/Event');
const DgEvent = require('../models/DgEvent');
const Client = require('../models/Client');
const Proposal = require('../models/Proposal');
const lookups = require('./lookups');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const daysFromToday = (value) => {
  if (!value) return null;
  const d = new Date(value);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((dOnly - startOfToday()) / MS_PER_DAY);
};

// ====================
// OWNED TASKS
// ====================

const TASK_SORTS = {
  due: { dueDate: 1 },
  created: { createdAt: -1 },
  priority: { priority: 1, dueDate: 1 },
  title: { title: 1 },
};

exports.getTasks = async (filters = {}) => {
  const { owner, status, priority, project, search, includeDone, includeArchived, sort = 'due' } = filters;

  const query = {};
  if (owner) query.owner = owner;
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (project) query.project = project;
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };
  if (!includeDone || includeDone === 'false') query.status = query.status || { $ne: 'Done' };

  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    query.$or = [{ title: rx }, { description: rx }, { owner: rx }];
  }

  return Task.find(query)
    .sort(TASK_SORTS[sort] || TASK_SORTS.due)
    .populate('project', 'name status');
};

exports.getTaskById = async (id) => {
  const task = await Task.findById(id).populate('project', 'name status');
  if (!task) throw new Error('Task not found');
  return task;
};

// Quick capture: a title is genuinely all that is required. If adding a task
// costs a form, nobody adds tasks and the module is dead inside a month.
exports.createTask = async (data) => {
  const title = (data.title || '').trim();
  if (!title) throw new Error('Give the task a title');

  const created = await Task.create({
    title,
    description: data.description || '',
    owner: data.owner || data.createdBy || '',
    createdBy: data.createdBy || '',
    dueDate: data.dueDate || undefined,
    status: data.status || 'To Do',
    priority: data.priority || 'Medium',
    project: data.project || undefined,
    blockedReason: data.blockedReason || '',
  });
  return Task.findById(created._id).populate('project', 'name status');
};

exports.updateTask = async (id, data) => {
  const task = await Task.findById(id);
  if (!task) throw new Error('Task not found');

  const { _id, completedAt, ...updates } = data;
  if (updates.project === '') updates.project = null;
  if (updates.dueDate === '') updates.dueDate = null;
  if (updates.title !== undefined && !String(updates.title).trim()) {
    throw new Error('A task needs a title');
  }

  Object.assign(task, updates);
  await task.save(); // save(), not findByIdAndUpdate — the pre-save hook stamps completedAt
  return Task.findById(task._id).populate('project', 'name status');
};

exports.deleteTask = async (id) => {
  const deleted = await Task.findByIdAndDelete(id);
  if (!deleted) throw new Error('Task not found');
  return deleted;
};

exports.getTaskOwners = async () =>
  lookups.peopleFor([[Task, 'owner'], [Task, 'createdBy']]);

// ====================
// PROJECTS
// ====================

exports.getProjects = async (filters = {}) => {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (!filters.includeArchived || filters.includeArchived === 'false') {
    query.archived = { $ne: true };
  }
  const projects = await Project.find(query).sort({ targetDate: 1, name: 1 });

  // Progress is derived from the tasks, never stored — a stored percentage is
  // one more thing to keep in sync and get wrong.
  const counts = await Task.aggregate([
    { $match: { project: { $ne: null }, archived: { $ne: true } } },
    { $group: { _id: { project: '$project', done: { $eq: ['$status', 'Done'] } }, n: { $sum: 1 } } },
  ]);

  const byProject = {};
  for (const row of counts) {
    const key = String(row._id.project);
    byProject[key] = byProject[key] || { total: 0, done: 0 };
    byProject[key].total += row.n;
    if (row._id.done) byProject[key].done += row.n;
  }

  return projects.map((p) => {
    const c = byProject[String(p._id)] || { total: 0, done: 0 };
    return { ...p.toJSON(), taskCount: c.total, doneCount: c.done };
  });
};

exports.createProject = async (data) => {
  const name = (data.name || '').trim();
  if (!name) throw new Error('Give the project a name');
  return Project.create({
    name,
    description: data.description || '',
    owner: data.owner || '',
    assignees: Array.isArray(data.assignees)
      ? data.assignees.map((a) => String(a).trim()).filter(Boolean)
      : [],
    startDate: data.startDate || undefined,
    targetDate: data.targetDate || undefined,
    status: data.status || 'Active',
  });
};

exports.updateProject = async (id, data) => {
  const { _id, ...updates } = data;
  if (Array.isArray(updates.assignees)) {
    updates.assignees = updates.assignees.map((a) => String(a).trim()).filter(Boolean);
  }
  if (updates.startDate === '') updates.startDate = null;
  if (updates.targetDate === '') updates.targetDate = null;
  const updated = await Project.findByIdAndUpdate(id, updates, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new Error('Project not found');
  return updated;
};

// Deleting a project must not delete the work in it — the tasks simply become
// unfiled again.
exports.deleteProject = async (id) => {
  const project = await Project.findById(id);
  if (!project) throw new Error('Project not found');
  await Task.updateMany({ project: id }, { $set: { project: null } });
  await project.deleteOne();
  return project;
};

// ====================
// MY WORK — the read-through aggregation
// ====================

// Every borrowed item carries the routing information needed to write back to
// its real owner, so the UI can tick it off without this service ever holding a
// copy of it. `origin.type` tells the client which endpoint to call.
const shapeItem = ({ key, source, origin, title, owner, dueDate, done, priority, context, contextId }) => ({
  key,
  source,
  origin,
  title,
  owner: owner || '',
  dueDate: dueDate || null,
  daysToDue: daysFromToday(dueDate),
  done: Boolean(done),
  priority: priority || null,
  context: context || '',
  contextId: contextId || null,
  // Only work this module owns can be edited in full here; the rest is a
  // read-through mirror with a tick box.
  editableHere: source === 'Task',
});

exports.getMyWork = async (filters = {}) => {
  const { owner, includeDone } = filters;
  const wantDone = includeDone === 'true' || includeDone === true;
  const items = [];

  // --- Owned: standalone tasks ---
  const taskQuery = { archived: { $ne: true } };
  if (owner) taskQuery.owner = owner;
  if (!wantDone) taskQuery.status = { $ne: 'Done' };
  const tasks = await Task.find(taskQuery).populate('project', 'name');
  for (const t of tasks) {
    items.push(shapeItem({
      key: `task:${t._id}`,
      source: 'Task',
      origin: { type: 'task', id: String(t._id) },
      title: t.title,
      owner: t.owner,
      dueDate: t.dueDate,
      done: t.status === 'Done',
      priority: t.priority,
      context: t.project?.name || '',
      contextId: t.project?._id || null,
      status: t.status,
    }));
  }

  // --- Mirrored: event prep checklists ---
  const eventQuery = { cancelled: false };
  if (owner) eventQuery['prepChecklist.assignedTo'] = owner;
  const events = await Event.find(eventQuery).select('title prepChecklist startDate');
  for (const event of events) {
    for (const task of event.prepChecklist || []) {
      if (owner && task.assignedTo !== owner) continue;
      if (!wantDone && task.completed) continue;
      items.push(shapeItem({
        key: `event:${event._id}:${task._id}`,
        source: 'Event',
        origin: { type: 'event', id: String(event._id), itemId: String(task._id) },
        title: task.taskName,
        owner: task.assignedTo,
        dueDate: task.dueDate || event.startDate,
        done: task.completed,
        context: event.title,
        contextId: event._id,
      }));
    }
  }

  // --- Mirrored: DG event phase tasks ---
  const dgEvents = await DgEvent.find().select('title phases');
  for (const dg of dgEvents) {
    for (const phase of dg.phases || []) {
      for (const task of phase.tasks || []) {
        if (owner && task.teamLead !== owner) continue;
        if (!wantDone && task.completed) continue;
        items.push(shapeItem({
          key: `dg:${dg._id}:${phase._id}:${task._id}`,
          source: 'DG Event',
          origin: {
            type: 'dgEvent', id: String(dg._id),
            phaseId: String(phase._id), itemId: String(task._id),
          },
          title: task.taskName,
          owner: task.teamLead,
          dueDate: task.dueDate || phase.targetDate,
          done: task.completed,
          context: `${dg.title || 'DG Event'} · ${phase.name}`,
          contextId: dg._id,
        }));
      }
    }
  }

  // --- Mirrored: proposal checklists ---
  const proposalQuery = { archived: { $ne: true }, stage: { $nin: Proposal.CLOSED_STAGES } };
  if (owner) proposalQuery['checklist.assignedTo'] = owner;
  const proposals = await Proposal.find(proposalQuery).select('title checklist submissionDeadline');
  for (const proposal of proposals) {
    for (const item of proposal.checklist || []) {
      if (owner && item.assignedTo !== owner) continue;
      if (!wantDone && item.completed) continue;
      items.push(shapeItem({
        key: `proposal:${proposal._id}:${item._id}`,
        source: 'Proposal',
        origin: { type: 'proposal', id: String(proposal._id), itemId: String(item._id) },
        title: item.taskName,
        owner: item.assignedTo,
        // Bid work inherits the submission deadline when it has no date of its
        // own — everything on a proposal is due before the proposal is.
        dueDate: item.dueDate || proposal.submissionDeadline,
        done: item.completed,
        context: proposal.title,
        contextId: proposal._id,
      }));
    }
  }

  // --- Mirrored: client commitments ---
  const clientQuery = { archived: { $ne: true } };
  if (owner) clientQuery['commitments.owner'] = owner;
  const clients = await Client.find(clientQuery).select('name commitments');
  for (const client of clients) {
    for (const commitment of client.commitments || []) {
      if (owner && commitment.owner !== owner) continue;
      if (!wantDone && commitment.completed) continue;
      items.push(shapeItem({
        key: `client:${client._id}:${commitment._id}`,
        source: 'Client',
        origin: { type: 'client', id: String(client._id), itemId: String(commitment._id) },
        title: commitment.description,
        owner: commitment.owner,
        dueDate: commitment.dueDate,
        done: commitment.completed,
        context: client.name,
        contextId: client._id,
      }));
    }
  }

  // Undated work sorts last: a due date is a commitment, no date is an intention.
  items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });

  return items;
};

// Everyone with work assigned anywhere, so the "whose work" picker offers real
// names rather than a free-text box.
// Work is mirrored from five places, so this spans all of them — plus the
// shared roster, so somebody with no work assigned yet is still selectable.
exports.getWorkOwners = async () =>
  lookups.peopleFor(
    [
      [Task, 'owner'],
      [Event, 'prepChecklist.assignedTo'],
      [DgEvent, 'phases.tasks.teamLead'],
      [Client, 'commitments.owner'],
      [Proposal, 'checklist.assignedTo'],
    ],
    { includeArchived: true }
  );

exports.getWorkStats = async (owner) => {
  const items = await exports.getMyWork({ owner });
  const open = items.filter((i) => !i.done);

  const bucket = { overdue: 0, today: 0, thisWeek: 0, later: 0, noDate: 0 };
  for (const item of open) {
    if (item.daysToDue === null) bucket.noDate += 1;
    else if (item.daysToDue < 0) bucket.overdue += 1;
    else if (item.daysToDue === 0) bucket.today += 1;
    else if (item.daysToDue <= 7) bucket.thisWeek += 1;
    else bucket.later += 1;
  }

  const bySource = {};
  for (const item of open) {
    bySource[item.source] = (bySource[item.source] || 0) + 1;
  }

  return { totals: { open: open.length, ...bucket }, bySource };
};
