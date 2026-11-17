import CalendarEvent from '../models/CalendarEvent.js';
import Task from '../models/Task.js';
import Meeting from '../models/Meeting.js';
import Committee from '../models/Committee.js';
import Project from '../models/Project.js';
import ProjectMilestone from '../models/ProjectMilestone.js';
import AcademicSession from '../models/AcademicSession.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { ensureSameDept, sameId, targetDept } from '../utils/access.js';
import { buildTaskFilter } from './tasks.controller.js';
import { updateTask } from '../services/task.service.js';
import { emitToDepartment } from '../sockets/index.js';

const PRIORITY_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#2563eb', low: '#64748b' };
const TYPE_COLORS = { exam: '#9333ea', event: '#0891b2', seminar: '#059669', workshop: '#16a34a', academic: '#ca8a04', holiday: '#e11d48', other: '#475569', meeting: '#7c3aed', milestone: '#d97706', session: '#0d9488' };

async function collectEvents(req, from, to, types) {
  const want = (t) => !types.length || types.includes(t);
  const dept = req.isSuperAdmin ? {} : { department: req.departmentId };
  const events = [];

  if (want('task')) {
    const filter = buildTaskFilter(req, { scope: req.query.scope });
    delete filter.parentTask;
    filter.deadline = { $gte: from, $lte: to };
    filter.status = { $nin: ['cancelled', 'draft'] };
    const tasks = await Task.find(filter).select('taskId title deadline startDate status priority').limit(1000).lean();
    for (const t of tasks) {
      events.push({
        id: `task:${t._id}`, type: 'task', entityId: t._id, title: `${t.taskId} · ${t.title}`, start: t.deadline, end: t.deadline, allDay: false,
        color: t.status === 'completed' ? '#16a34a' : PRIORITY_COLORS[t.priority], editable: true,
        extendedProps: { status: t.status, priority: t.priority, link: `/tasks/${t._id}` },
      });
    }
  }

  if (want('meeting')) {
    const filter = { ...dept, startAt: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } };
    if (!req.isSuperAdmin && !hasPermission(req, 'task:read_all')) {
      const mine = await Committee.find({ 'members.user': req.user._id }).distinct('_id');
      filter.$or = [{ organizer: req.user._id }, { 'participants.user': req.user._id }, { committee: { $in: mine } }];
    }
    const meetings = await Meeting.find(filter).select('title startAt endAt location organizer').lean();
    for (const m of meetings) {
      events.push({ id: `meeting:${m._id}`, type: 'meeting', entityId: m._id, title: m.title, start: m.startAt, end: m.endAt, color: TYPE_COLORS.meeting, editable: sameId(m.organizer, req.user._id) || hasPermission(req, 'meeting:update'), extendedProps: { location: m.location, link: `/meetings/${m._id}` } });
    }
  }

  if (want('milestone')) {
    const projects = await Project.find(dept).select('_id title').lean();
    const titles = new Map(projects.map((p) => [String(p._id), p.title]));
    const ms = await ProjectMilestone.find({ project: { $in: projects.map((p) => p._id) }, dueDate: { $gte: from, $lte: to } }).lean();
    for (const m of ms) {
      events.push({ id: `milestone:${m._id}`, type: 'milestone', entityId: m._id, title: `◆ ${m.title} (${titles.get(String(m.project))})`, start: m.dueDate, allDay: true, color: TYPE_COLORS.milestone, editable: false, extendedProps: { status: m.status, link: `/projects/${m.project}` } });
    }
  }

  const evTypes = ['exam', 'event', 'seminar', 'workshop', 'academic', 'holiday', 'other'].filter(want);
  if (evTypes.length) {
    const evs = await CalendarEvent.find({ ...dept, type: { $in: evTypes }, startAt: { $lte: to }, endAt: { $gte: from } }).lean();
    for (const e of evs) {
      events.push({ id: `event:${e._id}`, type: e.type, entityId: e._id, title: e.title, start: e.startAt, end: e.endAt, allDay: e.allDay, color: e.color || TYPE_COLORS[e.type], editable: hasPermission(req, 'meeting:create') || sameId(e.createdBy, req.user._id), extendedProps: { description: e.description, location: e.location } });
    }
  }

  if (want('session')) {
    const sessions = await AcademicSession.find({ department: { $in: [req.departmentId, null] }, $or: [{ startDate: { $gte: from, $lte: to } }, { endDate: { $gte: from, $lte: to } }] }).lean();
    for (const s of sessions) {
      events.push({ id: `session-start:${s._id}`, type: 'session', title: `${s.name} begins`, start: s.startDate, allDay: true, color: TYPE_COLORS.session, editable: false });
      events.push({ id: `session-end:${s._id}`, type: 'session', title: `${s.name} ends`, start: s.endDate, allDay: true, color: TYPE_COLORS.session, editable: false });
    }
  }
  return events;
}

function range(q) {
  const from = q.from ? new Date(q.from) : new Date(Date.now() - 31 * 86400000);
  const to = q.to ? new Date(q.to) : new Date(Date.now() + 62 * 86400000);
  if (Number.isNaN(+from) || Number.isNaN(+to) || to < from) throw ApiError.badRequest('Invalid date range');
  if (to - from > 400 * 86400000) throw ApiError.badRequest('Range too large (max ~13 months)');
  return { from, to };
}

const typesOf = (q) => (q.types ? String(q.types).split(',').filter(Boolean) : []);

export const events = asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);
  ok(res, await collectEvents(req, from, to, typesOf(req.query)));
});

export const createEvent = asyncHandler(async (req, res) => {
  const department = targetDept(req, req.body.department);
  if (req.body.endAt < req.body.startAt) throw ApiError.badRequest('End must be after start');
  const e = await CalendarEvent.create({ ...req.body, department, createdBy: req.user._id });
  emitToDepartment(department, 'calendar:changed', {});
  created(res, e);
});

export const updateEvent = asyncHandler(async (req, res) => {
  const e = ensureSameDept(req, await CalendarEvent.findById(req.params.id), 'Event');
  if (!sameId(e.createdBy, req.user._id) && !hasPermission(req, 'meeting:update')) throw ApiError.forbidden();
  Object.assign(e, req.body);
  if (e.endAt < e.startAt) throw ApiError.badRequest('End must be after start');
  await e.save();
  emitToDepartment(e.department, 'calendar:changed', {});
  ok(res, e);
});

export const deleteEvent = asyncHandler(async (req, res) => {
  const e = ensureSameDept(req, await CalendarEvent.findById(req.params.id), 'Event');
  if (!sameId(e.createdBy, req.user._id) && !hasPermission(req, 'meeting:delete')) throw ApiError.forbidden();
  await e.softDelete(req.user._id);
  emitToDepartment(e.department, 'calendar:changed', {});
  ok(res, { deleted: true });
});

/** Drag-and-drop reschedule for tasks (deadline), meetings and custom events. */
export const reschedule = asyncHandler(async (req, res) => {
  const { type, id, start, end } = req.body;
  if (type === 'task') return ok(res, await updateTask(req, id, { deadline: start }));
  if (type === 'meeting') {
    const m = ensureSameDept(req, await Meeting.findById(id), 'Meeting');
    if (!sameId(m.organizer, req.user._id) && !hasPermission(req, 'meeting:update')) throw ApiError.forbidden();
    const dur = m.endAt - m.startAt;
    m.startAt = start;
    m.endAt = end || new Date(+start + dur);
    await m.save();
    emitToDepartment(m.department, 'meeting:changed', { id: String(m._id) });
    return ok(res, m);
  }
  const e = ensureSameDept(req, await CalendarEvent.findById(id), 'Event');
  if (!sameId(e.createdBy, req.user._id) && !hasPermission(req, 'meeting:update')) throw ApiError.forbidden();
  const dur = e.endAt - e.startAt;
  e.startAt = start;
  e.endAt = end || new Date(+start + dur);
  await e.save();
  emitToDepartment(e.department, 'calendar:changed', {});
  ok(res, e);
});

const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export const ics = asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);
  const list = await collectEvents(req, from, to, typesOf(req.query));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DWMT//Departmental Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:DWMT Calendar'];
  for (const e of list) {
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end) : new Date(+start + (e.allDay ? 86400000 : 3600000));
    lines.push('BEGIN:VEVENT', `UID:${e.id}@dwmt`, `DTSTAMP:${icsDate(new Date())}`);
    if (e.allDay) {
      const day = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${day(start)}`, `DTEND;VALUE=DATE:${day(new Date(+start + 86400000))}`);
    } else {
      lines.push(`DTSTART:${icsDate(start)}`, `DTEND:${icsDate(+end === +start ? new Date(+start + 1800000) : end)}`);
    }
    lines.push(`SUMMARY:${icsText(e.title)}`, `CATEGORIES:${e.type.toUpperCase()}`);
    if (e.extendedProps?.location) lines.push(`LOCATION:${icsText(e.extendedProps.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="dwmt-calendar.ics"');
  res.send(lines.join('\r\n'));
});
