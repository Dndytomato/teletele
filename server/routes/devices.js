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

const getMyGames = db.prepare(`
  SELECT g.id AS gameId, g.status AS status, g.participant_count AS participantCount,
         g.created_at AS createdAt
  FROM games g
  WHERE EXISTS (SELECT 1 FROM turns t WHERE t.game_id = g.id AND t.device_id = ?)
  ORDER BY g.created_at DESC
`);
const getSubmittedCount = db.prepare(
  "SELECT COUNT(*) AS c FROM turns WHERE game_id = ? AND status = 'submitted'"
);
const getMyLastTurn = db.prepare(
  'SELECT token, turn_index AS turnIndex FROM turns WHERE game_id = ? AND device_id = ? ORDER BY turn_index DESC LIMIT 1'
);

// GET /api/devices/me/games?status=completed|in_progress — games this device has
// participated in (as creator or any other turn), optionally filtered by status.
router.get('/me/games', (req, res) => {
  const statusFilter = req.query.status;
  let games = getMyGames.all(req.deviceId);
  if (statusFilter === 'completed' || statusFilter === 'in_progress') {
    games = games.filter((g) => g.status === statusFilter);
  }
  const enriched = games.map((g) => {
    const { c } = getSubmittedCount.get(g.gameId);
    const myLast = getMyLastTurn.get(g.gameId, req.deviceId);
    return {
      gameId: g.gameId,
      status: g.status,
      participantCount: g.participantCount,
      submittedCount: c,
      createdAt: g.createdAt,
      myLastTurnToken: myLast ? myLast.token : null,
      myLastTurnIndex: myLast ? myLast.turnIndex : null,
    };
  });
  res.json({ games: enriched });
});

module.exports = router;
