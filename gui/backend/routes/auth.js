const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { requireAuth } = require('../middleware/roles');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

function auditLogin(user, ip, success) {
  AuditLog.create({
    user: user, role: 'unknown', action: 'login',
    resource_type: 'auth', details: { success },
    ip,
  }).catch(() => {});
}

// POST /api/auth/login — { name, password } → { token, user }
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: 'name and password required' });
    }

    const user = await User.findOne({ name, active: true }).lean();
    if (!user) {
      auditLogin(name, req.ip, false);
      return res.status(404).json({ message: 'User not found' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      auditLogin(name, req.ip, false);
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    await User.findByIdAndUpdate(user._id, { last_login: new Date() });
    AuditLog.create({
      user: user.name, role: user.role, action: 'login',
      resource_type: 'auth', details: { success: true }, ip: req.ip,
    }).catch(() => {});

    res.json({
      token,
      user: { name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — returns current user from Bearer token
router.get('/me', requireAuth('viewer'), (req, res) => {
  res.json({ name: req.user.name, role: req.user.role });
});

module.exports = router;
