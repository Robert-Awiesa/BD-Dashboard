const mongoose = require('mongoose');

const INDUSTRY_OPTIONS = [
  'Oil and Gas',
  'Manufacturing',
  'Mining',
  'Logistics',
  'Financial',
  'Others',
];

const OPPORTUNITY_STAGES = [
  'Unqualified',
  'Qualified',
  'Follow-Up',
  'Demo',
  'Cold',
  'Negotiation',
  'Won',
  'Lost',
];

const ProspectingLeadSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true },
    industry: { type: String, required: true, enum: INDUSTRY_OPTIONS },
    customIndustry: { type: String, trim: true, default: '' }, // Populated only if industry is "Others"
    contactPerson: { type: String, required: true, trim: true },
    position: { type: String, trim: true, default: '' },
    companyChallenge: { type: String, default: '' },
    proposedSolution: { type: String, default: '' },
    strategicAngle: { type: String, default: '' },
    opportunityStage: {
      type: String,
      required: true,
      enum: OPPORTUNITY_STAGES,
      default: 'Unqualified',
    },
    primaryEmail: { type: String, required: true, trim: true },
    otherEmail: { type: String, trim: true, default: '' },
    primaryContact: { type: String, required: true, trim: true },
    otherContact: { type: String, trim: true, default: '' },
    linkedin: { type: String, trim: true, default: '' },
    companyWebsite: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    discoveryQuestions: { type: String, default: '' }, // Can store text or array of questions
  },
  { timestamps: true }
);

ProspectingLeadSchema.statics.INDUSTRY_OPTIONS = INDUSTRY_OPTIONS;
ProspectingLeadSchema.statics.OPPORTUNITY_STAGES = OPPORTUNITY_STAGES;

module.exports = mongoose.model('ProspectingLead', ProspectingLeadSchema);
