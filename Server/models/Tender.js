const mongoose = require('mongoose');

// A person accountable for part of the bid — technical write-up, pricing,
// documents, submission, printing/binding, approvals, and so on. Stored as
// structured rows (name / responsibility / notes) rather than a free-text blob
// so a tender's division of labour reads clearly at a glance.
const individualSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    responsibility: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    date: { type: String, default: '' },
    done: { type: Boolean, default: false },
  },
  { _id: true }
);

// PDP — Proposal Development Plan: how the tender is being progressed and planned.
const pdpSchema = new mongoose.Schema(
  {
    objectives: { type: String, default: '' },
    milestones: [milestoneSchema],
    individuals: [individualSchema],
    progress: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

// FDP — Financial Development Plan: costing, pricing and the model behind it.
// Deliberately held apart from the headline tender so the numbers aren't shown
// until someone consciously opens them.
const fdpSchema = new mongoose.Schema(
  {
    currency: { type: String, default: '' },
    estimatedCost: { type: Number, default: 0 },
    proposedPrice: { type: Number, default: 0 },
    marginPct: { type: Number, default: 0 },
    pricingModel: { type: String, default: '' },
    assumptions: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const tenderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    reference: { type: String, default: '' },
    // Where the notice came from. `source` stays "Other" while `sourceDetail`
    // keeps the literal typed source, so reporting can still group all custom
    // sources under "Other" without losing the exact name.
    source: { type: String, default: '' },
    sourceDetail: { type: String, default: '' },
    issuingAuthority: { type: String, default: '' },
    tenderType: { type: String, default: 'Stage One' },
    deadline: { type: String, default: '' },
    status: { type: String, default: 'Open' },
    estimatedValue: { type: Number, default: 0 },
    pdp: { type: pdpSchema, default: () => ({ milestones: [], individuals: [], progress: 0 }) },
    fdp: { type: fdpSchema, default: () => ({}) },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Enums used by the form validation and the badge styling.
tenderSchema.statics.TENDER_TYPES = ['Stage One', 'Stage Two', 'Single Stage'];
tenderSchema.statics.TENDER_STATUSES = ['Open', 'In Progress', 'Submitted', 'Won', 'Lost'];
tenderSchema.statics.SOURCES = ['Newspaper', 'Website', 'WhatsApp', 'Meeting', 'Email', 'Other'];

module.exports = mongoose.model('Tender', tenderSchema);
