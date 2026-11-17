import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import api, { modules } from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { authenticate } from './middleware/auth.js';
import { isPrivatePath } from './services/storage.service.js';
import { buildOpenApi } from './utils/openapi.js';
import { ApiError } from './utils/ApiError.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, contentSecurityPolicy: env.isProd ? undefined : false }));
  app.use(cors({ origin: env.clientUrl.split(',').map((s) => s.trim()), credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(hpp({ whitelist: ['status', 'priority', 'category', 'tags', 'types'] }));
  app.use(morgan(env.isProd ? 'combined' : 'dev', { stream: { write: (m) => logger.info(m.trim()) }, skip: (req) => req.url === '/api/v1/system/health' }));

  // CSRF: state-changing cookie-authenticated endpoints (refresh/logout) require a same-origin custom header.
  app.use('/api/v1/auth', (req, _res, next) => {
    if (['/refresh', '/logout'].includes(req.path) && req.method === 'POST' && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return next(ApiError.forbidden('Missing CSRF header'));
    }
    next();
  });

  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

  // Uploaded attachments/avatars require a valid access token (header or ?token=). Private document storage is never served statically.
  app.use(
    '/uploads',
    (req, _res, next) => {
      if (isPrivatePath(req.path)) return next(ApiError.notFound());
      if (!req.headers.authorization && typeof req.query.token === 'string') req.headers.authorization = `Bearer ${req.query.token}`;
      next();
    },
    authenticate,
    express.static(env.uploadDir, { fallthrough: false, maxAge: '1h' })
  );

  const spec = buildOpenApi(modules);
  app.get('/api/v1/openapi.json', (_req, res) => res.json(spec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'DWMT API Docs' }));

  app.use('/api/v1', api);

  // Serve the built client in production (single-origin deployment).
  const clientDist = [
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ].find((p) => fs.existsSync(p));
  if (env.isProd && clientDist) {
    app.use(express.static(clientDist, { maxAge: '7d', index: false }));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
