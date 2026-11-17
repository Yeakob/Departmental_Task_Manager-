import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { api } from '@/services/api';

let socket = null;
export const getSocket = () => socket;

/**
 * Keeps one Socket.IO connection per session and turns server events into
 * cache invalidations, so every open view reflects changes made by others.
 */
export function useRealtime() {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.accessToken);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return undefined;
    if (!socket) {
      socket = io({ path: '/socket.io', auth: (cb) => cb({ token: tokenRef.current }), transports: ['websocket', 'polling'] });
    } else if (!socket.connected) {
      socket.connect();
    }
    const inv = (tags) => () => dispatch(api.util.invalidateTags(tags));
    const handlers = {
      'task:created': inv(['Task', 'Kanban', 'Report', 'Calendar']),
      'task:updated': inv(['Task', 'Kanban', 'Report', 'Calendar', 'Approval']),
      'task:deleted': inv(['Task', 'Kanban', 'Report', 'Calendar']),
      'kanban:reordered': inv(['Kanban']),
      'task:activity': inv(['Activity']),
      'comment:new': inv(['Comment']),
      'comment:updated': inv(['Comment']),
      'comment:deleted': inv(['Comment']),
      'checklist:updated': inv(['Task']),
      'attachment:added': inv(['Attachment']),
      'attachment:removed': inv(['Attachment']),
      'project:changed': inv(['Project']),
      'committee:changed': inv(['Committee']),
      'meeting:changed': inv(['Meeting', 'Calendar']),
      'calendar:changed': inv(['Calendar']),
      'announcement:changed': inv(['Announcement', 'Report']),
      'notification:count': inv(['Notification']),
      'notification:new': (n) => {
        dispatch(api.util.invalidateTags(['Notification']));
        toast(n.title, { description: n.message?.slice(0, 140), action: n.link ? { label: 'Open', onClick: () => window.dispatchEvent(new CustomEvent('dwmt:navigate', { detail: n.link })) } : undefined });
      },
    };
    for (const [e, h] of Object.entries(handlers)) socket.on(e, h);
    const onConnectError = () => {
      // token may have rotated; the auth callback reads the latest one on retry
      setTimeout(() => socket?.connect(), 3000);
    };
    socket.on('connect_error', onConnectError);
    return () => {
      for (const [e, h] of Object.entries(handlers)) socket?.off(e, h);
      socket?.off('connect_error', onConnectError);
    };
  }, [token, dispatch]);

  useEffect(() => {
    if (!token && socket) {
      socket.disconnect();
      socket = null;
    }
  }, [token]);
}

/** Join a task room while a task detail view is open. */
export function useTaskRoom(taskId) {
  useEffect(() => {
    if (!taskId || !socket) return undefined;
    socket.emit('task:watch', taskId);
    return () => socket?.emit('task:unwatch', taskId);
  }, [taskId]);
}
