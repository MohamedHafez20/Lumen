const express         = require('express')
const router          = express.Router()
const auth            = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const c               = require('../controllers/admin.controller')

router.use(auth)

// Departments
router.post('/departments',       requireRole('super_admin'),          c.createDepartment)
router.get('/departments',        requireRole('super_admin'),          c.listDepartments)

// Admins
router.post('/admins',            requireRole('super_admin'),          c.createAdmin)
router.get('/admins',             requireRole('super_admin'),          c.listAdmins)

// Users
router.post('/users',             requireRole('admin','super_admin'),  c.createUser)
router.get('/users',              requireRole('admin','super_admin'),  c.listUsers)
router.delete('/users/:id',       requireRole('admin','super_admin'),  c.deleteUser)

// User brief history — BEFORE /briefs to avoid conflict
router.get('/users/:id/briefs',   requireRole('admin','super_admin'),  c.getUserBriefs)

// Brief oversight
router.get('/briefs',             requireRole('admin','super_admin'),  c.listAllBriefs)
router.get('/briefs/:id',         requireRole('admin','super_admin'),  c.getBriefDetail)

module.exports = router
