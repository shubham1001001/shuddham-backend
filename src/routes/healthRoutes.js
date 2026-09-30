import express from 'express';
import { getDbStatus } from '../config/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'shuddham-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    db: getDbStatus()
  });
});

export default router;
