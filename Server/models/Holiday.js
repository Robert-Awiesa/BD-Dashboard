const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g., "Independence Day", "Farmers' Day"
    englishName: { type: String, default: '' },
    date: { type: Date, required: true },
    notificationTriggerDate: { type: Date, required: true }, // Holiday Date minus 7 days
    countryCode: { type: String, default: 'GH' },

    // Reminder Lifecycle Tracking
    notificationTriggered: { type: Boolean, default: false },
    reminderActive: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Upcoming', 'Active Reminder', 'Passed'],
      default: 'Upcoming',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1 });
holidaySchema.index({ countryCode: 1, date: 1 });
holidaySchema.index({ status: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
