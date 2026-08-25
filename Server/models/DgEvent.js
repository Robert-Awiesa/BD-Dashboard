const mongoose = require('mongoose');

// The five phases are fixed structure, not free-form — the whole point of the
// flagship workspace is that every edition runs the same year-long journey.
// The seven stages a DG edition actually runs through. Each is independent:
// design, distribution and the awareness campaigns overlap in practice, so a
// stage is never waiting on the one before it to reach 100%.
const PHASES = [
  'Strategic Planning',
  'Target Audience & Venue',
  'Invitation Design & Production',
  'Invitation Distribution',
  'Marketing & Awareness Campaigns',
  'Attendance Confirmation',
  'Final Event Setup',
];

/**
 * What each stage is made of.
 *
 * `activities` are seeded as tasks when an edition is created — they are the
 * same every year, and nobody should retype "Theme selection" annually.
 *
 * `fields` are the stage's own attributes. They live in a Map rather than as
 * declared paths so that adding one is a single line here instead of a schema
 * change and a migration. `type` tells the form how to render and the API how
 * to read it back.
 *
 * Planning and execution are separate activities wherever both exist: they
 * finish at different times, and one line hides that.
 */
const STAGE_SPEC = {
  'Strategic Planning': {
    activities: [
      'Theme selection',
      'Keynote and subject-matter speaker selection',
      'Programme agenda creation',
    ],
    fields: [
      { key: 'theme', label: 'Theme', type: 'text' },
      { key: 'keynoteSpeaker', label: 'Keynote speaker', type: 'text' },
      { key: 'agendaLink', label: 'Programme agenda (link)', type: 'link' },
    ],
  },
  'Target Audience & Venue': {
    activities: [
      'Industry and company research (profiling / database)',
      'Venue selection',
      'Venue booking',
      'Venue payment',
    ],
    fields: [
      { key: 'targetIndustries', label: 'Target industries', type: 'text' },
      { key: 'companiesProfiled', label: 'Companies profiled', type: 'number' },
      { key: 'venueName', label: 'Venue', type: 'text' },
      {
        key: 'venuePayment',
        label: 'Venue payment',
        type: 'choice',
        options: ['Not paid', 'Deposit paid', 'Paid in full'],
      },
    ],
  },
  'Invitation Design & Production': {
    activities: [
      'Invite letter draft',
      'Marketing collateral design (flyers, video)',
      'Envelope procurement and design',
    ],
    fields: [
      {
        key: 'letterStatus',
        label: 'Invite letter',
        type: 'choice',
        options: ['Not started', 'Drafted', 'Approved', 'Printed'],
      },
      { key: 'collateral', label: 'Collateral ready', type: 'text' },
      { key: 'envelopesOrdered', label: 'Envelopes ordered', type: 'number' },
    ],
  },
  'Invitation Distribution': {
    activities: ['E-mail invite letters', 'Physical invite letter delivery'],
    fields: [
      { key: 'emailsSent', label: 'E-mails sent', type: 'number' },
      { key: 'lettersDelivered', label: 'Letters delivered', type: 'number' },
      { key: 'distributionNotes', label: 'Delivery notes', type: 'text' },
    ],
  },
  'Marketing & Awareness Campaigns': {
    activities: [
      'Newspaper campaign planning',
      'Newspaper campaign execution',
      'LinkedIn ad campaign planning',
      'LinkedIn ad campaign execution',
    ],
    fields: [
      { key: 'newspaperTitle', label: 'Newspaper', type: 'text' },
      { key: 'newspaperRunDate', label: 'Run date', type: 'date' },
      { key: 'linkedInReach', label: 'LinkedIn reach', type: 'number' },
    ],
  },
  'Attendance Confirmation': {
    activities: [
      'Multi-touch follow-up — calls',
      'Multi-touch follow-up — SMS',
      'Multi-touch follow-up — LinkedIn',
      'Compile confirmed attendees',
    ],
    fields: [
      { key: 'invited', label: 'Invited', type: 'number' },
      { key: 'confirmed', label: 'Confirmed', type: 'number' },
      { key: 'followUpRounds', label: 'Follow-up rounds', type: 'number' },
    ],
  },
  'Final Event Setup': {
    activities: ['Event setup the day before'],
    fields: [
      { key: 'setupDate', label: 'Setup date', type: 'date' },
      { key: 'setupLead', label: 'Setup lead', type: 'text' },
      { key: 'setupNotes', label: 'Setup notes', type: 'text' },
    ],
  },
};

const DEPARTMENTS = ['Operations', 'Marketing', 'Tech', 'Logistics', 'Finance', 'Executive'];
const PROPOSAL_TYPES = ['Session Proposal', 'Budget Request', 'Resource Requirement', 'General Idea'];
const PROPOSAL_STATUSES = ['Submitted', 'Under Review', 'Approved', 'Declined'];

const phaseTaskSchema = new mongoose.Schema(
  {
    taskName: { type: String, required: true },
    department: { type: String, enum: DEPARTMENTS },
    teamLead: { type: String, default: '' },
    dueDate: { type: Date },
    completed: { type: Boolean, default: false },
  },
  { _id: true }
);

// Money is spent stage by stage — the venue in stage 2, printing in stage 3,
// the ad spend in stage 5 — so it is recorded where it happens and totalled up.
const expenseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    incurredAt: { type: Date, default: Date.now },
    paidBy: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

const phaseSchema = new mongoose.Schema(
  {
    name: { type: String, enum: PHASES, required: true },
    order: { type: Number, required: true },
    summary: { type: String, default: '' },
    owner: { type: String, default: '' },
    startDate: { type: Date },
    targetDate: { type: Date },

    // Progress is derived from the activities. Being blocked is not — it is a
    // judgement somebody makes, and it needs a reason attached or the next
    // person cannot act on it.
    blocked: { type: Boolean, default: false },
    blockedReason: { type: String, default: '' },

    // The stage's own attributes. A Map rather than declared paths so a new
    // field is one line in STAGE_SPEC instead of a schema change; the spec
    // says how each is rendered and read back.
    attributes: { type: Map, of: String, default: () => ({}) },

    tasks: [phaseTaskSchema],
    expenses: [expenseSchema],
  },
  { _id: true }
);

const proposalSchema = new mongoose.Schema(
  {
    submittedBy: { type: String, required: true },
    department: { type: String, enum: DEPARTMENTS },
    proposalType: { type: String, enum: PROPOSAL_TYPES, default: 'General Idea' },
    title: { type: String, required: true },
    details: { type: String, default: '' },
    requestedAmount: { type: Number },
    status: { type: String, enum: PROPOSAL_STATUSES, default: 'Submitted' },
    reviewNote: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

const dgEventSchema = new mongoose.Schema(
  {
    dgEventTitle: { type: String, required: true },
    fiscalYear: { type: Number, required: true },
    overallTheme: { type: String, default: '' },
    totalBudgetAllocated: { type: Number, default: 0 },
    // budgetSpent is no longer stored: it is the sum of every stage expense,
    // so the headline figure cannot drift from the expenses behind it.
    eventDate: { type: Date },
    venue: { type: String, default: '' },
    executiveSponsor: { type: String, default: '' },

    phases: [phaseSchema],
    proposals: [proposalSchema],

    archived: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Seed the seven stages, each already carrying its activities, so a new
// edition is trackable the moment it is created.
dgEventSchema.pre('save', function seedPhases() {
  if (this.isNew && (!this.phases || this.phases.length === 0)) {
    this.phases = PHASES.map((name, idx) => ({
      name,
      order: idx + 1,
      tasks: (STAGE_SPEC[name]?.activities || []).map((taskName) => ({ taskName })),
      expenses: [],
      attributes: {},
    }));
  }
});

const phaseProgress = (phase) => {
  const total = phase.tasks?.length || 0;
  if (!total) return 0;
  return Math.round((phase.tasks.filter((t) => t.completed).length / total) * 100);
};

dgEventSchema.virtual('phaseProgress').get(function computePhaseProgress() {
  return (this.phases || []).map((p) => ({
    name: p.name,
    order: p.order,
    progress: phaseProgress(p),
    taskCount: p.tasks?.length || 0,
  }));
});

// Overall progress counts tasks, not phases, so a phase with 20 tasks weighs
// more than one with 2 — closer to real effort than averaging percentages.
dgEventSchema.virtual('overallProgress').get(function computeOverall() {
  const all = (this.phases || []).flatMap((p) => p.tasks || []);
  if (!all.length) return 0;
  return Math.round((all.filter((t) => t.completed).length / all.length) * 100);
});

dgEventSchema.virtual('currentPhase').get(function computeCurrentPhase() {
  const ordered = [...(this.phases || [])].sort((a, b) => a.order - b.order);
  const active = ordered.find((p) => phaseProgress(p) < 100);
  return active ? active.name : ordered[ordered.length - 1]?.name || null;
});

// Every expense recorded against any stage, totalled.
dgEventSchema.virtual('budgetSpent').get(function computeSpent() {
  return (this.phases || [])
    .flatMap((p) => p.expenses || [])
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
});

dgEventSchema.virtual('budgetRemaining').get(function computeBudget() {
  return (this.totalBudgetAllocated || 0) - this.budgetSpent;
});

// What each stage has cost, so the overspend is attributable rather than just
// visible at the top.
dgEventSchema.virtual('phaseSpend').get(function computePhaseSpend() {
  return (this.phases || []).map((p) => ({
    name: p.name,
    order: p.order,
    spent: (p.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    count: (p.expenses || []).length,
  }));
});

dgEventSchema.statics.PHASES = PHASES;
dgEventSchema.statics.STAGE_SPEC = STAGE_SPEC;
dgEventSchema.statics.DEPARTMENTS = DEPARTMENTS;
dgEventSchema.statics.PROPOSAL_TYPES = PROPOSAL_TYPES;
dgEventSchema.statics.PROPOSAL_STATUSES = PROPOSAL_STATUSES;

module.exports = mongoose.model('DgEvent', dgEventSchema);
