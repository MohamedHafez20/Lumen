const Notification = require('../models/Notification')

async function list(req, res) {
  const notifications = await Notification.find({ user_id: req.user.id }).sort({ createdAt: -1 }).limit(50)
  res.json(notifications)
}

async function markRead(req, res) {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, user_id: req.user.id },
    { is_read: true },
    { new: true }
  )
  if (!notif) return res.status(404).json({ error: 'Notification not found' })
  res.json({ message: 'Marked as read' })
}

async function markAllRead(req, res) {
  await Notification.updateMany({ user_id: req.user.id, is_read: false }, { is_read: true })
  res.json({ message: 'All notifications marked as read' })
}

async function unreadCount(req, res) {
  const count = await Notification.countDocuments({ user_id: req.user.id, is_read: false })
  res.json({ count })
}

module.exports = { list, markRead, markAllRead, unreadCount }
