const mongoose = require('mongoose');

const INDUSTRY_OPTIONS = [
  'Oil and Gas',
  'Manufacturing',
  'Mining',
  'Logistics',
  'Financial',
  'Others',
];

const CALL_OUTCOMES = [
  'Connected - Interested',
  'Connected - Not Interested',
  'Voicemail Left',
  'Gatekeeper / Decision Maker Unavailable',
  'Wrong Number / Invalid Contact',
];

const ColdCallSchema = new mongoose.Schema(
  {
    prospectName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    industry: { type: String, required: true, enum: INDUSTRY_OPTIONS },
    customIndustry: { type: String, trim: true, default: '' }, // Populated only if industry is "Others"
    callOutcome: { type: String, required: true, enum: CALL_OUTCOMES },
    notes: { type: String, default: '' }, // Key objection / notes
    followUpAt: { type: Date, default: null },
    assignedAgent: { type: String, trim: true, default: '' },
    convertedToProspectingLead: { type: mongoose.Schema.Types.ObjectId, ref: 'ProspectingLead', default: null },
  },
  { timestamps: true }
);

ColdCallSchema.statics.INDUSTRY_OPTIONS = INDUSTRY_OPTIONS;
ColdCallSchema.statics.CALL_OUTCOMES = CALL_OUTCOMES;

module.exports = mongoose.model('ColdCall', ColdCallSchema);
