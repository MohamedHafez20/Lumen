const mongoose = require('mongoose')

const attachmentSchema = new mongoose.Schema({
  type:              { type: String, enum: ['AUDIO', 'IMAGE', 'DOCUMENT'], required: true },
  original_filename: { type: String, required: true },
  file_url:          { type: String, default: null },
  transcription:     { type: String, default: null },
  ai_interpretation: { type: String, default: null },
  processing_error:  { type: String, default: null },
}, { timestamps: true })

const versionSchema = new mongoose.Schema({
  version_number:      { type: Number, required: true },
  // core
  summary:             { type: String, required: true },
  goals:               { type: [String], default: [] },
  ambiguities:         { type: [String], default: [] },
  follow_up_questions: { type: [String], default: [] },
  project_title:       { type: String, default: '' },
  estimated_complexity:{ type: String, default: 'medium' },
  suggested_timeline:  { type: String, default: null },
  // v5 new fields
  explicit_facts:      { type: [String], default: [] },
  inferred_needs:      { type: [String], default: [] },
  mvp_scope:           { type: [String], default: [] },
  future_scope:        { type: [String], default: [] },
  optional_ideas:      { type: [String], default: [] },
  technical_details: {
    integrations:       { type: [String], default: [] },
    payment_methods:    { type: [String], default: [] },
    platforms:          { type: [String], default: [] },
    constraints:        { type: [String], default: [] },
    admin_requirements: { type: [String], default: [] },
  },
  business_details: {
    budget:     { type: String, default: null },
    deadline:   { type: String, default: null },
    branches:   { type: String, default: null },
    user_roles: { type: [String], default: [] },
  },
  design_content_notes: { type: [String], default: [] },
  risks:                { type: [String], default: [] },
  recommendations:      { type: [String], default: [] },
  // client feedback on rejection
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
