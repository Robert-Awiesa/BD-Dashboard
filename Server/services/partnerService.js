/**
 * The partner directory.
 *
 * Deliberately small: find them, read what they offer, get somebody to call.
 * Everything else the workspace does to a record — archive before delete, one
 * shared roster for people, computed rather than stored — applies here too.
 */
const Partner = require('../models/Partner');
const lookups = require('./lookups');

// A partner called "C++ (Ghana)" must not blow up a search.
const escapeRx = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clean = (value) => (value === null || value === undefined ? '' : String(value).trim());

const buildPayload = (data) => ({
  name: clean(data.name),
  offering: clean(data.offering),
  website: clean(data.website),
  location: clean(data.location),
  relationshipOwner: clean(data.relationshipOwner),
  partnerSince: data.partnerSince ? new Date(data.partnerSince) : undefined,
  contacts: Array.isArray(data.contacts)
    ? data.contacts
        .map((c) => ({
          name: clean(c.name),
          role: clean(c.role),
          email: clean(c.email),
          phone: clean(c.phone),
          isPrimary: Boolean(c.isPrimary),
          notes: clean(c.notes),
        }))
        .filter((c) => c.name)
    : [],
  notes: clean(data.notes),
});

const validate = (payload) => {
  if (!payload.name) throw new Error('A partner needs a name');
  if (!payload.offering) {
    throw new Error('Say what this partner offers us — that is what someone searching will read');
  }
};

exports.getPartners = async (filters = {}) => {
  const { search, owner, includeArchived } = filters;
  const query = {};
  if (!includeArchived || includeArchived === 'false') query.archived = { $ne: true };
  if (owner) query.relationshipOwner = owner;
  if (search && search.trim()) {
    // Search the things somebody would actually remember: who they are, what
    // they do for us, and the name of the person they spoke to.
    const rx = new RegExp(escapeRx(search.trim()), 'i');
    query.$or = [
      { name: rx }, { offering: rx }, { location: rx },
      { notes: rx }, { 'contacts.name': rx }, { 'contacts.role': rx },
    ];
  }
  return Partner.find(query).sort({ name: 1 });
};

exports.getPartnerById = async (id) => {
  const partner = await Partner.findById(id);
  if (!partner) throw new Error('Partner not found');
  return partner;
};

exports.createPartner = async (data) => {
  const payload = buildPayload(data);
  validate(payload);
  const existing = await Partner.findOne({
    name: new RegExp(`^${escapeRx(payload.name)}$`, 'i'),
    archived: { $ne: true },
  });
  if (existing) throw new Error(`"${payload.name}" is already in the directory`);
  return Partner.create(payload);
};

exports.updatePartner = async (id, data) => {
  const partner = await Partner.findById(id);
  if (!partner) throw new Error('Partner not found');
  const { _id, archived, archivedAt, ...rest } = data;
  const payload = buildPayload({ ...partner.toObject(), ...rest });
  validate(payload);
  Object.assign(partner, payload);
  await partner.save();
  return partner;
};

exports.setPartnerArchived = async (id, archived) => {
  const partner = await Partner.findById(id);
  if (!partner) throw new Error('Partner not found');
  partner.archived = Boolean(archived);
  partner.archivedAt = partner.archived ? new Date() : undefined;
  await partner.save();
  return partner;
};

// Archive before delete, the same rule the rest of the workspace uses: a
// partner removed by a misclick takes their contact details with them.
exports.deletePartner = async (id) => {
  const partner = await Partner.findById(id);
  if (!partner) throw new Error('Partner not found');
  if (!partner.archived) {
    throw new Error('Archive this partner before deleting — their contact details go with it.');
  }
  await partner.deleteOne();
  return partner;
};

// Relationship owners come from the shared roster plus whoever is already on a
// record, so somebody new is selectable before they own anything.
exports.getPartnerOwners = async () => lookups.peopleFor([[Partner, 'relationshipOwner']]);
