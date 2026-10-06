const db = require('../db');

const upsertDevice = db.prepare(
  'INSERT OR IGNORE INTO devices (device_id) VALUES (?)'
);
const getDevice = db.prepare('SELECT * FROM devices WHERE device_id = ?');

module.exports = function deviceAuth(req, res, next) {
  const deviceId = req.header('X-Device-Id');
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
    return res.status(400).json({ error: 'missing_device_id' });
  }
  upsertDevice.run(deviceId);
  req.deviceId = deviceId;
  req.device = getDevice.get(deviceId);
  next();
};
