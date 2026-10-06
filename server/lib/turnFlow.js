const { nanoid } = require('nanoid');
const db = require('../db');

const TURN_SECONDS = 30;
const TURN_MS = TURN_SECONDS * 1000;

// turnId -> Timeout handle, so a manual submit can cancel the pending auto-finalize.
const timers = new Map();

function nextTurnType(turnIndex) {
  return turnIndex % 2 === 0 ? 'drawing' : 'word';
}

// SQLite datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker.
function sqliteDatetimeToMs(sqliteDatetime) {
  return new Date(sqliteDatetime.replace(' ', 'T') + 'Z').getTime();
}

function clearTimer(turnId) {
  const handle = timers.get(turnId);
  if (handle) {
    clearTimeout(handle);
    timers.delete(turnId);
  }
}

const finalizeStmt = db.prepare(
  "UPDATE turns SET status='submitted', submitted_at=datetime('now') WHERE id = ? AND status = 'claimed'"
);
const getTurnById = db.prepare('SELECT * FROM turns WHERE id = ?');
const completeGameStmt = db.prepare(
  "UPDATE games SET status='completed', completed_at=datetime('now') WHERE id = ? AND status != 'completed'"
);

// Shared by both the manual /submit route and the server-enforced 30s timeout.
// Caller is responsible for writing final `content` BEFORE calling this when it's a manual submit;
// the auto path relies on whatever the latest /autosave call already wrote.
function finalizeTurn(turnId) {
  clearTimer(turnId);
  const result = finalizeStmt.run(turnId);
  if (result.changes === 0) {
    // Already finalized by the other path (race between manual submit and timeout) — no-op.
    return null;
  }
  const turn = getTurnById.get(turnId);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(turn.game_id);
  const isLastTurn = turn.turn_index === game.participant_count;
  if (isLastTurn) {
    completeGameStmt.run(game.id);
  }
  return { turn, isLastTurn };
}

function scheduleFinalize(turn) {
  clearTimer(turn.id);
  const claimedAtMs = sqliteDatetimeToMs(turn.claimed_at);
  const remaining = claimedAtMs + TURN_MS - Date.now();
  if (remaining <= 0) {
    finalizeTurn(turn.id);
    return;
  }
  const handle = setTimeout(() => finalizeTurn(turn.id), remaining);
  timers.set(turn.id, handle);
}

// Called once at server boot to resume/finalize any turn that was mid-countdown
// when the process last stopped (in-memory timers don't survive a restart).
function reconcileOnBoot() {
  const claimedTurns = db.prepare("SELECT * FROM turns WHERE status = 'claimed'").all();
  for (const turn of claimedTurns) {
    scheduleFinalize(turn);
  }
}

const insertNextTurn = db.prepare(
  `INSERT INTO turns (game_id, turn_index, type, token)
   VALUES (?, ?, ?, ?)`
);
const getTurnByGameAndIndex = db.prepare(
  'SELECT * FROM turns WHERE game_id = ? AND turn_index = ?'
);

// Idempotent: if turn_index+1 already exists (double-tap on "다음 참여자 지정"), return it as-is.
function getOrCreateNextTurn(game, prevTurnIndex) {
  if (prevTurnIndex >= game.participant_count) {
    return { error: 'no_next_turn' };
  }
  const nextIndex = prevTurnIndex + 1;
  const existing = getTurnByGameAndIndex.get(game.id, nextIndex);
  if (existing) {
    return { turn: existing };
  }
  const token = nanoid(16);
  insertNextTurn.run(game.id, nextIndex, nextTurnType(nextIndex), token);
  return { turn: getTurnByGameAndIndex.get(game.id, nextIndex) };
}

module.exports = {
  TURN_SECONDS,
  TURN_MS,
  nextTurnType,
  sqliteDatetimeToMs,
  finalizeTurn,
  scheduleFinalize,
  reconcileOnBoot,
  getOrCreateNextTurn,
  clearTimer,
};
