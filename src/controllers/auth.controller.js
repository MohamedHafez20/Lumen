const bcrypt     = require('bcryptjs')
const jwt        = require('jsonwebtoken')
const SuperAdmin = require('../models/SuperAdmin')
const Admin      = require('../models/Admin')
const User       = require('../models/User')

async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  let account = null
  let role    = null

  const superAdmin = await SuperAdmin.findOne({ email })
  if (superAdmin) { account = superAdmin; role = 'super_admin' }

  if (!account) {
    const admin = await Admin.findOne({ email })
    if (admin) { account = admin; role = 'admin' }
  }

  if (!account) {
    const user = await User.findOne({ email })
    if (user) { account = user; role = 'user' }
  }

  if (!account) return res.status(401).json({ error: 'Invalid email or password' })

  const match = await bcrypt.compare(password, account.password_hash)
  if (!match) return res.status(401).json({ error: 'Invalid email or password' })

  const payload = {
    id:      String(account._id),
    email:   account.email,
    role,
    dept_id: account.dept_id ? String(account.dept_id) : null,
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

  res.json({ token, user: { id: account._id, name: account.name, email: account.email, role, dept_id: account.dept_id || null } })
}

async function me(req, res) {
  const { id, role } = req.user
  let account = null
  if (role === 'super_admin') account = await SuperAdmin.findById(id).select('-password_hash')
  else if (role === 'admin')  account = await Admin.findById(id).select('-password_hash')
  else                        account = await User.findById(id).select('-password_hash')

  if (!account) return res.status(404).json({ error: 'Account not found' })
  res.json({ ...account.toObject(), role })
}

module.exports = { login, me }
