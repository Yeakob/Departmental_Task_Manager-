import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { verifyAccessToken } from '../utils/tokens.js';
import User from '../models/User.js';

let io = null;

export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl.split(',').map((s) => s.trim()), credentials: true },
    pingTimeout: 30000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('_id department isActive').lean();
      if (!user || !user.isActive) return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      socket.data.departmentId = user.department ? String(user.department) : null;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, departmentId } = socket.data;
    socket.join(`user:${userId}`);
    if (departmentId) socket.join(`dept:${departmentId}`);
    logger.debug({ userId }, 'socket connected');

    socket.on('task:watch', (taskId) => typeof taskId === 'string' && socket.join(`task:${taskId}`));
    socket.on('task:unwatch', (taskId) => typeof taskId === 'string' && socket.leave(`task:${taskId}`));
    socket.on('disconnect', () => logger.debug({ userId }, 'socket disconnected'));
  });

  return io;
}

export function getIO() {
  return io;
}

export const emitToUser = (userId, event, payload) => io?.to(`user:${String(userId)}`).emit(event, payload);
export const emitToUsers = (userIds, event, payload) => {
  if (!io) return;
  const rooms = [...new Set(userIds.map((u) => `user:${String(u)}`))];
  if (rooms.length) io.to(rooms).emit(event, payload);
};
export const emitToDepartment = (deptId, event, payload) => deptId && io?.to(`dept:${String(deptId)}`).emit(event, payload);
export const emitToTask = (taskId, event, payload) => io?.to(`task:${String(taskId)}`).emit(event, payload);
