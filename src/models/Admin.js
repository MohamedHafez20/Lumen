const mongoose = require('mongoose')

const adminSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  dept_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  created_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
}, { timestamps: true })

module.exports = mongoose.model('Admin', adminSchema)
