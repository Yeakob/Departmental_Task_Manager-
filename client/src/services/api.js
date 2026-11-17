import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, loggedOut } from '@/store/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api/v1',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Requested-With', 'XMLHttpRequest');
    return headers;
  },
});

// One in-flight refresh shared by all concurrent 401s.
let refreshing = null;

export async function refreshSession(api) {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, {});
      if (res.data?.data?.accessToken) {
        api.dispatch(setCredentials(res.data.data));
        return true;
      }
      api.dispatch(loggedOut());
      return false;
    })().finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  }
  return refreshing;
}

const baseQueryWithReauth = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra);
  const url = typeof args === 'string' ? args : args.url;
  if (result.error?.status === 401 && !url.startsWith('/auth/')) {
    if (await refreshSession(api)) result = await rawBaseQuery(args, api, extra);
  }
  return result;
};

export const TAGS = ['Task', 'Kanban', 'Project', 'Committee', 'Meeting', 'Document', 'Announcement', 'Notification', 'Calendar', 'Report', 'User', 'Role', 'Category', 'Department', 'Session', 'Recurring', 'Audit', 'Prefs', 'Comment', 'Activity', 'Attachment', 'Approval'];

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: TAGS,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});

/** Response helpers: list endpoints keep `meta`, others unwrap `data`. */
export const unwrap = (r) => r.data;
export const withMeta = (r) => ({ items: r.data, meta: r.meta || {} });

/** Strip undefined/empty params so URLs stay clean and cache keys stable. */
export function qs(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = Array.isArray(v) ? v.join(',') : v;
  }
  return out;
}

/** Authenticated binary download (documents, ICS, exports). */
export async function downloadFile(url, filename, getState, { inline = false } = {}) {
  const token = getState().auth.accessToken;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
  if (!res.ok) {
    let msg = 'Download failed';
    try { msg = (await res.json()).message || msg; } catch { /* binary */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  if (inline) {
    window.open(href, '_blank', 'noopener');
  } else {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}
