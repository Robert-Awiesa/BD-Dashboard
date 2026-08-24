const mongoose = require('mongoose');

// Everyone who has ever been set as the person recording something.
//
// The roster used to be read only from Team Member milestones, so a name typed
// into the header picker lived in that one browser's localStorage and nobody
// else ever saw it. This makes the list shared: set a name once and it is on
// the roster for the whole team, on every device.
//
// Deliberately thin — it is a list of names, not a user account. Access in this
// workspace is open to the whole team by design; this only decides whose name
// gets stamped on what they file.
const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Lowercased name, so "Ada Boateng" and "ada boateng" cannot both exist.
    key: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

teamMemberSchema.pre('validate', function deriveKey() {
  if (this.name) this.key = this.name.trim().toLowerCase();
});

module.exports = mongoose.model('TeamMember', teamMemberSchema);
