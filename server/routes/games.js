const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { isOddParticipantCount, isValidWord } = require('../lib/validation');

const router = express.Router();

const insertGame = db.prepare(
  `INSERT INTO games (id, starting_word, participant_count, creator_device_id)
   VALUES (?, ?, ?, ?)`
);
const insertTurn1 = db.prepare(
  `INSERT INTO turns (game_id, turn_index, type, token, status, device_id, content, claimed_at, submitted_at)
   VALUES (?, 1, 'word', ?, 'submitted', ?, ?, datetime('now'), datetime('now'))`
);

router.post('/', (req, res) => {
  if (!req.device.username) {
    return res.status(400).json({ error: 'username_required' });
  }
  const { startingWord, participantCount } = req.body || {};
  if (!isValidWord(startingWord)) {
    return res.status(400).json({ error: 'invalid_word' });
  }
  if (!isOddParticipantCount(participantCount)) {
    return res.status(400).json({ error: 'invalid_participant_count' });
  }

  const gameId = nanoid(12);
  const turn1Token = nanoid(16);

  db.exec('BEGIN');
  try {
    insertGame.run(gameId, startingWord.trim(), participantCount, req.deviceId);
    insertTurn1.run(gameId, turn1Token, req.deviceId, startingWord.trim());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.json({ gameId, turn1Token });
});

const getGame = db.prepare('SELECT * FROM games WHERE id = ?');
const countTotals = db.prepare(
  "SELECT COUNT(*) AS submitted FROM turns WHERE game_id = ? AND status = 'submitted'"
);

router.get('/:gameId/status', (req, res) => {
  const game = getGame.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'not_found' });
  const { submitted } = countTotals.get(game.id);
  res.json({
    status: game.status,
    submittedCount: submitted,
    totalCount: game.participant_count,
  });
});

const getResultTurns = db.prepare(
  `SELECT t.turn_index AS turnIndex, t.type, t.content, t.submitted_at AS submittedAt,
          d.username AS username
   FROM turns t
   LEFT JOIN devices d ON d.device_id = t.device_id
   WHERE t.game_id = ? AND t.status = 'submitted'
   ORDER BY t.turn_index ASC`
);

router.get('/:gameId/result', (req, res) => {
  const game = getGame.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'not_found' });
  if (game.status !== 'completed') {
    const { submitted } = countTotals.get(game.id);
    return res.status(409).json({
      status: 'in_progress',
      submittedCount: submitted,
      totalCount: game.participant_count,
    });
  }
  const turns = getResultTurns.all(game.id).map((t) => ({
    ...t,
    username: t.username || '알 수 없음',
    content: t.content || null,
  }));
  res.json({ status: 'completed', turns });
});

module.exports = router;
