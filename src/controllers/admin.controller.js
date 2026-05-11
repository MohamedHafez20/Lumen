const bcrypt     = require('bcryptjs')
const SuperAdmin = require('../models/SuperAdmin')
const Admin      = require('../models/Admin')
const User       = require('../models/User')
const Department = require('../models/Department')
const Brief      = require('../models/Brief')

// ── Departments ───────────────────────────────────────────────────────────────
async function createDepartment(req, res) {
  const { name, description } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const dept = await Department.create({ name, description, created_by: req.user.id })
  res.status(201).json(dept)
}

async function listDepartments(req, res) {
  res.json(await Department.find().sort({ createdAt: -1 }))
}

// ── Admins ────────────────────────────────────────────────────────────────────
async function createAdmin(req, res) {
  const { name, email, password, dept_id } = req.body
  if (!name || !email || !password || !dept_id)
    return res.status(400).json({ error: 'name, email, password, dept_id are required' })
  if (await Admin.findOne({ email })) return res.status(409).json({ error: 'Email already in use' })
  const admin = await Admin.create({ name, email, password_hash: await bcrypt.hash(password, 10), dept_id, created_by: req.user.id })
  res.status(201).json({ id: admin._id, name: admin.name, email: admin.email, dept_id: admin.dept_id })
}

async function listAdmins(req, res) {
  const filter = req.query.dept_id ? { dept_id: req.query.dept_id } : {}
  res.json(await Admin.find(filter).select('-password_hash').sort({ createdAt: -1 }))
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function createUser(req, res) {
  const { name, email, password } = req.body
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, password are required' })

  const dept_id = req.user.role === 'admin' ? req.user.dept_id : req.body.dept_id
  if (!dept_id) return res.status(400).json({ error: 'dept_id is required' })

  const [eu, ea, es] = await Promise.all([User.findOne({email}), Admin.findOne({email}), SuperAdmin.findOne({email})])
  if (eu || ea || es) return res.status(409).json({ error: 'Email already in use' })

  const user = await User.create({ name, email, password_hash: await bcrypt.hash(password, 10), dept_id, created_by: req.user.id })
  res.status(201).json({ id: user._id, name: user.name, email: user.email, dept_id: user.dept_id })
}

async function listUsers(req, res) {
  const filter = req.user.role === 'admin' ? { dept_id: req.user.dept_id } : {}
  res.json(await User.find(filter).select('-password_hash').sort({ createdAt: -1 }))
}

async function deleteUser(req, res) {
  const filter = req.user.role === 'admin' ? { _id: req.params.id, dept_id: req.user.dept_id } : { _id: req.params.id }
  const user = await User.findOneAndDelete(filter)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.status(204).send()
}

// ── Briefs (admin oversight) ──────────────────────────────────────────────────
async function listAllBriefs(req, res) {
  let briefs
  if (req.user.role === 'admin') {
    const users = await User.find({ dept_id: req.user.dept_id }).select('_id')
    briefs = await Brief.find({ user_id: { $in: users.map(u => u._id) } }).sort({ createdAt: -1 })
  } else {
    briefs = await Brief.find().sort({ createdAt: -1 })
  }
  res.json(briefs.map(b => ({ ...b.toObject(), user_id: String(b.user_id) })))
}

/**
 * GET /admin/users/:id/briefs
 * Paginated brief history for a specific user.
 */
async function getUserBriefs(req, res) {
  if (req.user.role === 'admin') {
    const u = await User.findOne({ _id: req.params.id, dept_id: req.user.dept_id })
    if (!u) return res.status(404).json({ error: 'User not found in your department' })
  }
  const limit = parseInt(req.query.limit) || 10
  const skip  = parseInt(req.query.skip)  || 0
  const [briefs, total] = await Promise.all([
    Brief.find({ user_id: req.params.id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Brief.countDocuments({ user_id: req.params.id }),
  ])
  res.json({ briefs: briefs.map(b => ({ ...b.toObject(), user_id: String(b.user_id) })), total, hasMore: skip+limit < total })
}

/**
 * GET /admin/briefs/:id
 * Full brief detail — admin can view any brief in their dept, super can view all.
 */
async function getBriefDetail(req, res) {
  const brief = await Brief.findById(req.params.id)
  if (!brief) return res.status(404).json({ error: 'Brief not found' })

  // scope check for admin
  if (req.user.role === 'admin') {
    const owner = await User.findOne({ _id: brief.user_id, dept_id: req.user.dept_id })
    if (!owner) return res.status(403).json({ error: 'Brief not in your department' })
  }

  res.json({
    ...brief.toObject(),
    share_url: `${process.env.FRONTEND_URL}/p/${brief.share_token}`,
    user_id: String(brief.user_id),
  })
}

module.exports = {
  createDepartment, listDepartments,
  createAdmin, listAdmins,
  createUser, listUsers, deleteUser,
  listAllBriefs, getUserBriefs, getBriefDetail,
}
