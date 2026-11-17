import { ZodError } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 422;
    message = 'Validation failed';
    details = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0];
    message = field ? `Duplicate value for ${field}` : 'Duplicate key';
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${env.maxFileSizeMb} MB)` : err.message;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
  }

  if (status >= 500) logger.error({ err, url: req.originalUrl }, 'Unhandled error');
  else logger.debug({ status, message, url: req.originalUrl }, 'Request error');

  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProd ? 'Internal server error' : message,
    ...(details ? { details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}
