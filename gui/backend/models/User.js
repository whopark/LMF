const mongoose = require('mongoose');

// Auth users for JWT login. Separate from the Stage-1 static dropdown list.
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ['viewer', 'editor', 'approver', 'admin'],
    default: 'editor',
  },
  password_hash: { type: String, required: true },
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  last_login: Date,
});

userSchema.index({ name: 1 });

const User = mongoose.models.User ||
  mongoose.model('User', userSchema, 'auth_users');

module.exports = User;
