const Settings = require('../models/Settings')

async function getSettings(req, res) {
  const settings = await Settings.find().select('-value') // never send actual key to frontend
  res.json(settings)
}

async function upsertKey(req, res) {
  const { key, value, label, model, expiry, isPaid } = req.body
  if (!key)   return res.status(400).json({ error: 'key is required' })
  if (!value) return res.status(400).json({ error: 'value (API key) is required' })

  const updated = await Settings.findOneAndUpdate(
    { key },
    { value, label, model, expiry: expiry || null, isPaid: !!isPaid, updated_by: req.user.email, updated_at: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  // Return without the actual key value
  const { value: _v, ...safe } = updated.toObject()
  res.json({ ...safe, has_key: true })
}

async function testKey(req, res) {
  const { key } = req.params
  const setting = await Settings.findOne({ key })
  const apiKey  = setting?.value || (key === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY)

  if (!apiKey) return res.json({ ok: false, message: 'No API key configured' })

  try {
    if (key === 'groq') {
      const Groq = require('groq-sdk')
      const groq = new Groq({ apiKey })
      await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant', max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return res.json({ ok: true, message: 'Groq connection successful' })
    }

    if (key === 'gemini') {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: setting?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash' })
      await model.generateContent('ping')
      return res.json({ ok: true, message: 'Gemini connection successful' })
    }

    res.json({ ok: false, message: 'Unknown key type' })
  } catch (err) {
    res.json({ ok: false, message: err.message || 'Connection failed' })
  }
}

module.exports = { getSettings, upsertKey, testKey }
