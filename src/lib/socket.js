const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

let io = null
const userSockets = new Map()

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id)

    socket.on('authenticate', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        userSockets.set(decoded.id, socket.id)
        socket.emit('authenticated', { ok: true })
        console.log(`User ${decoded.id} mapped to socket ${socket.id}`)
      } catch {
        socket.emit('authenticated', { ok: false, error: 'Invalid token' })
      }
    })

    socket.on('disconnect', () => {
      for (const [userId, socketId] of userSockets) {
        if (socketId === socket.id) {
          userSockets.delete(userId)
          break
        }
      }
    })
  })

  return { io, userSockets }
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialised')
  return io
}

function getUserSockets() {
  return userSockets
}

module.exports = { initSocket, getIo, getUserSockets }
