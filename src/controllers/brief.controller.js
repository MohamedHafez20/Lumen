const Brief                                              = require('../models/Brief')
const { generateBrief, regenerateBrief, interpretImage } = require('../services/ai.service')
const { processAttachments }                             = require('../services/file.service')
const { notifyBriefConfirmed, notifyBriefRejected, notifyBriefResent } = require('../services/notify.service')

// ── Studio routes — all authenticated roles ───────────────────────────────────

async function create(req, res) {
  const { client_name, raw_text_input } = req.body
  if (!client_name) return res.status(400).json({ error: 'client_name is required' })

  const attachmentData  = await processAttachments(req.files || {}, interpretImage)
  const transcriptions  = attachmentData.filter(a => a.type === 'AUDIO' && a.transcription).map(a => a.transcription)
  const interpretations = attachmentData.filter(a => a.type === 'IMAGE' && a.ai_interpretation).map(a => a.ai_interpretation)

  const generated = await generateBrief({ rawText: raw_text_input || '', transcriptions, interpretations })

  const brief = await Brief.create({
    user_id:        req.user.id,  // works for any role — id is always in the JWT
    client_name,
    raw_text_input: raw_text_input || null,
    attachments:    attachmentData,
    versions: [{
      version_number:       1,
      summary:              generated.summary,
      goals:                generated.goals,
      ambiguities:          generated.ambiguities,
      follow_up_questions:  generated.follow_up_questions,
      project_title:        generated.project_title        || '',
      estimated_complexity: generated.estimated_complexity || 'medium',
      suggested_timeline:   generated.suggested_timeline   || 'TBD',
    }],
  })

  res.status(201).json({
    ...brief.toObject(),
    share_url: `${process.env.FRONTEND_URL}/p/${brief.share_token}`,
  })
}

async function list(req, res) {
  // Returns briefs owned by the current account — works for any role
  const briefs = await Brief.find({ user_id: req.user.id }).sort({ createdAt: -1 })
  res.json(briefs.map(b => ({
    ...b.toObject(),
    share_url:      `${process.env.FRONTEND_URL}/p/${b.share_token}`,
    latest_version: b.versions[b.versions.length - 1] || null,
  })))
}

async function getOne(req, res) {
  const brief = await Brief.findOne({ _id: req.params.id, user_id: req.user.id })
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  res.json({ ...brief.toObject(), share_url: `${process.env.FRONTEND_URL}/p/${brief.share_token}` })
}

async function remove(req, res) {
  const brief = await Brief.findOneAndDelete({ _id: req.params.id, user_id: req.user.id })
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  res.status(204).send()
}

async function regenerate(req, res) {
  const brief = await Brief.findOne({ _id: req.params.id, user_id: req.user.id })
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  if (brief.status !== 'NEEDS_REVISION') return res.status(400).json({ error: 'Brief is not in NEEDS_REVISION state' })

  const currentVersion = brief.versions[brief.versions.length - 1]
  const feedback       = currentVersion.client_feedback || req.body
  const generated      = await regenerateBrief(currentVersion, feedback)
  const nextVersionN   = currentVersion.version_number + 1

  brief.versions.push({
    version_number:       nextVersionN,
    summary:              generated.summary,
    goals:                generated.goals,
    ambiguities:          generated.ambiguities,
    follow_up_questions:  generated.follow_up_questions,
    project_title:        generated.project_title        || currentVersion.project_title || '',
    estimated_complexity: generated.estimated_complexity || currentVersion.estimated_complexity || 'medium',
    suggested_timeline:   generated.suggested_timeline   || currentVersion.suggested_timeline   || 'TBD',
  })
  brief.current_version = nextVersionN
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
  res.json({ message: 'Brief resent', share_url: `${process.env.FRONTEND_URL}/p/${brief.share_token}` })
}

async function versions(req, res) {
  const brief = await Brief.findOne({ _id: req.params.id, user_id: req.user.id }).select('versions')
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  res.json(brief.versions)
}

// ── Public routes (no auth) ───────────────────────────────────────────────────

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
