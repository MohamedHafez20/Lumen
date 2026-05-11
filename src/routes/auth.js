// routes/auth.js
const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const c       = require('../controllers/auth.controller')
router.post('/login', c.login)
router.get('/me', auth, c.me)
module.exports = router
