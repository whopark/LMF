const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');

const router = express.Router();

// Stage 1 static fallback (used when auth_users collection is empty)
const STATIC_USERS = [
  { name: '신경화', role: 'editor' },
  { name: '서자영', role: 'editor' },
  { name: '강소영', role: 'editor' },
  { name: '김영진', role: 'editor' },
  { name: '박금보래', role: 'editor' },
  { name: '이경훈', role: 'editor' },
  { name: '관리자', role: 'admin' },
];

// GET /api/users — user list for dropdown selection (viewer+)
router.get('/', requireAuth('viewer'), async (req, res) => {
  try {
    const dbUsers = await User.find({ active: true }).select('name role').lean();
    const users = dbUsers.length > 0 ? dbUsers : STATIC_USERS;
    res.json(users);
  } catch (err) {
    serverError(res, err, 'GET /users');
  }
});

// POST /api/users — create auth user (admin only)
router.post('/', requireAuth('admin'), async (req, res) => {
  try {
    const { name, role, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: 'name and password required' });
    }

    const VALID_ROLES = ['viewer', 'editor', 'approver', 'admin'];
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const existing = await User.findOne({ name });
    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, role: role || 'editor', password_hash });

    res.status(201).json({ name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
