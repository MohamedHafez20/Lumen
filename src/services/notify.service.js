const Notification = require('../models/Notification')
const { getIo, getUserSockets } = require('../lib/socket')

async function notify(userId, type, title, body, briefId = null) {
  const notification = await Notification.create({ user_id: userId, type, title, body, brief_id: briefId })

  try {
    const io          = getIo()
    const userSockets = getUserSockets()
    const socketId    = userSockets.get(String(userId))
    if (socketId) io.to(socketId).emit('notification', { id: notification._id, type, title, body, brief_id: briefId, created_at: notification.createdAt })
  } catch { }

  return notification
}

async function notifyBriefConfirmed(userId, briefId, clientName) {
  return notify(userId, 'BRIEF_CONFIRMED', 'Brief confirmed', `${clientName} confirmed the brief — ready to begin.`, briefId)
}

async function notifyBriefRejected(userId, briefId, clientName) {
  return notify(userId, 'BRIEF_REJECTED', 'Feedback received', `${clientName} submitted feedback — review and regenerate.`, briefId)
}

async function notifyBriefResent(userId, briefId, clientName) {
  return notify(userId, 'BRIEF_RESENT', 'Brief resent', `Updated brief sent to ${clientName} — awaiting confirmation.`, briefId)
}

module.exports = { notify, notifyBriefConfirmed, notifyBriefRejected, notifyBriefResent }
