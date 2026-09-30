import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'shuddham-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
