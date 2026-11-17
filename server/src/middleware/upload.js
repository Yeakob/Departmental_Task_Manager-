import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.ms-excel', '.xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
  ['application/vnd.ms-powerpoint', '.ppt'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['application/zip', '.zip'],
  ['application/x-zip-compressed', '.zip'],
  ['text/plain', '.txt'],
  ['text/csv', '.csv'],
]);

const uploadRoot = path.resolve(env.uploadDir);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const d = new Date();
    const dir = path.join(uploadRoot, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) || path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(ApiError.badRequest(`File type not allowed: ${file.mimetype}`));
    cb(null, true);
  },
});

/** Converts an absolute stored path to a URL path served by express.static. */
export function toPublicPath(absPath) {
  const rel = path.relative(uploadRoot, absPath).split(path.sep).join('/');
  return '/uploads/' + rel;
}

export function removeFile(absOrRelPath) {
  try {
    let p;
    if (path.isAbsolute(absOrRelPath)) {
      p = absOrRelPath;
    } else {
      const clean = absOrRelPath.replace(/^\/+/, '').replace(/^uploads\//, '');
      p = path.resolve(uploadRoot, clean);
    }
    if (p.startsWith(uploadRoot) && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}
