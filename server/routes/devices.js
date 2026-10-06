const express = require('express');
const db = require('../db');
const { isValidUsername } = require('../lib/validation');

const router = express.Router();

router.get('/me', (req, res) => {
  res.json({ deviceId: req.deviceId, username: req.device.username });
});

const setUsernameStmt = db.prepare(
  'UPDATE devices SET username = ? WHERE device_id = ?'
);

router.post('/username', (req, res) => {
  const { username } = req.body || {};
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'invalid_username' });
  }
  setUsernameStmt.run(username.trim(), req.deviceId);
  res.json({ deviceId: req.deviceId, username: username.trim() });
});

module.exports = router;
