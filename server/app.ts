import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cookieParser from 'cookie-parser';
import { createCorsMiddleware } from './middleware/corsMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import { publicLeadsRouter } from './routes/publicLeadsApi.js';
import { authRouter } from './routes/authRoutes.js';
import { adminLeadsRouter } from './routes/adminLeadsRoutes.js';
import { commentsRouter } from './routes/commentsRoutes.js';
import { jobsRouter } from './routes/jobsRoutes.js';
import { settingsRouter } from './routes/settingsRoutes.js';
import { exportRouter } from './routes/exportRoutes.js';
import { backupRouter } from './routes/backupRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { requireAuth } from './middleware/authMiddleware.js';

export function createApp() {
  const app = express();

  // Security & Body Parsers
  app.use(createCorsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: true, limit: '200kb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'mini-crm',
      time: new Date().toISOString()
    });
  });

  // Public API endpoints
  app.use('/api/v1', publicLeadsRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', jobsRouter); // contains /jobs/process-queue

  // Protected Admin API endpoints
  app.use('/api/v1/admin', requireAuth, adminLeadsRouter);
  app.use('/api/v1/admin', requireAuth, commentsRouter);
  app.use('/api/v1/admin', requireAuth, settingsRouter);
  app.use('/api/v1/admin', requireAuth, exportRouter);
  app.use('/api/v1/admin', requireAuth, backupRouter);
  app.use('/api/v1/admin', requireAuth, auditRouter);

  // Serve Frontend Static files if dist exists
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
