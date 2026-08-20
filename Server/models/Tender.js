const mongoose = require('mongoose');

const tenderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    deadline: { type: String, default: '' },
    status: { type: String, default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tender', tenderSchema);
