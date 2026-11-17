import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

/** Wrap async route handlers so rejections flow to the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const ok = (res, data, meta) => res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });
export const created = (res, data) => res.status(201).json({ success: true, data });
export const noContent = (res) => res.status(204).send();

export function assertObjectId(id, label = 'id') {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}`);
  return id;
}

/**
 * Parses pagination/sort params. Returns { page, limit, skip, sort }.
 * sort format: "field" or "-field" or "field1,-field2"
 */
export function parsePagination(query, { defaultSort = '-createdAt', maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || 20));
  const sortParam = typeof query.sort === 'string' && query.sort.trim() ? query.sort : defaultSort;
  const sort = {};
  for (const part of sortParam.split(',')) {
    const key = part.trim();
    if (!key) continue;
    if (key.startsWith('-')) sort[key.slice(1)] = -1;
    else sort[key] = 1;
  }
  return { page, limit, skip: (page - 1) * limit, sort };
}

export async function paginate(Model, filter, { page, limit, skip, sort }, populate = [], select) {
  let q = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (select) q = q.select(select);
  for (const p of populate) q = q.populate(p);
  const [items, total] = await Promise.all([q.lean({ virtuals: true }), Model.countDocuments(filter)]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
}

export function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
