import { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch, useStore } from 'react-redux';
import { toast } from 'sonner';
import { downloadFile } from '@/services/api';
import { apiError } from '@/lib/utils';

/** Permission checks mirroring the server (super admin holds '*'). */
export function usePermissions() {
  const user = useSelector((s) => s.auth.user);
  const perms = user?.permissions || [];
  const roleKeys = (user?.roles || []).map((r) => r.key);
  const isSuperAdmin = perms.includes('*');
  const can = useCallback((...keys) => isSuperAdmin || keys.some((k) => perms.includes(k)), [isSuperAdmin, perms]);
  return { can, isSuperAdmin, roleKeys, user };
}

export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useApplyTheme() {
  const theme = useSelector((s) => s.ui.theme);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/** Runs an RTK mutation with toast feedback. Returns the unwrapped result or undefined. */
export function useAction() {
  return useCallback(async (promise, { success, error } = {}) => {
    try {
      const res = await promise.unwrap();
      if (success) toast.success(success);
      return res ?? true;
    } catch (e) {
      toast.error(apiError(e, error));
      return undefined;
    }
  }, []);
}

/** Authenticated download helper bound to the store. */
export function useDownload() {
  const store = useStore();
  return useCallback(async (url, filename, opts) => {
    try {
      await downloadFile(url, filename, store.getState, opts);
    } catch (e) {
      toast.error(e.message);
    }
  }, [store]);
}

export const useAppDispatch = useDispatch;
