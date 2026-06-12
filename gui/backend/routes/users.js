const express = require('express');

const router = express.Router();

// Stage 1: static user list (no auth — identity for revision logging only).
// Populated from 1차 전산 TFT workshop members.
// Extend via USERS_JSON env var (JSON array of {name, role} objects).
function getUsers() {
  if (process.env.USERS_JSON) {
    try {
      return JSON.parse(process.env.USERS_JSON);
    } catch {
      console.warn('[users] Invalid USERS_JSON env var, using defaults');
    }
  }
  return [
    { name: '신경화', role: 'editor' },
    { name: '서자영', role: 'editor' },
    { name: '강소영', role: 'editor' },
    { name: '김영진', role: 'editor' },
    { name: '박금보래', role: 'editor' },
    { name: '이경훈', role: 'editor' },
    { name: '관리자', role: 'admin' },
  ];
}

// GET /api/users — return user list for dropdown selection
router.get('/', (req, res) => {
  res.json(getUsers());
});

module.exports = router;
