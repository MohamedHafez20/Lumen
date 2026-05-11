const { v4: uuidv4 } = require('uuid')
const path  = require('path')
const fs    = require('fs')

// ── REAL S3 (uncomment when ready) ───────────────────────────────────────────
// const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
// const s3 = new S3Client({ region: process.env.AWS_REGION, credentials: {
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
// }})
// ─────────────────────────────────────────────────────────────────────────────

// ── REAL Whisper (uncomment when ready) ──────────────────────────────────────
// const OpenAI = require('openai')
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
// ─────────────────────────────────────────────────────────────────────────────

const AUDIO_TYPES = ['audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg','audio/x-m4a']
const IMAGE_TYPES = ['image/jpeg','image/png','image/webp']

function detectFileType(mimeType) {
  if (AUDIO_TYPES.includes(mimeType)) return 'AUDIO'
  if (IMAGE_TYPES.includes(mimeType)) return 'IMAGE'
  return 'DOCUMENT'
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads')

async function uploadFile(buffer, originalName, mimeType, folder = 'uploads') {
  // In production: upload to S3 and return S3 URL
  // For dev: save locally and return a local URL
  if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET_NAME) {
    // ── REAL S3 (uncomment when ready) ────────────────────────────────────
    // const key = `${folder}/${uuidv4()}-${originalName}`
    // await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: buffer, ContentType: mimeType }))
    // return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  }

  // Local storage fallback
  const subDir = path.join(UPLOAD_DIR, folder)
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })
  const filename = `${uuidv4()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filepath = path.join(subDir, filename)
  fs.writeFileSync(filepath, buffer)
  return `/uploads/${folder}/${filename}`
}

async function transcribeAudio(buffer, originalName, mimeType) {
  // ── REAL Whisper (uncomment when ready) ───────────────────────────────────
  // const FormData = require('form-data')
  // const form = new FormData()
  // form.append('file', buffer, { filename: originalName, contentType: mimeType })
  // form.append('model', 'whisper-1')
  // const res = await openai.audio.transcriptions.create(form)
  // return res.text
  // ──────────────────────────────────────────────────────────────────────────
  return `[MOCK TRANSCRIPT] Simulated transcription of ${originalName}. The client discussed their project requirements.`
}

async function processAttachments(files = {}, interpretImage) {
  const results = []
  const all = [
    ...(files.audio     || []).map(f => ({ ...f, folder: 'audio' })),
    ...(files.images    || []).map(f => ({ ...f, folder: 'images' })),
    ...(files.documents || []).map(f => ({ ...f, folder: 'documents' })),
  ]
  for (const file of all) {
    const fileType        = detectFileType(file.mimetype)
    const file_url        = await uploadFile(file.buffer, file.originalname, file.mimetype, file.folder)
    let transcription     = null
    let ai_interpretation = null
    if (fileType === 'AUDIO') transcription     = await transcribeAudio(file.buffer, file.originalname, file.mimetype)
    if (fileType === 'IMAGE') ai_interpretation = await interpretImage(file.buffer, file.mimetype)
    results.push({ type: fileType, original_filename: file.originalname, file_url, transcription, ai_interpretation })
  }
  return results
}

module.exports = { processAttachments, uploadFile }
