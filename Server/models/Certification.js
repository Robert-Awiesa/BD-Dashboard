const mongoose = require('mongoose');

const ECOSYSTEMS = ['SAP', 'AWS', 'Esri', 'OpenText', 'Other'];
const PROGRESS_STATUSES = ['Planned', 'In Progress', 'Completed'];

const certificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    ecosystem: { type: String, enum: ECOSYSTEMS, required: true },
    customEcosystem: { type: String, trim: true },
    candidate: { type: String, required: true, trim: true },
    progress: { type: String, enum: PROGRESS_STATUSES, default: 'Planned' },
    credentialIdUrl: { type: String, trim: true },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    tenderPartnerImpact: { type: Boolean, default: false },

    // Archive before delete, as everywhere else in the workspace: a record
    // removed by a misclick takes its history with it.
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

certificationSchema.virtual('isExpired').get(function () {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

certificationSchema.virtual('daysToExpiry').get(function () {
  if (!this.expiryDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(this.expiryDate);
  const expiryOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return Math.round((expiryOnly - today) / (24 * 60 * 60 * 1000));
});

certificationSchema.statics.ECOSYSTEMS = ECOSYSTEMS;
certificationSchema.statics.PROGRESS_STATUSES = PROGRESS_STATUSES;

module.exports = mongoose.model('Certification', certificationSchema);
