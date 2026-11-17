import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

/**
 * Local-disk storage abstraction. Swap this module for a Cloudinary/S3 adapter
 * with the same interface (`savePrivate`, `resolve`, `remove`) to change backends.
 */
const root = path.resolve(env.uploadDir);
const privateRoot = path.join(root, 'private');
fs.mkdirSync(privateRoot, { recursive: true });

/** Moves a multer temp upload into the private (non-static) area; returns a storage key. */
export function savePrivate(file) {
  const d = new Date();
  const dir = path.join(privateRoot, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, path.basename(file.path));
  fs.renameSync(file.path, dest);
  return path.relative(root, dest).split(path.sep).join('/');
}

export function resolve(key) {
  const abs = path.resolve(root, key);
  if (!abs.startsWith(privateRoot)) throw new Error('Invalid storage key');
  return abs;
}

export function remove(key) {
  try {
    fs.unlinkSync(resolve(key));
  } catch {
    /* already gone */
  }
}

export const isPrivatePath = (urlPath) => urlPath.replace(/^\/+/, '').startsWith('private');
