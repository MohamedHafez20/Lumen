const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:     { type: String, enum: ['BRIEF_CONFIRMED', 'BRIEF_REJECTED', 'BRIEF_RESENT'], required: true },
  title:    { type: String, required: true },
  body:     { type: String, required: true },
  brief_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Brief', default: null },
  is_read:  { type: Boolean, default: false },
}, { timestamps: true })

module.exports = mongoose.model('Notification', notificationSchema)
