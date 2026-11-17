import Notification from '../models/Notification.js';
import UserPreference from '../models/UserPreference.js';
import User from '../models/User.js';
import { emitToUser } from '../sockets/index.js';
import { sendEmail } from './email.service.js';
import { logger } from '../config/logger.js';

/**
 * Creates notifications for many recipients, emits them over Socket.IO and
 * emails them if the recipient's preferences allow. De-duplicates via dedupeKey.
 */
export async function notify({ recipients, actor, type, title, message, entityType, entityId, link, dedupeKeyBase, email = true }) {
  const ids = [...new Set((recipients || []).filter(Boolean).map(String))].filter((id) => !actor || id !== String(actor));
  if (!ids.length) return [];

  const prefs = await UserPreference.find({ user: { $in: ids } }).lean();
  const prefMap = new Map(prefs.map((p) => [String(p.user), p]));

  const results = [];
  for (const recipient of ids) {
    const pref = prefMap.get(recipient);
    if (pref?.notifications?.mutedTypes?.includes(type)) continue;
    if (pref && pref.notifications?.inApp === false && type !== 'task_assigned') continue;

    const doc = {
      recipient,
      actor: actor || undefined,
      type,
      title,
      message,
      entityType,
      entityId,
      link,
      ...(dedupeKeyBase ? { dedupeKey: `${dedupeKeyBase}:${recipient}` } : {}),
    };

    let saved;
    try {
      saved = await Notification.create(doc);
    } catch (err) {
      if (err.code === 11000) continue; // duplicate reminder; skip silently
      logger.warn({ err }, 'notification create failed');
      continue;
    }
    results.push(saved);
    emitToUser(recipient, 'notification:new', saved.toJSON());

    if (email && (pref ? pref.notifications?.email !== false : true)) {
      const user = await User.findById(recipient).select('email name').lean();
      if (user?.email) {
        sendEmail({ to: user.email, subject: title, title, body: message || '', actionPath: link, actionLabel: 'View in DWMT' })
          .then((r) => r?.sent && Notification.updateOne({ _id: saved._id }, { emailedAt: new Date() }))
          .catch(() => {});
      }
    }
  }
  return results;
}

export async function unreadCount(userId) {
  return Notification.countDocuments({ recipient: userId, readAt: null });
}
