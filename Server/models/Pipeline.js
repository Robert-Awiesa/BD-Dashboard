const mongoose = require('mongoose');

const pipelineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, default: 'active' },
    contact: { type: String, default: '' },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    value: { type: Number, default: 0 },
    nextFollowUp: { type: String, default: '' },
    source: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pipeline', pipelineSchema);
