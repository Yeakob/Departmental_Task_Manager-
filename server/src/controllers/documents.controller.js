import fs from 'fs';
import Document from '../models/Document.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Committee from '../models/Committee.js';
import Meeting from '../models/Meeting.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, created, parsePagination, paginate, escapeRegex } from '../utils/http.js';
import { hasPermission } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { ensureSameDept, sameId, includesId, targetDept } from '../utils/access.js';
import { savePrivate, resolve, remove as removeStored } from '../services/storage.service.js';
import { removeFile } from '../middleware/upload.js';

const POP = [{ path: 'uploadedBy', select: 'name avatar' }, { path: 'task', select: 'taskId title' }, { path: 'project', select: 'title' }, { path: 'committee', select: 'name' }, { path: 'meeting', select: 'title' }];

const seesAll = (req) => req.isSuperAdmin || hasPermission(req, 'task:read_all');

function visibilityClause(req) {
  if (seesAll(req)) return {};
  return { $or: [{ visibility: 'department' }, { uploadedBy: req.user._id }, { allowedUsers: req.user._id }, { allowedRoles: { $in: req.roleKeys } }] };
}

function canAccess(req, doc) {
  if (seesAll(req) || doc.visibility === 'department') return true;
  return sameId(doc.uploadedBy, req.user._id) || includesId(doc.allowedUsers, req.user._id) || (doc.allowedRoles || []).some((r) => req.roleKeys.includes(r));
}

async function validateLinks(body, department) {
  const checks = [
    [body.task, Task, 'Task'],
    [body.project, Project, 'Project'],
    [body.committee, Committee, 'Committee'],
    [body.meeting, Meeting, 'Meeting'],
  ];
  for (const [id, Model, label] of checks) {
    if (id && !(await Model.exists({ _id: id, department }))) throw ApiError.badRequest(`${label} not found in your department`);
  }
}

function parseFields(raw) {
  const out = { ...raw };
  for (const k of ['tags', 'allowedUsers', 'allowedRoles']) {
    if (typeof out[k] === 'string') {
      try { out[k] = JSON.parse(out[k]); } catch { out[k] = out[k].split(',').map((s) => s.trim()).filter(Boolean); }
    }
  }
  for (const k of ['task', 'project', 'committee', 'meeting']) if (out[k] === '' || out[k] === 'null') out[k] = null;
  return out;
}

export const list = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = { ...(req.isSuperAdmin ? {} : { department: req.departmentId }), ...visibilityClause(req) };
  if (q.category) filter.category = { $in: String(q.category).split(',') };
  for (const k of ['task', 'project', 'committee', 'meeting', 'uploadedBy']) if (q[k]) filter[k] = q[k];
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(q.to) } : {}) };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$and = [{ $or: [{ title: rx }, { description: rx }, { tags: rx }] }];
  }
  const pg = parsePagination(q, { defaultSort: '-createdAt' });
  const { items, meta } = await paginate(Document, filter, pg, POP);
  ok(res, items.map((d) => ({ ...d, latest: d.versions?.find((v) => v.version === d.currentVersion) })), meta);
});

export const getOne = asyncHandler(async (req, res) => {
  const doc = ensureSameDept(req, await Document.findById(req.params.id).populate(POP).populate('versions.uploadedBy', 'name').lean(), 'Document');
  if (!canAccess(req, doc)) throw ApiError.forbidden('You do not have access to this document');
  ok(res, { ...doc, latest: doc.versions.find((v) => v.version === doc.currentVersion), canDelete: sameId(doc.uploadedBy, req.user._id) || hasPermission(req, 'document:delete') });
});

export const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A file is required');
  try {
    const body = parseFields(req.body);
    if (!body.title?.trim()) body.title = req.file.originalname;
    const department = targetDept(req, body.department);
    await validateLinks(body, department);
    const key = savePrivate(req.file);
    const doc = await Document.create({
      title: body.title.trim().slice(0, 200),
      description: body.description,
      category: body.category || 'Other',
      tags: body.tags || [],
      task: body.task || null,
      project: body.project || null,
      committee: body.committee || null,
      meeting: body.meeting || null,
      visibility: body.visibility === 'restricted' ? 'restricted' : 'department',
      allowedUsers: body.allowedUsers || [],
      allowedRoles: body.allowedRoles || [],
      department,
      uploadedBy: req.user._id,
      currentVersion: 1,
      versions: [{ version: 1, fileName: req.file.originalname, path: key, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: req.user._id, note: body.note }],
    });
    if (doc.project) await Project.updateOne({ _id: doc.project }, { $addToSet: { documents: doc._id } });
    if (doc.committee) await Committee.updateOne({ _id: doc.committee }, { $addToSet: { documents: doc._id } });
    audit(req, { action: 'document.upload', entityType: 'Document', entityId: doc._id, after: { title: doc.title } });
    created(res, await doc.populate(POP));
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) removeFile(req.file.path);
    throw err;
  }
});

export const addVersion = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A file is required');
  const doc = ensureSameDept(req, await Document.findById(req.params.id), 'Document');
  if (!canAccess(req, doc)) { removeFile(req.file.path); throw ApiError.forbidden(); }
  const key = savePrivate(req.file);
  const version = doc.currentVersion + 1;
  doc.versions.push({ version, fileName: req.file.originalname, path: key, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: req.user._id, note: req.body.note });
  doc.currentVersion = version;
  await doc.save();
  audit(req, { action: 'document.version', entityType: 'Document', entityId: doc._id, meta: { version } });
  ok(res, await doc.populate(POP));
});

export const update = asyncHandler(async (req, res) => {
  const doc = ensureSameDept(req, await Document.findById(req.params.id), 'Document');
  if (!sameId(doc.uploadedBy, req.user._id) && !hasPermission(req, 'document:delete')) throw ApiError.forbidden('Only the uploader can edit document details');
  const body = parseFields(req.body);
  await validateLinks(body, doc.department);
  for (const k of ['title', 'description', 'category', 'tags', 'task', 'project', 'committee', 'meeting', 'visibility', 'allowedUsers', 'allowedRoles']) if (body[k] !== undefined) doc[k] = body[k];
  await doc.save();
  ok(res, await doc.populate(POP));
});

export const download = asyncHandler(async (req, res) => {
  const doc = ensureSameDept(req, await Document.findById(req.params.id).lean(), 'Document');
  if (!canAccess(req, doc)) throw ApiError.forbidden('You do not have access to this document');
  const v = Number(req.query.version) || doc.currentVersion;
  const ver = doc.versions.find((x) => x.version === v);
  if (!ver) throw ApiError.notFound('Version not found');
  const abs = resolve(ver.path);
  if (!fs.existsSync(abs)) throw ApiError.notFound('File missing from storage');
  res.setHeader('Content-Type', ver.mimeType);
  if (req.query.inline === 'true' && /^(application\/pdf|image\/)/.test(ver.mimeType)) {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(ver.fileName)}"`);
    return fs.createReadStream(abs).pipe(res);
  }
  res.download(abs, ver.fileName);
});

export const remove = asyncHandler(async (req, res) => {
  const doc = ensureSameDept(req, await Document.findById(req.params.id), 'Document');
  if (!sameId(doc.uploadedBy, req.user._id) && !hasPermission(req, 'document:delete')) throw ApiError.forbidden();
  await doc.softDelete(req.user._id);
  audit(req, { action: 'document.delete', entityType: 'Document', entityId: doc._id });
  ok(res, { deleted: true });
});

/** Permanently purge (admins only) — removes stored files as well. */
export const purge = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, deletedAt: { $ne: null } }).setOptions({ withDeleted: true });
  ensureSameDept(req, doc, 'Document');
  for (const v of doc.versions) removeStored(v.path);
  await Document.deleteOne({ _id: doc._id }).setOptions({ withDeleted: true });
  audit(req, { action: 'document.purge', entityType: 'Document', entityId: doc._id });
  ok(res, { purged: true });
});
