/**
 * AI Service — Lumen
 * Keys are read from MongoDB Settings collection first.
 * Falls back to .env if no DB key found.
 * This means super admin can change keys live from the website.
 */

const Groq = require('groq-sdk')
const { GoogleGenerativeAI } = require('@google/generative-ai')

// Cache clients so we don't recreate on every call
let _groq   = null
let _genAI  = null
let _lastGroqKey   = null
let _lastGeminiKey = null

async function getKey(name) {
  try {
    const Settings = require('../models/Settings')
    const s = await Settings.findOne({ key: name })
    if (s?.value) return s.value
  } catch {}
  // fallback to .env
  if (name === 'groq')   return process.env.GROQ_API_KEY
  if (name === 'gemini') return process.env.GEMINI_API_KEY
  return null
}

async function getGroq() {
  const key = await getKey('groq')
  if (!key) throw new Error('Groq API key not configured')
  if (key !== _lastGroqKey) { _groq = new Groq({ apiKey: key }); _lastGroqKey = key }
  return _groq
}

async function getGenAI() {
  const key = await getKey('gemini')
  if (!key) throw new Error('Gemini API key not configured')
  if (key !== _lastGeminiKey) { _genAI = new GoogleGenerativeAI(key); _lastGeminiKey = key }
  return _genAI
}

async function getGeminiModel() {
  try {
    const Settings = require('../models/Settings')
    const s = await Settings.findOne({ key: 'gemini' })
    if (s?.model) return s.model
  } catch {}
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash'
}

const BRIEF_SYSTEM = `You are a senior project manager at a software studio.
Extract a structured project brief from messy client input.
Return ONLY valid JSON — no markdown, no backticks, no explanation.

Return exactly this shape:
{
  "project_title": "short descriptive title",
  "summary": "2-3 sentences describing what the client actually wants",
  "goals": ["specific goal 1", "specific goal 2"],
  "ambiguities": ["missing or unclear item 1"],
  "follow_up_questions": ["Question to clarify ambiguity 1?"],
  "estimated_complexity": "medium",
  "suggested_timeline": "2-3 weeks"
}

Rules:
- estimated_complexity must be exactly: low, medium, or high
- summary: plain language, no jargon
- goals: specific and measurable where possible
- ambiguities: only flag genuinely missing info
- follow_up_questions: one per ambiguity
- Return ONLY the JSON object`

const REGEN_SYSTEM = `You are a senior project manager refining a project brief based on client feedback.
Return ONLY valid JSON with the exact same shape — no markdown, no backticks.
Incorporate ALL client corrections. Remove ambiguities the client has answered.`

function cleanJson(raw) {
  return raw.trim()
    .replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    .replace(/[\x00-\x1F\x7F]/g, '').trim()
}

function parseResult(raw, fallbackTitle = '') {
  try {
    const p = JSON.parse(cleanJson(raw))
    return {
      project_title:        p.project_title        || fallbackTitle,
      summary:              p.summary              || '',
      goals:                Array.isArray(p.goals)               ? p.goals               : [],
      ambiguities:          Array.isArray(p.ambiguities)         ? p.ambiguities         : [],
      follow_up_questions:  Array.isArray(p.follow_up_questions) ? p.follow_up_questions : [],
      estimated_complexity: ['low','medium','high'].includes(p.estimated_complexity) ? p.estimated_complexity : 'medium',
      suggested_timeline:   p.suggested_timeline   || 'TBD',
    }
  } catch (e) {
    console.error('AI JSON parse error:', e.message)
    return {
      project_title: fallbackTitle, summary: 'AI could not parse the input. Please try again.',
      goals: [], ambiguities: ['Input was too vague'],
      follow_up_questions: ['Could you provide more detail?'],
      estimated_complexity: 'medium', suggested_timeline: 'TBD',
    }
  }
}

async function generateBrief({ rawText = '', transcriptions = [], interpretations = [] }) {
  const parts = []
  if (rawText)                parts.push(`CLIENT TEXT:\n${rawText}`)
  if (transcriptions.length)  parts.push(`VOICE NOTE TRANSCRIPTIONS:\n${transcriptions.join('\n---\n')}`)
  if (interpretations.length) parts.push(`IMAGE/DOCUMENT CONTENT:\n${interpretations.join('\n---\n')}`)
  const userMsg = parts.join('\n\n===\n\n') || 'No input provided.'

  const groq = await getGroq()
  const res  = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant', temperature: 0.2, max_tokens: 2000,
    messages: [
      { role: 'system', content: BRIEF_SYSTEM },
      { role: 'user',   content: `Analyze this client input and generate a structured project brief.\n\n${userMsg}` },
    ],
  })
  return parseResult(res.choices[0].message.content)
}

async function regenerateBrief(currentVersion, feedback) {
  const original = JSON.stringify({
    summary: currentVersion.summary, goals: currentVersion.goals,
    ambiguities: currentVersion.ambiguities, follow_up_questions: currentVersion.follow_up_questions,
  }, null, 2)

  const feedbackText = [
    feedback.summary && `On the summary: ${feedback.summary}`,
    feedback.goals   && `On the goals: ${feedback.goals}`,
    feedback.missing && `Answers to open questions: ${feedback.missing}`,
    feedback.extra   && `Additional context: ${feedback.extra}`,
  ].filter(Boolean).join('\n\n')

  const groq = await getGroq()
  const res  = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile', temperature: 0.2, max_tokens: 2000,
    messages: [
      { role: 'system', content: REGEN_SYSTEM },
      { role: 'user',   content: `ORIGINAL BRIEF:\n${original}\n\nCLIENT FEEDBACK:\n${feedbackText}\n\nGenerate an improved brief addressing all feedback.` },
    ],
  })
  const parsed = parseResult(res.choices[0].message.content, currentVersion.project_title)
  if (!parsed.project_title) parsed.project_title = currentVersion.project_title || ''
  return parsed
}

async function interpretImage(imageBuffer, mimeType) {
  const ai    = await getGenAI()
  const model = await getGeminiModel()
  const m     = ai.getGenerativeModel({ model })
  const result = await m.generateContent([
    `You are a design analyst. A client uploaded this image as part of their project brief.
Describe everything useful: text, UI layout, annotations, arrows, highlighted areas, and what the client likely wants.
Be specific and actionable. Plain paragraphs only, no JSON.`,
    { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
  ])
  return result.response.text()
}

module.exports = { generateBrief, regenerateBrief, interpretImage }
