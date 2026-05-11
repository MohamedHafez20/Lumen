require('dotenv').config()
const mongoose   = require('mongoose')
const bcrypt     = require('bcryptjs')
const SuperAdmin = require('./models/SuperAdmin')
const Department = require('./models/Department')
const Admin      = require('./models/Admin')
const User       = require('./models/User')

async function seed() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected. Seeding...\n')

  await SuperAdmin.deleteMany({})
  await Department.deleteMany({})
  await Admin.deleteMany({})
  await User.deleteMany({})

  const superAdmin = await SuperAdmin.create({
    name: 'Super Admin',
    email: 'super@lumen.app',
    password_hash: await bcrypt.hash('superpassword123', 10),
  })
  console.log('Super admin created:', superAdmin.email)

  const department = await Department.create({
    name: 'Design Department',
    description: 'UI/UX and branding team',
    created_by: superAdmin._id,
  })
  console.log('Department created:', department.name)

  const admin = await Admin.create({
    name: 'Department Admin',
    email: 'admin@lumen.app',
    password_hash: await bcrypt.hash('adminpassword123', 10),
    dept_id: department._id,
    created_by: superAdmin._id,
  })
  console.log('Admin created:', admin.email)

  const user = await User.create({
    name: 'Sara Ahmed',
    email: 'sara@lumen.app',
    password_hash: await bcrypt.hash('userpassword123', 10),
    dept_id: department._id,
    created_by: admin._id,
  })
  console.log('User created:', user.email)

  console.log('\nDone. Credentials:')
  console.log('  super@lumen.app  / superpassword123')
  console.log('  admin@lumen.app  / adminpassword123')
  console.log('  sara@lumen.app   / userpassword123')

  await mongoose.disconnect()
}

seed().catch(e => { console.error(e); process.exit(1) })
