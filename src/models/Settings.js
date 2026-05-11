const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true }, // e.g. 'groq', 'gemini'
  value: { type: String, required: true },               // the actual API key
  label: { type: String },                               // display name
  model: { type: String },                               // model string
  expiry:{ type: Date, default: null },
  isPaid:{ type: Boolean, default: false },
  updated_by: { type: String },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: true })

module.exports = mongoose.model('Settings', settingsSchema)
