CREATE TABLE IF NOT EXISTS devices (
  device_id   TEXT PRIMARY KEY,
  username    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id                  TEXT PRIMARY KEY,
  starting_word       TEXT NOT NULL,
  participant_count   INTEGER NOT NULL,
  creator_device_id   TEXT NOT NULL REFERENCES devices(device_id),
  status              TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT
);

CREATE TABLE IF NOT EXISTS turns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id       TEXT NOT NULL REFERENCES games(id),
  turn_index    INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('word','drawing')),
  token         TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','submitted')),
  device_id     TEXT REFERENCES devices(device_id),
  content       TEXT,
  claimed_at    TEXT,
  submitted_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (game_id, turn_index)
);

CREATE INDEX IF NOT EXISTS idx_turns_token ON turns(token);
CREATE INDEX IF NOT EXISTS idx_turns_game  ON turns(game_id, turn_index);
