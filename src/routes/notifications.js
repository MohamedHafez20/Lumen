const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const c       = require('../controllers/notification.controller')

router.use(auth)
router.get('/',             c.list)
router.get('/unread-count', c.unreadCount)
router.patch('/read-all',   c.markAllRead)
router.patch('/:id/read',   c.markRead)

module.exports = router
