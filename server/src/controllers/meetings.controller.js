import Meeting from '../models/Meeting.js';
import MeetingMinutes from '../models/MeetingMinutes.js';
import MeetingDecision from '../models/MeetingDecision.js';
import Committee from '../models/Committee.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate, escapeRegex } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { ensureSameDept, sameId, targetDept } from '../utils/access.js';
import { notify } from '../services/notification.service.js';
import { createTask } from '../services/task.service.js';
import { emitToDepartment } from '../sockets/index.js';

const POP = [
  { path: 'organizer', select: 'name email avatar' },
  { path: 'participants.user', select: 'name email avatar designation' },
  { path: 'committee', select: 'name' },
  { path: 'project', select: 'title' },
  { path: 'agenda.presenter', select: 'name' },
];

const isInvolved = (m, userId) => sameId(m.organizer, userId) || (m.participants || []).some((p) => sameId(p.user, userId));
const canSeeAll = (req) => req.isSuperAdmin || hasPermission(req, 'task:read_all');
const canManage = (req, m) => req.isSuperAdmin || sameId(m.organizer, req.user._id) || (hasPermission(req, 'meeting:update') && hasPermission(req, 'task:read_all'));

async function loadMeeting(req, { populate = true } = {}) {
  let q = Meeting.findById(req.params.id);
  if (populate) q = q.populate(POP);
  const m = ensureSameDept(req, await q, 'Meeting');
  if (!canSeeAll(req) && !isInvolved(m, req.user._id)) {
    // committee members can view their committee's meetings
    const member = m.committee && (await Committee.exists({ _id: m.committee._id || m.committee, 'members.user': req.user._id }));
    if (!member) throw ApiError.forbidden('You are not a participant in this meeting');
  }
  return m;
}

async function assertUsers(ids, department) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return;
  const n = await User.countDocuments({ _id: { $in: unique }, department, isActive: true });
  if (n !== unique.length) throw ApiError.badRequest('All participants must be active users of this department');
}

export const list = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = { ...(req.isSuperAdmin ? {} : { department: req.departmentId }) };
  if (!canSeeAll(req) || q.mine === 'true') {
    const myCommittees = await Committee.find({ 'members.user': req.user._id }).distinct('_id');
    filter.$or = [{ organizer: req.user._id }, { 'participants.user': req.user._id }, { committee: { $in: myCommittees } }];
  }
  if (q.committee) filter.committee = q.committee;
  if (q.status) filter.status = { $in: String(q.status).split(',') };
  if (q.from || q.to) filter.startAt = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(q.to) } : {}) };
  if (q.upcoming === 'true') filter.startAt = { $gte: new Date() };
  if (q.q) filter.title = new RegExp(escapeRegex(q.q), 'i');
  const pg = parsePagination(q, { defaultSort: q.upcoming === 'true' ? 'startAt' : '-startAt' });
  const { items, meta } = await paginate(Meeting, filter, pg, POP.slice(0, 4));
  ok(res, items, meta);
});

export const getOne = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req);
  const [minutes, decisions] = await Promise.all([
    MeetingMinutes.findOne({ meeting: m._id }).populate('recordedBy', 'name').populate('document', 'title versions currentVersion').lean(),
    MeetingDecision.find({ meeting: m._id }).sort('createdAt').populate('responsible', 'name avatar').populate('task', 'taskId title status progress').lean(),
  ]);
  ok(res, { ...m.toJSON(), minutes, decisions, canManage: canManage(req, m) });
});

export const create = asyncHandler(async (req, res) => {
  const department = targetDept(req, req.body.department);
  if (req.body.endAt <= req.body.startAt) throw ApiError.badRequest('End time must be after start time');
  const participants = [...new Map((req.body.participants || []).map((u) => [String(u), { user: u }])).values()];
  await assertUsers(participants.map((p) => p.user), department);
  const m = await Meeting.create({ ...req.body, participants, department, organizer: req.user._id, createdBy: req.user._id });
  audit(req, { action: 'meeting.create', entityType: 'Meeting', entityId: m._id, after: { title: m.title } });
  await notify({
    recipients: participants.map((p) => p.user),
    actor: req.user._id,
    type: 'meeting_invited',
    title: `Meeting invitation: ${m.title}`,
    message: `${req.user.name} invited you to "${m.title}" on ${m.startAt.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}${m.location ? ` at ${m.location}` : ''}.`,
    entityType: 'meeting',
    entityId: m._id,
    link: `/meetings/${m._id}`,
  });
  emitToDepartment(department, 'meeting:changed', { id: String(m._id) });
  created(res, await m.populate(POP));
});

export const update = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  if (!canManage(req, m)) throw ApiError.forbidden('Only the organizer can edit this meeting');
  const body = { ...req.body };
  if (body.participants) {
    const prev = new Map(m.participants.map((p) => [String(p.user), p]));
    body.participants = [...new Set(body.participants.map(String))].map((u) => prev.get(u) || { user: u });
    await assertUsers(body.participants.map((p) => p.user), m.department);
    const added = body.participants.filter((p) => !prev.has(String(p.user))).map((p) => p.user);
    if (added.length) await notify({ recipients: added, actor: req.user._id, type: 'meeting_invited', title: `Meeting invitation: ${m.title}`, message: `${req.user.name} invited you to "${m.title}".`, entityType: 'meeting', entityId: m._id, link: `/meetings/${m._id}` });
  }
  const rescheduled = (body.startAt && +body.startAt !== +m.startAt) || (body.endAt && +body.endAt !== +m.endAt);
  Object.assign(m, body);
  if (m.endAt <= m.startAt) throw ApiError.badRequest('End time must be after start time');
  await m.save();
  if (rescheduled || body.status === 'cancelled') {
    await notify({ recipients: m.participants.map((p) => p.user), actor: req.user._id, type: 'meeting_invited', title: body.status === 'cancelled' ? `Meeting cancelled: ${m.title}` : `Meeting rescheduled: ${m.title}`, message: body.status === 'cancelled' ? `"${m.title}" has been cancelled.` : `"${m.title}" now starts ${m.startAt.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}.`, entityType: 'meeting', entityId: m._id, link: `/meetings/${m._id}` });
  }
  audit(req, { action: 'meeting.update', entityType: 'Meeting', entityId: m._id, after: req.body });
  emitToDepartment(m.department, 'meeting:changed', { id: String(m._id) });
  ok(res, await m.populate(POP));
});

export const remove = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  if (!canManage(req, m) && !hasPermission(req, 'meeting:delete')) throw ApiError.forbidden();
  await m.softDelete(req.user._id);
  audit(req, { action: 'meeting.delete', entityType: 'Meeting', entityId: m._id });
  emitToDepartment(m.department, 'meeting:changed', { id: String(m._id) });
  ok(res, { deleted: true });
});

/** RSVP for self, or bulk attendance marking by the organizer. */
export const attendance = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  const { entries = [], rsvp } = req.body;
  if (rsvp) {
    const p = m.participants.find((x) => sameId(x.user, req.user._id));
    if (!p) throw ApiError.forbidden('You are not invited to this meeting');
    p.attendance = rsvp;
  } else {
    if (!canManage(req, m)) throw ApiError.forbidden('Only the organizer can record attendance');
    for (const e of entries) {
      const p = m.participants.find((x) => sameId(x.user, e.user));
      if (p) p.attendance = e.attendance;
    }
  }
  await m.save();
  ok(res, await m.populate(POP));
});

export const saveMinutes = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  if (!canManage(req, m)) throw ApiError.forbidden('Only the organizer can record minutes');
  const attendees = m.participants.filter((p) => p.attendance === 'present').map((p) => p.user);
  const absentees = m.participants.filter((p) => p.attendance === 'absent').map((p) => p.user);
  const minutes = await MeetingMinutes.findOneAndUpdate(
    { meeting: m._id },
    { $set: { body: req.body.body ?? '', document: req.body.document ?? null, attendees, absentees, recordedBy: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );
  m.minutes = minutes._id;
  if (m.status === 'scheduled' && m.startAt < new Date()) m.status = 'completed';
  await m.save();
  audit(req, { action: 'meeting.minutes', entityType: 'Meeting', entityId: m._id });
  ok(res, minutes);
});

// ---------- decisions ----------
export const addDecision = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  if (!canManage(req, m)) throw ApiError.forbidden('Only the organizer can record decisions');
  await assertUsers(req.body.responsible || [], m.department);
  created(res, await MeetingDecision.create({ ...req.body, meeting: m._id, createdBy: req.user._id }));
});

export const updateDecision = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  const d = await MeetingDecision.findOne({ _id: req.params.decisionId, meeting: m._id });
  if (!d) throw ApiError.notFound('Decision not found');
  const responsible = d.responsible.some((u) => sameId(u, req.user._id));
  if (!canManage(req, m) && !(responsible && Object.keys(req.body).every((k) => k === 'status'))) throw ApiError.forbidden();
  if (req.body.responsible) await assertUsers(req.body.responsible, m.department);
  Object.assign(d, req.body);
  await d.save();
  ok(res, d);
});

export const deleteDecision = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  if (!canManage(req, m)) throw ApiError.forbidden();
  await MeetingDecision.deleteOne({ _id: req.params.decisionId, meeting: m._id });
  ok(res, { deleted: true });
});

/** Converts a decision into a tracked task. Requires the caller to be able to assign tasks. */
export const convertDecision = asyncHandler(async (req, res) => {
  const m = await loadMeeting(req, { populate: false });
  if (!canManage(req, m)) throw ApiError.forbidden();
  const d = await MeetingDecision.findOne({ _id: req.params.decisionId, meeting: m._id });
  if (!d) throw ApiError.notFound('Decision not found');
  if (d.task && (await Task.exists({ _id: d.task }))) throw ApiError.conflict('This decision already has a task');
  if (!d.responsible.length) throw ApiError.badRequest('Assign at least one responsible person before converting');
  const task = await createTask(req, {
    title: d.title,
    description: `<p>${(d.details || '').replace(/</g, '&lt;')}</p><p><em>From meeting: ${m.title} (${m.startAt.toDateString()})</em></p>`,
    assignees: d.responsible.map((u, i) => ({ user: u, isPrimary: i === 0 })),
    deadline: req.body.deadline || d.deadline || null,
    priority: req.body.priority || 'medium',
    category: req.body.category || null,
    committee: m.committee || null,
    project: m.project || null,
    tags: ['meeting-decision'],
  });
  d.task = task._id;
  d.status = 'in_progress';
  await d.save();
  created(res, { decision: d, task });
});
