const express = require('express');
const db = require('../db');
const {
  isValidContentPayload,
  isValidAutosavePayload,
} = require('../lib/validation');
const {
  TURN_MS,
  sqliteDatetimeToMs,
  finalizeTurn,
  scheduleFinalize,
  getOrCreateNextTurn,
} = require('../lib/turnFlow');

const router = express.Router();

const getTurnByToken = db.prepare('SELECT * FROM turns WHERE token = ?');
const getTurnByGameAndIndex = db.prepare(
  'SELECT * FROM turns WHERE game_id = ? AND turn_index = ?'
);
const getGame = db.prepare('SELECT * FROM games WHERE id = ?');
const getPriorParticipants = db.prepare(
  `SELECT t.turn_index AS turnIndex, t.type, d.username AS username
   FROM turns t
   LEFT JOIN devices d ON d.device_id = t.device_id
   WHERE t.game_id = ? AND t.turn_index < ? AND t.status = 'submitted'
   ORDER BY t.turn_index ASC`
);
const findOtherParticipation = db.prepare(
  `SELECT 1 FROM turns
   WHERE game_id = ? AND device_id = ? AND id != ? AND status IN ('claimed','submitted')
   LIMIT 1`
);
const claimStmt = db.prepare(
  `UPDATE turns SET status='claimed', device_id=?, claimed_at=datetime('now')
   WHERE token = ? AND status = 'pending'`
);
const saveContentStmt = db.prepare(
  "UPDATE turns SET content = ? WHERE id = ? AND status = 'claimed'"
);
const autosaveStmt = db.prepare(
  "UPDATE turns SET content = ? WHERE id = ? AND status = 'claimed' AND device_id = ?"
);

function alreadyParticipated(gameId, deviceId, excludeTurnId) {
  return !!findOtherParticipation.get(gameId, deviceId, excludeTurnId);
}

// GET /api/turns/:token — side-effect-free status check.
router.get('/:token', (req, res) => {
  const turn = getTurnByToken.get(req.params.token);
  if (!turn) return res.status(404).json({ error: 'not_found' });

  const game = getGame.get(turn.game_id);
  const isMine = turn.device_id === req.deviceId;
  const priorParticipants = getPriorParticipants.all(turn.game_id, turn.turn_index);

  const payload = {
    turnIndex: turn.turn_index,
    type: turn.type,
    status: turn.status,
    isMine,
    priorParticipants,
    gameStatus: game.status,
    gameId: game.id,
  };

  if (turn.status === 'pending') {
    payload.alreadyParticipated = alreadyParticipated(turn.game_id, req.deviceId, turn.id);
  }

  if (turn.status === 'claimed' && isMine) {
    const deadlineAt = sqliteDatetimeToMs(turn.claimed_at) + TURN_MS;
    payload.remainingMs = Math.max(0, deadlineAt - Date.now());
    payload.deadlineAt = deadlineAt;
    const prev = getTurnByGameAndIndex.get(turn.game_id, turn.turn_index - 1);
    if (prev) {
      payload.previousContent = { type: prev.type, value: prev.content };
    }
  }

  if (turn.status === 'submitted' && isMine) {
    const next = getTurnByGameAndIndex.get(turn.game_id, turn.turn_index + 1);
    if (next) {
      payload.nextTurn = { token: next.token, url: `/turn/${next.token}` };
    }
  }

  res.json(payload);
});

// POST /api/turns/:token/claim
router.post('/:token/claim', (req, res) => {
  const turn = getTurnByToken.get(req.params.token);
  if (!turn) return res.status(404).json({ error: 'not_found' });

  if (!req.device.username) {
    return res.status(400).json({ error: 'username_required' });
  }

  // Idempotent resume: same device re-opening its own already-claimed turn.
  if (turn.status === 'claimed' && turn.device_id === req.deviceId) {
    const deadlineAt = sqliteDatetimeToMs(turn.claimed_at) + TURN_MS;
    const prev = getTurnByGameAndIndex.get(turn.game_id, turn.turn_index - 1);
    return res.json({
      type: turn.type,
      turnIndex: turn.turn_index,
      deadlineAt,
      previousContent: prev ? { type: prev.type, value: prev.content } : null,
    });
  }

  if (turn.status !== 'pending') {
    return res.status(409).json({ error: 'already_claimed' });
  }

  if (alreadyParticipated(turn.game_id, req.deviceId, turn.id)) {
    return res.status(409).json({ error: 'already_participated' });
  }

  const result = claimStmt.run(req.deviceId, req.params.token);
  if (result.changes === 0) {
    // Someone else won the race between our pending-check and this UPDATE.
    return res.status(409).json({ error: 'already_claimed' });
  }

  const claimedTurn = getTurnByToken.get(req.params.token);
  scheduleFinalize(claimedTurn);

  const prev = getTurnByGameAndIndex.get(turn.game_id, turn.turn_index - 1);
  const deadlineAt = sqliteDatetimeToMs(claimedTurn.claimed_at) + TURN_MS;
  res.json({
    type: claimedTurn.type,
    turnIndex: claimedTurn.turn_index,
    deadlineAt,
    previousContent: prev ? { type: prev.type, value: prev.content } : null,
  });
});

// POST /api/turns/:token/autosave
router.post('/:token/autosave', (req, res) => {
  const turn = getTurnByToken.get(req.params.token);
  if (!turn) return res.status(404).json({ error: 'not_found' });
  if (turn.device_id !== req.deviceId) {
    return res.status(403).json({ error: 'not_owner' });
  }
  if (turn.status !== 'claimed') {
    return res.status(409).json({ error: 'not_claimable' });
  }
  const { content } = req.body || {};
  if (!isValidAutosavePayload(content, turn.type)) {
    return res.status(400).json({ error: 'invalid_content' });
  }
  autosaveStmt.run(content, turn.id, req.deviceId);
  res.json({ ok: true });
});

// POST /api/turns/:token/submit
router.post('/:token/submit', (req, res) => {
  const turn = getTurnByToken.get(req.params.token);
  if (!turn) return res.status(404).json({ error: 'not_found' });
  if (turn.device_id !== req.deviceId) {
    return res.status(403).json({ error: 'not_owner' });
  }
  if (turn.status !== 'claimed') {
    // Either already finalized by the server-side 30s timeout, or a duplicate call.
    // Not an error from the client's perspective — report current state so it can proceed.
    if (turn.status === 'submitted') {
      const game = getGame.get(turn.game_id);
      return res.status(409).json({
        error: 'already_finalized',
        turnIndex: turn.turn_index,
        isLastTurn: turn.turn_index === game.participant_count,
        gameId: game.id,
      });
    }
    return res.status(409).json({ error: 'invalid_state' });
  }

  const { content } = req.body || {};
  if (!isValidContentPayload(content, turn.type)) {
    return res.status(400).json({ error: 'invalid_content' });
  }

  saveContentStmt.run(content, turn.id);
  const outcome = finalizeTurn(turn.id);
  if (!outcome) {
    // Lost the race to the server timer firing a moment earlier; report its result.
    const finalTurn = getTurnByToken.get(req.params.token);
    const game = getGame.get(finalTurn.game_id);
    return res.json({
      turnIndex: finalTurn.turn_index,
      isLastTurn: finalTurn.turn_index === game.participant_count,
      gameId: game.id,
    });
  }

  res.json({
    turnIndex: outcome.turn.turn_index,
    isLastTurn: outcome.isLastTurn,
    gameId: outcome.turn.game_id,
  });
});

// POST /api/turns/:token/next
router.post('/:token/next', (req, res) => {
  const turn = getTurnByToken.get(req.params.token);
  if (!turn) return res.status(404).json({ error: 'not_found' });
  if (turn.device_id !== req.deviceId) {
    return res.status(403).json({ error: 'not_owner' });
  }
  if (turn.status !== 'submitted') {
    return res.status(409).json({ error: 'not_ready' });
  }

  const game = getGame.get(turn.game_id);
  const result = getOrCreateNextTurn(game, turn.turn_index);
  if (result.error === 'no_next_turn') {
    return res.status(409).json({ error: 'no_next_turn' });
  }
  res.json({ nextToken: result.turn.token, nextUrl: `/turn/${result.turn.token}` });
});

module.exports = router;
