import Committee from '../models/Committee.js';
import Task from '../models/Task.js';
import Meeting from '../models/Meeting.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate, escapeRegex } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { ensureSameDept, sameId, targetDept } from '../utils/access.js';
import { computeProgress } from './projects.controller.js';
import { notify } from '../services/notification.service.js';
import { emitToDepartment } from '../sockets/index.js';

const POP = [
  { path: 'coordinator', select: 'name email avatar designation' },
  { path: 'members.user', select: 'name email avatar designation' },
];

export const isCoordinator = (committee, userId) =>
  sameId(committee.coordinator, userId) || (committee.members || []).some((m) => sameId(m.user, userId) && m.role === 'coordinator');

const canManage = (req, c) => hasPermission(req, 'committee:update') && (hasPermission(req, 'task:read_all') || isCoordinator(c, req.user._id) || req.isSuperAdmin);

function normalizeMembers(members = [], coordinator) {
  const map = new Map();
  for (const m of members) map.set(String(m.user), { user: m.user, role: m.role || 'member' });
  if (coordinator) map.set(String(coordinator), { user: coordinator, role: 'coordinator' });
  return [...map.values()];
}

async function assertUsers(ids, department) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return;
  const n = await User.countDocuments({ _id: { $in: unique }, department, isActive: true });
  if (n !== unique.length) throw ApiError.badRequest('All members must be active users of this department');
}

export const list = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = { ...(req.isSuperAdmin ? {} : { department: req.departmentId }) };
  if (q.mine === 'true') filter.$or = [{ coordinator: req.user._id }, { 'members.user': req.user._id }];
  if (q.active !== 'all') filter.isActive = true;
  if (q.q) filter.name = new RegExp(escapeRegex(q.q), 'i');
  const pg = parsePagination(q, { defaultSort: 'name' });
  const { items, meta } = await paginate(Committee, filter, pg, POP);
  const enriched = await Promise.all(items.map(async (c) => ({ ...c, stats: await computeProgress({ committee: c._id }) })));
  ok(res, enriched, meta);
});

export const getOne = asyncHandler(async (req, res) => {
  const c = ensureSameDept(req, await Committee.findById(req.params.id).populate(POP).lean(), 'Committee');
  const [stats, meetings, documents, recentTasks] = await Promise.all([
    computeProgress({ committee: c._id }),
    Meeting.find({ committee: c._id }).sort('-startAt').limit(10).select('title startAt endAt status location').lean(),
    Document.find({ committee: c._id }).sort('-createdAt').limit(20).select('title category currentVersion createdAt uploadedBy').populate('uploadedBy', 'name').lean(),
    Task.find({ committee: c._id, isTemplate: false }).sort('-createdAt').limit(20).select('taskId title status priority deadline progress assignees').populate('assignees.user', 'name avatar').lean(),
  ]);
  ok(res, { ...c, stats, meetings, documents, recentTasks, canManage: canManage(req, c) });
});

export const create = asyncHandler(async (req, res) => {
  const department = targetDept(req, req.body.department);
  const members = normalizeMembers(req.body.members, req.body.coordinator);
  await assertUsers(members.map((m) => m.user), department);
  const c = await Committee.create({ ...req.body, members, department, createdBy: req.user._id });
  audit(req, { action: 'committee.create', entityType: 'Committee', entityId: c._id, after: { name: c.name } });
  await notify({ recipients: members.map((m) => m.user), actor: req.user._id, type: 'announcement', title: `Added to ${c.name}`, message: `You have been added to the ${c.name}.`, entityType: 'committee', entityId: c._id, link: `/committees/${c._id}`, email: false });
  emitToDepartment(department, 'committee:changed', { id: String(c._id) });
  created(res, await c.populate(POP));
});

export const update = asyncHandler(async (req, res) => {
  const c = ensureSameDept(req, await Committee.findById(req.params.id), 'Committee');
  if (!canManage(req, c)) throw ApiError.forbidden('Only the committee coordinator or authorized staff can edit this committee');
  const body = { ...req.body };
  if (body.members || body.coordinator) {
    if (!hasPermission(req, 'committee:assign_members')) throw ApiError.forbidden('You cannot change committee membership');
    const prev = new Set(c.members.map((m) => String(m.user)));
    body.members = normalizeMembers(body.members ?? c.members, body.coordinator ?? c.coordinator);
    await assertUsers(body.members.map((m) => m.user), c.department);
    const added = body.members.filter((m) => !prev.has(String(m.user))).map((m) => m.user);
    if (added.length) await notify({ recipients: added, actor: req.user._id, type: 'announcement', title: `Added to ${c.name}`, message: `You have been added to the ${c.name}.`, entityType: 'committee', entityId: c._id, link: `/committees/${c._id}`, email: false });
  }
  Object.assign(c, body);
  await c.save();
  audit(req, { action: 'committee.update', entityType: 'Committee', entityId: c._id, after: req.body });
  emitToDepartment(c.department, 'committee:changed', { id: String(c._id) });
  ok(res, await c.populate(POP));
});

export const remove = asyncHandler(async (req, res) => {
  const c = ensureSameDept(req, await Committee.findById(req.params.id), 'Committee');
  await c.softDelete(req.user._id);
  audit(req, { action: 'committee.delete', entityType: 'Committee', entityId: c._id });
  emitToDepartment(c.department, 'committee:changed', { id: String(c._id) });
  ok(res, { deleted: true });
});
