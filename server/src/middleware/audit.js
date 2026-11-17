import AuditLog from '../models/AuditLog.js';
import { logger } from '../config/logger.js';

/** Fire-and-forget audit record. Never throws. */
export function audit(req, { action, entityType, entityId, before, after, meta }) {
  AuditLog.create({
    actor: req.user?._id,
    department: req.user?.department,
    action,
    entityType,
    entityId,
    before,
    after,
    meta,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch((err) => logger.warn({ err }, 'audit write failed'));
}
