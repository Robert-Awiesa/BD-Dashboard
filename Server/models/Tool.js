const mongoose = require('mongoose');

/**
 * The working-tools launcher.
 *
 * This used to live in each person's localStorage, which meant a shortcut
 * somebody added was invisible to everybody else — the one module in the
 * workspace that was not actually shared. It is a directory of links the team
 * uses, so it belongs on the server for the same reason the partner directory
 * does: anyone should be able to find it without asking around.
 */

// Seeded when the collection holds nothing at all, so a fresh workspace opens
// on something useful rather than an empty grid. Archived rows still count, so
// a team that archived every default does not get them back on the next read.
// They are ordinary rows once seeded — editable and archivable like any other.
const DEFAULT_TOOLS = [
  {
    name: 'Apollo.io',
    desc: 'B2B lead enrichment, contact database, and sales engagement platform.',
    url: 'https://apollo.io',
    category: 'Lead Generation',
    icon: '🎯',
  },
  {
    name: 'Claude AI',
    desc: 'AI assistant for drafting proposals, copy, technical specs, and strategy.',
    url: 'https://claude.ai',
    category: 'AI & Strategy',
    icon: '🧠',
  },
  {
    name: 'Perplexity AI',
    desc: 'Real-time market research, web intelligence, and competitor analysis.',
    url: 'https://www.perplexity.ai',
    category: 'Market Intelligence',
    icon: '🔍',
  },
  {
    name: 'Dripify',
    desc: 'LinkedIn automation tool for prospecting and sequence campaigns.',
    url: 'https://dripify.io',
    category: 'Automation',
    icon: '⚡',
  },
  {
    name: 'ChatGPT',
    desc: 'Advanced language model for brainstorming, content generation, and code.',
    url: 'https://chatgpt.com',
    category: 'AI & Strategy',
    icon: '🤖',
  },
  {
    name: 'Mailchimp',
    desc: 'Email marketing platform for outreach campaigns and broadcast tracking.',
    url: 'https://mailchimp.com',
    category: 'Campaigns',
    icon: '✉️',
  },
];

const CATEGORIES = [
  'Lead Generation', 'AI & Strategy', 'Market Intelligence',
  'Automation', 'Campaigns', 'CRM & Workspace', 'Custom',
];

const toolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    desc: { type: String, default: '', trim: true },
    category: { type: String, default: 'Custom', trim: true },
    icon: { type: String, default: '🌐', trim: true },

    // Who put it on the list, so there is somebody to ask what it is for.
    addedBy: { type: String, default: '' },

    // Seeded rather than added by a person. Only used to explain the row in the
    // UI — it grants no protection, since a default nobody uses should be as
    // removable as any other.
    isDefault: { type: Boolean, default: false },

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// A link typed as "apollo.io" is what people actually paste. Normalising here
// rather than in the form means the API and the UI cannot disagree about it.
toolSchema.pre('validate', function addProtocol() {
  if (!this.url) return;
  const trimmed = this.url.trim();
  this.url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
});

toolSchema.virtual('host').get(function host() {
  try {
    return new URL(this.url).hostname.replace(/^www\./, '');
  } catch {
    return this.url;
  }
});

toolSchema.index({ archived: 1, category: 1, name: 1 });

// Two rows pointing at the same place is clutter, and checking for one before
// inserting loses the race when two requests arrive together — which is exactly
// what a double-invoked effect does on first load. The database settles it.
// Archived rows are excluded, so retiring a shortcut frees its link for re-use.
toolSchema.index(
  { url: 1 },
  { unique: true, partialFilterExpression: { archived: false } }
);

toolSchema.statics.DEFAULT_TOOLS = DEFAULT_TOOLS;
toolSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Tool', toolSchema);
