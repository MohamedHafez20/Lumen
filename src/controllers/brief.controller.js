const Brief                                              = require('../models/Brief')
const { generateBrief, regenerateBrief, interpretImage } = require('../services/ai.service')
const { processAttachments }                             = require('../services/file.service')
const { notifyBriefConfirmed, notifyBriefRejected, notifyBriefResent } = require('../services/notify.service')

function shareUrl(token) {
  return `${process.env.FRONTEND_URL}/p/${token}`
}

function versionFromGenerated(generated, version_number) {
  return {
    version_number,
    summary:              generated.summary              || '',
    goals:                generated.goals                || [],
    ambiguities:          generated.ambiguities          || [],
    follow_up_questions:  generated.follow_up_questions  || [],
    project_title:        generated.project_title        || '',
    estimated_complexity: generated.estimated_complexity || 'medium',
    suggested_timeline:   generated.suggested_timeline   || null,
    // new v5 fields
    explicit_facts:       generated.explicit_facts       || [],
    inferred_needs:       generated.inferred_needs        || [],
    mvp_scope:            generated.mvp_scope            || [],
    future_scope:         generated.future_scope         || [],
    optional_ideas:       generated.optional_ideas       || [],
    technical_details:    generated.technical_details    || { integrations: [], payment_methods: [], platforms: [], constraints: [], admin_requirements: [] },
    business_details:     generated.business_details     || { budget: null, deadline: null, branches: null, user_roles: [] },
    design_content_notes: generated.design_content_notes || [],
    risks:                generated.risks                || [],
    recommendations:      generated.recommendations      || [],
  }
}

// ── Studio routes — all authenticated roles ───────────────────────────────────

async function create(req, res) {
  const { client_name, raw_text_input } = req.body
  if (!client_name) return res.status(400).json({ error: 'client_name is required' })

  const attachmentData  = await processAttachments(req.files || {}, interpretImage)
  const transcriptions  = attachmentData.filter(a => a.type === 'AUDIO' && a.transcription).map(a => a.transcription)
  const audioUploads    = attachmentData.filter(a => a.type === 'AUDIO')

  // If only audio was submitted and transcription failed — return useful error
  if (!raw_text_input?.trim() && audioUploads.length && transcriptions.length === 0) {
    return res.status(422).json({
      error: 'Audio transcription failed — no usable text could be extracted.',
      details: audioUploads.map(a => `${a.original_filename}: ${a.processing_error || 'No transcript returned'}`),
    })
  }

  // Separate document text from image descriptions
  const documentTexts   = attachmentData.filter(a => a.type === 'DOCUMENT' && a.ai_interpretation).map(a => a.ai_interpretation)
  const interpretations = attachmentData.filter(a => a.type === 'IMAGE'    && a.ai_interpretation).map(a => a.ai_interpretation)

  const generated = await generateBrief({ rawText: raw_text_input || '', transcriptions, interpretations, documentTexts })

  if (generated.input_failed) {
    return res.status(422).json({
      error:   generated.summary,
      details: generated.follow_up_questions?.[0] || 'Please provide readable input.',
    })
  }

  const brief = await Brief.create({
    user_id:        req.user.id,
    client_name,
    raw_text_input: raw_text_input || null,
    attachments:    attachmentData,
    versions:       [versionFromGenerated(generated, 1)],
  })

  res.status(201).json({
    ...brief.toObject(),
    share_url: shareUrl(brief.share_token),
  })
}

async function list(req, res) {
  const briefs = await Brief.find({ user_id: req.user.id }).sort({ createdAt: -1 })
  res.json(briefs.map(b => ({
    ...b.toObject(),
    share_url:      shareUrl(b.share_token),
    latest_version: b.versions[b.versions.length - 1] || null,
  })))
}

async function getOne(req, res) {
  const brief = await Brief.findOne({ _id: req.params.id, user_id: req.user.id })
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  res.json({ ...brief.toObject(), share_url: shareUrl(brief.share_token) })
}

async function remove(req, res) {
  const brief = await Brief.findOneAndDelete({ _id: req.params.id, user_id: req.user.id })
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  res.status(204).send()
}

async function regenerate(req, res) {
  const brief = await Brief.findOne({ _id: req.params.id, user_id: req.user.id })
  if (!brief)                            return res.status(404).json({ error: 'Brief not found' })
  if (brief.status !== 'NEEDS_REVISION') return res.status(400).json({ error: 'Brief is not in NEEDS_REVISION state' })

  const currentVersion = brief.versions[brief.versions.length - 1]
  const feedback       = currentVersion.client_feedback || req.body
  const generated      = await regenerateBrief(currentVersion, feedback)
  const nextN          = currentVersion.version_number + 1

  brief.versions.push(versionFromGenerated(generated, nextN))
  brief.current_version = nextN
  brief.status          = 'DRAFT'
  await brief.save()

  res.json(brief.versions[brief.versions.length - 1])
}

async function resend(req, res) {
  const brief = await Brief.findOne({ _id: req.params.id, user_id: req.user.id })
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  brief.status = 'SENT'
  await brief.save()
  await notifyBriefResent(req.user.id, brief._id, brief.client_name)
  res.json({ message: 'Brief resent', share_url: shareUrl(brief.share_token) })
}

async function versions(req, res) {
  const brief = await Brief.findOne({ _id: req.params.id, user_id: req.user.id }).select('versions')
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  res.json(brief.versions)
}

// ── Public routes ─────────────────────────────────────────────────────────────

async function publicView(req, res) {
  const brief = await Brief.findOne({ share_token: req.params.token })
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  const latest = brief.versions[brief.versions.length - 1]
  res.json({
    id:          brief._id,
    client_name: brief.client_name,
    status:      brief.status,
    version:     brief.current_version,
    created_at:  brief.createdAt,
    ...latest?.toObject(),
  })
}

async function publicConfirm(req, res) {
  const brief = await Brief.findOne({ share_token: req.params.token })
  if (!brief)                       return res.status(404).json({ error: 'Brief not found' })
  if (brief.status === 'CONFIRMED') return res.status(400).json({ error: 'Brief already confirmed' })
  brief.status       = 'CONFIRMED'
  brief.confirmed_at = new Date()
  await brief.save()
  await notifyBriefConfirmed(brief.user_id, brief._id, brief.client_name)
  res.json({ message: 'Brief confirmed. The studio has been notified.' })
}

async function publicReject(req, res) {
  const { summary, goals, missing, extra } = req.body
  const brief = await Brief.findOne({ share_token: req.params.token })
  if (!brief)                       return res.status(404).json({ error: 'Brief not found' })
  if (brief.status === 'CONFIRMED') return res.status(400).json({ error: 'Brief already confirmed' })
  const lastVersion           = brief.versions[brief.versions.length - 1]
  lastVersion.client_feedback = { summary, goals, missing, extra }
  brief.status                = 'NEEDS_REVISION'
  await brief.save()
  await notifyBriefRejected(brief.user_id, brief._id, brief.client_name)
  res.json({ message: 'Feedback submitted. The studio will review and update the brief.' })
}

module.exports = { create, list, getOne, remove, regenerate, resend, versions, publicView, publicConfirm, publicReject }
