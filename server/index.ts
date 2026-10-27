import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { initDatabase } from './db/connection.js';
import { queueService } from './services/queueService.js';

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  try {
    console.log('[Server] Initializing database...');
    await initDatabase();

    const app = createApp();

    // Start background notification queue worker
    queueService.startWorker(15000);

    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 МИНИ-CRM УСПЕШНО ЗАПУЩЕНА`);
      console.log(`📡 URL сервера: http://localhost:${PORT}`);
      console.log(`🔗 Публичный API лидов: POST http://localhost:${PORT}/api/v1/leads`);
      console.log(`⚙️ Окружение: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);
    });

    const shutdown = () => {
      console.log('[Server] Gracefully shutting down...');
      queueService.stopWorker();
      server.close(() => {
        console.log('[Server] Closed all connections.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
