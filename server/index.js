const path = require('path');
const express = require('express');
const db = require('./db');
const { reconcileOnBoot } = require('./lib/turnFlow');
const deviceAuth = require('./middleware/deviceAuth');
const devicesRouter = require('./routes/devices');
const gamesRouter = require('./routes/games');
const turnsRouter = require('./routes/turns');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '3mb' }));

app.use('/api/devices', deviceAuth, devicesRouter);
app.use('/api/games', deviceAuth, gamesRouter);
app.use('/api/turns', deviceAuth, turnsRouter);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('/turn/:token', (req, res) => {
  res.sendFile(path.join(publicDir, 'turn.html'));
});
app.get('/result/:gameId', (req, res) => {
  res.sendFile(path.join(publicDir, 'result.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

reconcileOnBoot();

app.listen(PORT, () => {
  console.log(`텔레스트레이션 서버 실행 중: http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
