const express         = require('express')
const router          = express.Router()
const auth            = require('../middleware/auth')
const { briefUpload } = require('../middleware/upload')
const c               = require('../controllers/brief.controller')

// All routes require authentication — any role (user, admin, super_admin)
router.use(auth)

router.post('/',                briefUpload, c.create)
router.get('/',                              c.list)
router.get('/:id',                           c.getOne)
router.delete('/:id',                        c.remove)
router.post('/:id/regenerate',               c.regenerate)
router.post('/:id/resend',                   c.resend)
router.get('/:id/versions',                  c.versions)

module.exports = router
