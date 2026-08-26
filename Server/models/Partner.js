const mongoose = require('mongoose');

/**
 * The partner directory.
 *
 * Not a CRM and not a pipeline: the point is that anyone in the workspace can
 * see who we partner with, what each one offers us, and how to reach them
 * without asking around. So the record is deliberately thin — an organisation,
 * what we get from them, and people you can actually call.
 *
 * Nothing here links to tenders, events or proposals yet. That was a
 * deliberate choice: a directory is useful on its own, and links can be added
 * once the roster exists and it is clear which ones are worth having.
 */

// A partner is an organisation, but you ring a person. Contacts are embedded
// because there are a handful per partner, not thousands — the same reasoning
// that keeps client contacts on the client.
const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: '' },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    // The one to try first. Exactly one per partner — see the pre-validate hook.
    isPrimary: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { _id: true }
);

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // The reason the directory exists. Required, because a partner nobody can
    // describe is not findable by the person who needs them.
    offering: { type: String, required: true, trim: true },

    website: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },

    // Who here knows them, so there is somebody to ask.
    relationshipOwner: { type: String, default: '' },

    // Shown as a fact in the directory. The anniversary itself belongs to a
    // Partner Milestone, which is what actually raises the reminder — this is
    // not a second source for that.
    partnerSince: { type: Date },

    contacts: [contactSchema],
    notes: { type: String, default: '' },

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// One primary, always. Marking a new one demotes the old, and if nobody has
// been marked the first contact stands in — otherwise the card has nobody to
// show and the directory fails at its one job.
partnerSchema.pre('validate', function settlePrimaryContact() {
  const contacts = this.contacts || [];
  if (contacts.length === 0) return;
  const primaries = contacts.filter((c) => c.isPrimary);
  if (primaries.length === 0) {
    contacts[0].isPrimary = true;
  } else if (primaries.length > 1) {
    // The most recently marked one wins.
    primaries.slice(0, -1).forEach((c) => { c.isPrimary = false; });
  }
});

partnerSchema.virtual('primaryContact').get(function primary() {
  return (this.contacts || []).find((c) => c.isPrimary) || (this.contacts || [])[0] || null;
});

// Whether anyone can actually act on this entry. A partner with no email and
// no phone is a name on a list, which is the state the directory exists to fix.
partnerSchema.virtual('isReachable').get(function reachable() {
  return (this.contacts || []).some((c) => c.email || c.phone);
});

partnerSchema.index({ archived: 1, name: 1 });
partnerSchema.index({ name: 'text', offering: 'text', notes: 'text' });

module.exports = mongoose.model('Partner', partnerSchema);
