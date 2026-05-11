const { createServer } = require('http')
const app              = require('./app')
const connectDB        = require('./lib/db')
const { initSocket }   = require('./lib/socket')

const PORT = process.env.PORT || 3000

async function start() {
  await connectDB()
  const httpServer = createServer(app)
  initSocket(httpServer)
  httpServer.listen(PORT, () => {
    console.log(`\nLumen backend running on port ${PORT}`)
    console.log(`Environment : ${process.env.NODE_ENV || 'development'}`)
    console.log(`Database    : MongoDB (local)`)
    console.log(`Frontend    : ${process.env.FRONTEND_URL}\n`)
  })
}

start()
