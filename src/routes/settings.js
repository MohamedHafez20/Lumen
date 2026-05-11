const express         = require('express')
const router          = express.Router()
const auth            = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const c               = require('../controllers/settings.controller')

router.use(auth, requireRole('super_admin'))

router.get('/',           c.getSettings)
router.post('/',          c.upsertKey)
router.post('/:key/test', c.testKey)

module.exports = router
