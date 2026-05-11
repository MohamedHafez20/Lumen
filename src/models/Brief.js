const mongoose = require('mongoose')

const attachmentSchema = new mongoose.Schema({
  type:              { type: String, enum: ['AUDIO', 'IMAGE', 'DOCUMENT'], required: true },
  original_filename: { type: String, required: true },
  file_url:          { type: String, required: true },
  transcription:     { type: String, default: null },
  ai_interpretation: { type: String, default: null },
}, { timestamps: true })

const versionSchema = new mongoose.Schema({
  version_number:       { type: Number, required: true },
  // core AI output
  summary:              { type: String, required: true },
  goals:                { type: [String], required: true },
  ambiguities:          { type: [String], required: true },
  follow_up_questions:  { type: [String], required: true },
  // extra fields from Groq/Gemini
  project_title:        { type: String, default: '' },
  estimated_complexity: { type: String, default: 'medium' },
  suggested_timeline:   { type: String, default: 'TBD' },
  // client feedback on reject
  client_feedback: {
    summary: String,
    goals:   String,
    missing: String,
    extra:   String,
  },
}, { timestamps: true })

const briefSchema = new mongoose.Schema({
  user_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client_name:     { type: String, required: true },
  raw_text_input:  { type: String, default: null },
  share_token:     { type: String, unique: true },
  status:          { type: String, enum: ['DRAFT', 'SENT', 'NEEDS_REVISION', 'CONFIRMED'], default: 'DRAFT' },
  current_version: { type: Number, default: 1 },
  confirmed_at:    { type: Date, default: null },
  versions:        [versionSchema],
  attachments:     [attachmentSchema],
}, { timestamps: true })

briefSchema.pre('save', function (next) {
  if (!this.share_token) {
    const { v4: uuidv4 } = require('uuid')
    this.share_token = uuidv4()
  }
  next()
})

module.exports = mongoose.model('Brief', briefSchema)
