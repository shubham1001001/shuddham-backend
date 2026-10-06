import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config/index.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from 'uploads'
app.use('/uploads', express.static(uploadDir));

// Security and utility middlewares
app.use(helmet({ crossOriginResourcePolicy: false })); // Allow cross-origin static file serving
app.use(cors({
  origin: '*', // For development flexibility between React and Flutter
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'Shuddham Water Solutions API',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'online'
  });
});

// Mount all API endpoints
app.use('/api', apiRoutes);

// Catch-all handlers
app.use(notFoundHandler);
app.use(errorHandler);

import { initDatabase } from './config/db.js';
import { initMqttService } from './services/mqttService.js';

const PORT = config.port;
app.listen(PORT, async () => {
  console.log(`[Shuddham API] Server running in ${config.nodeEnv} mode on http://localhost:${PORT}`);
  console.log(`[Shuddham API] Health check at http://localhost:${PORT}/api/health`);
  // Initialize MySQL Connection & Schema
  await initDatabase();
  // Initialize AWS IoT Core MQTT Subscriber
  initMqttService();
});
