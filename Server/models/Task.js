const mongoose = require('mongoose');

// Standalone work — and ONLY standalone work.
//
// Event prep checklists, DG phase tasks and client commitments already live on
// the records that give them meaning, and they stay there. This collection
// exists for the work that has no other home: "redesign the pitch deck",
// "onboard the new analyst". The Tasks module surfaces the others alongside
// these by reading through to their owning module, never by copying them here —
// two records for one obligation is how a task list starts lying to people.
const TASK_STATUSES = ['To Do', 'In Progress', 'Blocked', 'Done'];

const PRIORITIES = ['High', 'Medium', 'Low'];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    owner: { type: String, default: '' },
    createdBy: { type: String, default: '' },

    dueDate: { type: Date },
    status: { type: String, enum: TASK_STATUSES, default: 'To Do' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },

    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    blockedReason: { type: String, default: '' },

    completedAt: { type: Date },
    archived: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

taskSchema.virtual('done').get(function () {
  return this.status === 'Done';
});

taskSchema.virtual('daysToDue').get(function () {
  if (!this.dueDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(this.dueDate);
  const dueOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueOnly - today) / (24 * 60 * 60 * 1000));
});

taskSchema.virtual('overdue').get(function () {
  const days = this.daysToDue;
  return days !== null && days < 0 && this.status !== 'Done';
});

// Keep completedAt honest without callers having to remember it.
taskSchema.pre('save', function stampCompletion() {
  if (this.isModified('status')) {
    this.completedAt = this.status === 'Done' ? new Date() : null;
  }
});

taskSchema.index({ owner: 1, status: 1, dueDate: 1 });
taskSchema.index({ project: 1 });

taskSchema.statics.TASK_STATUSES = TASK_STATUSES;
taskSchema.statics.PRIORITIES = PRIORITIES;

module.exports = mongoose.model('Task', taskSchema);
