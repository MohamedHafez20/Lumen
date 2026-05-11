const multer = require('multer')

const ALLOWED = [
  // Audio — expanded list from v2
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg',
  // Images
  'image/jpeg', 'image/png', 'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ALLOWED.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`File type not allowed: ${file.mimetype}`))
  },
})

const briefUpload = upload.fields([
  { name: 'audio',     maxCount: 5 },
  { name: 'images',    maxCount: 5 },
  { name: 'documents', maxCount: 5 },
])

module.exports = { briefUpload }
