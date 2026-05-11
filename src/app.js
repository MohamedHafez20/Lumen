require('dotenv').config()
require('express-async-errors')

const express = require('express')
const cors    = require('cors')
const helmet  = require('helmet')
const morgan  = require('morgan')
const path    = require('path')

const app = express()

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(morgan('dev'))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files (for local dev — in production use S3 URLs directly)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

app.use('/auth',          require('./routes/auth'))
app.use('/briefs',        require('./routes/briefs'))
app.use('/admin',         require('./routes/admin'))
app.use('/p',             require('./routes/public'))
app.use('/notifications', require('./routes/notifications'))
app.use('/settings',      require('./routes/settings'))

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }))

app.use((err, req, res, next) => {
  console.error(err)
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Max 25MB.' })
  if (err.message?.startsWith('File type not allowed')) return res.status(415).json({ error: err.message })
  if (err.code === 11000) return res.status(409).json({ error: 'A record with this value already exists.' })
  const status  = err.status || 500
  const message = process.env.NODE_ENV === 'production' && status === 500 ? 'Unexpected error' : err.message
  res.status(status).json({ error: message })
})

module.exports = app
