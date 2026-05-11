const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String },
  created_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
}, { timestamps: true })

module.exports = mongoose.model('Department', departmentSchema)
