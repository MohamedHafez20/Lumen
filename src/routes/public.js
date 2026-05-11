const express = require('express')
const router  = express.Router()
const c       = require('../controllers/brief.controller')

router.get('/:token',          c.publicView)
router.post('/:token/confirm', c.publicConfirm)
router.post('/:token/reject',  c.publicReject)

module.exports = router
