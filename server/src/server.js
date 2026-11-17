import http from 'http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { startJobs } from './jobs/index.js';

async function main() {
  await connectDB();
  const app = createApp();
  const server = http.createServer(app);
  initSockets(server);
  startJobs();
  server.listen(env.port, () => logger.info(`DWMT API listening on http://localhost:${env.port} (docs: /api/docs)`));

  const shutdown = (signal) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
