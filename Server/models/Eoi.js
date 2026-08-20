const mongoose = require('mongoose');

// Expression of Interest. Lighter than a tender: a notice we've spotted and want
// to act on. The attachment is deliberately flexible — EOIs arrive as newspaper
// clippings, WhatsApp screenshots, website links or meeting notes, so the record
// accepts either an uploaded image/file OR a pasted link (never both at once).
const eoiSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    reference: { type: String, default: '' },
    // Source mirrors the tender convention: `source` stays "Other" and
    // `sourceDetail` preserves the literal typed source for clean reporting.
    source: { type: String, default: '' },
    sourceDetail: { type: String, default: '' },
    issuingAuthority: { type: String, default: '' },
    deadline: { type: String, default: '' },
    status: { type: String, default: 'Open' },
    attachmentType: { type: String, default: '' }, // '' | 'link' | 'upload'
    attachmentUrl: { type: String, default: '' },
    attachmentFileName: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

eoiSchema.statics.EOI_STATUSES = ['Open', 'Submitted', 'Under Review', 'Closed'];
eoiSchema.statics.SOURCES = ['Newspaper', 'Website', 'WhatsApp', 'Meeting', 'Email', 'Other'];

module.exports = mongoose.model('Eoi', eoiSchema);
