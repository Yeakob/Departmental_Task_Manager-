import { ApiError } from './ApiError.js';

const idOf = (v) => String(v?._id ?? v ?? '');

/** Throws 404 when missing and 403 when the document belongs to another department. */
export function ensureSameDept(req, doc, label = 'Resource') {
  if (!doc) throw ApiError.notFound(`${label} not found`);
  if (req.isSuperAdmin) return doc;
  if (idOf(doc.department) !== String(req.departmentId)) throw ApiError.forbidden(`${label} belongs to another department`);
  return doc;
}

export const sameId = (a, b) => idOf(a) === idOf(b);
export const includesId = (list = [], id) => list.some((x) => idOf(x) === idOf(id));
export { idOf };

/** Department to write into: super admin may pass one explicitly. */
export function targetDept(req, explicit) {
  const d = req.isSuperAdmin && explicit ? explicit : req.departmentId;
  if (!d) throw ApiError.badRequest('You are not attached to a department');
  return d;
}
