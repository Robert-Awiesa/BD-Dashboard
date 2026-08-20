const mongoose = require('mongoose');

// The five phases are fixed structure, not free-form — the whole point of the
// flagship workspace is that every edition runs the same year-long journey.
const PHASES = [
  'Conceptualization & Budgeting',
  'Team Inputs & Departmental Assignment',
  'Stakeholder & Guest Outreach',
  'Execution & Live Coordination',
  'Post-Event Evaluation & Archival',
];

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

const phaseSchema = new mongoose.Schema(
  {
    name: { type: String, enum: PHASES, required: true },
    order: { type: Number, required: true },
    summary: { type: String, default: '' },
    startDate: { type: Date },
    targetDate: { type: Date },
    tasks: [phaseTaskSchema],
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
    budgetSpent: { type: Number, default: 0 },
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

// Seed the five phases on creation so a new edition is immediately trackable.
dgEventSchema.pre('save', function seedPhases() {
  if (this.isNew && (!this.phases || this.phases.length === 0)) {
    this.phases = PHASES.map((name, idx) => ({ name, order: idx + 1, tasks: [] }));
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

dgEventSchema.virtual('budgetRemaining').get(function computeBudget() {
  return (this.totalBudgetAllocated || 0) - (this.budgetSpent || 0);
});

dgEventSchema.statics.PHASES = PHASES;
dgEventSchema.statics.DEPARTMENTS = DEPARTMENTS;
dgEventSchema.statics.PROPOSAL_TYPES = PROPOSAL_TYPES;
dgEventSchema.statics.PROPOSAL_STATUSES = PROPOSAL_STATUSES;

module.exports = mongoose.model('DgEvent', dgEventSchema);
