const multer = require('multer')

const ALLOWED = [
  'audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg','audio/x-m4a',
  'image/jpeg','image/png','image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new Error(`File type not allowed: ${file.mimetype}`))
  },
})

const briefUpload = upload.fields([
  { name: 'audio',     maxCount: 5 },
  { name: 'images',    maxCount: 5 },
  { name: 'documents', maxCount: 5 },
])

module.exports = { briefUpload }
