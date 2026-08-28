/**
 * The working-tools launcher.
 *
 * A shared list of links, so a shortcut one person adds is on everybody's
 * launcher. Same rules as the rest of the workspace: archive before delete,
 * no duplicates, and the URL normalised in one place.
 */
const Tool = require('../models/Tool');

const escapeRx = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clean = (value) => (value === null || value === undefined ? '' : String(value).trim());

const buildPayload = (data) => ({
  name: clean(data.name),
  url: clean(data.url),
  desc: clean(data.desc),
  category: clean(data.category) || 'Custom',
  icon: clean(data.icon) || '🌐',
  addedBy: clean(data.addedBy),
});

const validate = (payload) => {
  if (!payload.name) throw new Error('Give the tool a name');
  if (!payload.url) throw new Error('A tool needs a link, otherwise there is nothing to launch');
};

// Two rows pointing at the same place is just clutter on a launcher. Compared
// after the model has added the protocol, so "apollo.io" and
// "https://apollo.io" count as the same tool.
const withProtocol = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const findDuplicate = async (url, exceptId) => {
  const query = {
    url: new RegExp(`^${escapeRx(withProtocol(url))}/?$`, 'i'),
    archived: { $ne: true },
  };
  if (exceptId) query._id = { $ne: exceptId };
  return Tool.findOne(query);
};

// A brand new workspace opens on an empty grid otherwise. Archived rows still
// count, so a team that retired every default does not get them back. Both
// entry points call this — an import must not be able to skip the seed and
// leave the launcher holding one browser's list and nothing else.
const ensureSeeded = async () => {
  if ((await Tool.estimatedDocumentCount()) > 0) return;
  try {
    await Tool.insertMany(Tool.DEFAULT_TOOLS.map((t) => ({ ...t, isDefault: true })));
  } catch (err) {
    // A concurrent first request seeded it first; the unique index says so.
    if (err.code !== 11000) throw err;
  }
};

exports.getTools = async (filters = {}) => {
  const { category, includeArchived, search } = filters;
  await ensureSeeded();

  const query = {};
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };
  if (category && category !== 'All') query.category = category;
  if (search && search.trim()) {
    const rx = new RegExp(escapeRx(search.trim()), 'i');
    query.$or = [{ name: rx }, { desc: rx }, { category: rx }, { url: rx }];
  }
  return Tool.find(query).sort({ category: 1, name: 1 });
};

// The pre-check gives a message naming the tool already using the link; the
// unique index catches the case where two requests pass the check together.
const asDuplicateError = async (err, url) => {
  if (err.code !== 11000) return err;
  const owner = await findDuplicate(url);
  return new Error(`"${owner ? owner.name : 'Another tool'}" already points at that link`);
};

exports.createTool = async (data) => {
  const payload = buildPayload(data);
  validate(payload);
  const duplicate = await findDuplicate(payload.url);
  if (duplicate) throw new Error(`"${duplicate.name}" already points at that link`);
  try {
    return await Tool.create(payload);
  } catch (err) {
    throw await asDuplicateError(err, payload.url);
  }
};

exports.updateTool = async (id, data) => {
  const tool = await Tool.findById(id);
  if (!tool) throw new Error('Tool not found');
  const { _id, archived, archivedAt, isDefault, ...rest } = data;
  const payload = buildPayload({ ...tool.toObject(), ...rest });
  validate(payload);
  const duplicate = await findDuplicate(payload.url, tool._id);
  if (duplicate) throw new Error(`"${duplicate.name}" already points at that link`);
  Object.assign(tool, payload);
  try {
    await tool.save();
  } catch (err) {
    throw await asDuplicateError(err, payload.url);
  }
  return tool;
};

exports.setToolArchived = async (id, archived) => {
  const tool = await Tool.findById(id);
  if (!tool) throw new Error('Tool not found');
  tool.archived = Boolean(archived);
  tool.archivedAt = tool.archived ? new Date() : undefined;
  await tool.save();
  return tool;
};

// Archive before delete, as everywhere else.
exports.deleteTool = async (id) => {
  const tool = await Tool.findById(id);
  if (!tool) throw new Error('Tool not found');
  if (!tool.archived) {
    throw new Error('Archive this tool before deleting — it is on everyone else\'s launcher too.');
  }
  await tool.deleteOne();
  return tool;
};

/**
 * One-time move of a browser's localStorage launcher onto the shared list.
 * Only links nobody has added yet are taken, so running it from a second
 * machine adds that machine's extras rather than duplicating the list.
 */
exports.importTools = async (rows = [], addedBy = '') => {
  await ensureSeeded();
  const added = [];
  const skipped = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const payload = buildPayload({ ...row, addedBy: clean(row.addedBy) || addedBy });
    if (!payload.name || !payload.url) {
      skipped.push({ name: payload.name || '(unnamed)', reason: 'missing a name or a link' });
      continue;
    }
    if (await findDuplicate(payload.url)) {
      skipped.push({ name: payload.name, reason: 'already on the launcher' });
      continue;
    }
    try {
      added.push(await Tool.create(payload));
    } catch (err) {
      if (err.code !== 11000) throw err;
      // Another import got there between the check and the insert.
      skipped.push({ name: payload.name, reason: 'already on the launcher' });
    }
  }
  return { added, skipped };
};
