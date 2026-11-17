import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { autoIndex: !env.isProd });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');

  // Replace the legacy sparse dedupe index (and clear stored nulls) on existing databases.
  const { default: Notification } = await import('../models/Notification.js');
  await Notification.collection.updateMany({ dedupeKey: null }, { $unset: { dedupeKey: '' } }).catch(() => {});
  await Notification.syncIndexes().catch((err) => logger.warn({ err }, 'notification index sync failed'));

  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
}

/** Returns true if the connected server supports multi-document transactions. */
export function supportsTransactions() {
  const topology = mongoose.connection?.client?.topology;
  return Boolean(topology && topology.description && topology.description.type !== 'Single');
}

/**
 * Runs `fn(session)` inside a transaction when the deployment supports it,
 * otherwise runs it without a session (standalone mongod in development).
 */
export async function withTransaction(fn) {
  if (!supportsTransactions()) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    session.endSession();
  }
}
