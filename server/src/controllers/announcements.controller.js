import Announcement from '../models/Announcement.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate, escapeRegex } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { sameId } from '../utils/access.js';
import { notify } from '../services/notification.service.js';
import { emitToDepartment, getIO } from '../sockets/index.js';

const POP = [{ path: 'author', select: 'name avatar designation' }];
const canManageAll = (req) => hasPermission(req, 'announcement:manage');

function ensureAccess(req, a) {
  if (!a) throw ApiError.notFound('Announcement not found');
  if (req.isSuperAdmin) return a;
  if (a.department && String(a.department) !== req.departmentId) throw ApiError.forbidden();
  return a;
}

export const list = asyncHandler(async (req, res) => {
  const q = req.query;
  const now = new Date();
  const filter = req.isSuperAdmin ? {} : { department: { $in: [req.departmentId, null] } };
  const showAll = q.all === 'true' && canManageAll(req);
  if (!showAll) {
    filter.publishAt = { $lte: now };
    filter.$and = [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      ...(req.isSuperAdmin ? [] : [{ $or: [{ audienceRoles: { $size: 0 } }, { audienceRoles: { $in: req.roleKeys } }] }]),
    ];
  }
  if (q.pinned === 'true') filter.isPinned = true;
  if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
  const pg = parsePagination(q, { defaultSort: '-isPinned,-publishAt' });
  const { items, meta } = await paginate(Announcement, filter, pg, POP);
  ok(res, items.map((a) => ({ ...a, canEdit: canManageAll(req) || sameId(a.author, req.user._id) })), meta);
});

export const getOne = asyncHandler(async (req, res) => {
  ok(res, ensureAccess(req, await Announcement.findById(req.params.id).populate(POP).lean()));
});

export const create = asyncHandler(async (req, res) => {
  const department = req.isSuperAdmin ? (req.body.department ?? null) : req.departmentId;
  if (req.body.isPinned && !canManageAll(req)) req.body.isPinned = false;
  const a = await Announcement.create({ ...req.body, department, author: req.user._id });
  audit(req, { action: 'announcement.create', entityType: 'Announcement', entityId: a._id, after: { title: a.title } });

  if (!a.publishAt || a.publishAt <= new Date()) {
    const userFilter = { isActive: true, ...(department ? { department } : {}) };
    if (a.audienceRoles?.length) userFilter.roles = { $in: await Role.find({ key: { $in: a.audienceRoles } }).distinct('_id') };
    const recipients = await User.find(userFilter).distinct('_id');
    await notify({
      recipients,
      actor: req.user._id,
      type: 'announcement',
      title: `${a.priority === 'urgent' ? '[URGENT] ' : ''}${a.title}`,
      message: a.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240),
      entityType: 'announcement',
      entityId: a._id,
      link: '/announcements',
      email: a.priority !== 'normal',
    });
  }
  if (department) emitToDepartment(department, 'announcement:changed', { id: String(a._id) });
  else getIO()?.emit('announcement:changed', { id: String(a._id) });
  created(res, await a.populate(POP));
});

export const update = asyncHandler(async (req, res) => {
  const a = ensureAccess(req, await Announcement.findById(req.params.id));
  if (!canManageAll(req) && !sameId(a.author, req.user._id)) throw ApiError.forbidden();
  if ('isPinned' in req.body && !canManageAll(req)) delete req.body.isPinned;
  Object.assign(a, req.body);
  await a.save();
  if (a.department) emitToDepartment(a.department, 'announcement:changed', { id: String(a._id) });
  ok(res, await a.populate(POP));
});

export const remove = asyncHandler(async (req, res) => {
  const a = ensureAccess(req, await Announcement.findById(req.params.id));
  if (!canManageAll(req) && !sameId(a.author, req.user._id)) throw ApiError.forbidden();
  await a.softDelete(req.user._id);
  audit(req, { action: 'announcement.delete', entityType: 'Announcement', entityId: a._id });
  if (a.department) emitToDepartment(a.department, 'announcement:changed', { id: String(a._id) });
  ok(res, { deleted: true });
});
