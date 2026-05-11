const { v4: uuidv4 } = require('uuid')
const path  = require('path')
const fs    = require('fs')
const Groq  = require('groq-sdk')

let toFile = null
try { toFile = require('groq-sdk/uploads').toFile } catch { toFile = null }

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const AUDIO_TYPES    = ['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a','audio/wav','audio/x-wav','audio/wave','audio/webm','audio/ogg']
const IMAGE_TYPES    = ['image/jpeg','image/png','image/webp']
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

function detectFileType(mimeType) {
  if (AUDIO_TYPES.includes(mimeType))    return 'AUDIO'
  if (IMAGE_TYPES.includes(mimeType))    return 'IMAGE'
  if (DOCUMENT_TYPES.includes(mimeType)) return 'DOCUMENT'
  return 'DOCUMENT'
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads')

// ── Upload to local storage (swap for S3 in production) ───────────────────────
async function uploadToStorage(buffer, originalName, mimeType, folder = 'uploads') {
  // ── REAL S3 (uncomment when ready) ──────────────────────────────────────────
  // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
  // const s3 = new S3Client({ region: process.env.AWS_REGION, credentials: {
  //   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // }})
  // const key = `${folder}/${uuidv4()}-${originalName}`
  // await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: buffer, ContentType: mimeType }))
  // return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  // ────────────────────────────────────────────────────────────────────────────

  const subDir = path.join(UPLOAD_DIR, folder)
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })
  const filename = `${uuidv4()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  fs.writeFileSync(path.join(subDir, filename), buffer)
  return `/uploads/${folder}/${filename}`
}

// ── Real Groq Whisper transcription ──────────────────────────────────────────
async function transcribeAudio(buffer, originalName, mimeType) {
  const { File: NodeFile } = require('buffer')
  const file = toFile
    ? await toFile(buffer, originalName, { type: mimeType })
    : new NodeFile([buffer], originalName, { type: mimeType })

  // No language forced — Whisper auto-detects Arabic/English/mixed
  const result = await groq.audio.transcriptions.create({
    file,
    model:           'whisper-large-v3',
    response_format: 'verbose_json',
    prompt:          'This may contain Arabic, English, or mixed Arabic-English project requirements. Preserve names, numbers, prices, dates, platforms, and feature wording exactly.',
  })

  // verbose_json always returns .text
  const text = result && typeof result === 'object' && result.text
    ? result.text.trim()
    : typeof result === 'string'
      ? result.trim()
      : ''

  if (!text) throw new Error('Groq transcription returned empty text')
  return text
}

// ── PDF text extraction ───────────────────────────────────────────────────────
async function extractDocumentText(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      const text = data.text?.trim()
      if (!text) return '[PDF contained no extractable text — may be a scanned image]'
      return text.length > 16000 ? text.slice(0, 16000) + '\n...[truncated]' : text
    } catch (e) {
      console.error('PDF parse error:', e.message)
      return '[PDF could not be parsed]'
    }
  }
  return '[Word document attached — paste the content as text for best results]'
}

// ── Main: process all uploaded files ─────────────────────────────────────────
async function processAttachments(files = {}, interpretImage) {
  const results = []
  const allFiles = [
    ...(files.audio     || []).map(f => ({ ...f, folder: 'audio' })),
    ...(files.images    || []).map(f => ({ ...f, folder: 'images' })),
    ...(files.documents || []).map(f => ({ ...f, folder: 'documents' })),
  ]

  for (const file of allFiles) {
    const fileType        = detectFileType(file.mimetype)
    let file_url          = null
    let transcription     = null
    let ai_interpretation = null
    let processing_error  = null

    try {
      file_url = await uploadToStorage(file.buffer, file.originalname, file.mimetype, file.folder)
    } catch (err) {
      console.error(`Storage upload failed for ${file.originalname}:`, err.message)
    }

    if (fileType === 'AUDIO') {
      try {
        transcription = await transcribeAudio(file.buffer, file.originalname, file.mimetype)
      } catch (err) {
        console.error(`Transcription failed for ${file.originalname}:`, err.message)
        processing_error = `Transcription failed: ${err.message}`
      }
    }

    if (fileType === 'IMAGE') {
      try {
        ai_interpretation = await interpretImage(file.buffer, file.mimetype)
      } catch (err) {
        console.error(`Image interpretation failed for ${file.originalname}:`, err.message)
        processing_error = `Image analysis failed: ${err.message}`
      }
    }

    if (fileType === 'DOCUMENT') {
      try {
        ai_interpretation = await extractDocumentText(file.buffer, file.mimetype)
      } catch (err) {
        console.error(`Document extraction failed for ${file.originalname}:`, err.message)
        processing_error = `Document text extraction failed: ${err.message}`
      }
    }

    results.push({
      type:              fileType,
      original_filename: file.originalname,
      file_url,
      transcription,
      ai_interpretation,
      processing_error,
    })
  }
  return results
}

module.exports = { processAttachments, uploadToStorage }
