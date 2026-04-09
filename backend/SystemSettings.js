// models/SystemSettings.js
// One singleton document stores system-wide toggles.
// Access via SystemSettings.getSingleton() — always upserts the record.

const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    _id:          { type: String, default: "singleton" },
    voiceEnabled: { type: Boolean, default: false },  // ← OFF by default
  },
  { timestamps: true }
);

systemSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findById("singleton");
  if (!doc) {
    doc = await this.create({ _id: "singleton", voiceEnabled: false });
  }
  return doc;
};

module.exports =
  mongoose.models.SystemSettings ||
  mongoose.model("SystemSettings", systemSettingsSchema);