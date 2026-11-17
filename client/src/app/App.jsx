import { useEffect } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import AppRoutes from '@/routes/AppRoutes';
import { setChecking } from '@/store/authSlice';
import { refreshSession } from '@/services/api';
import { useApplyTheme } from '@/hooks';
import { PageLoader } from '@/components/common/States';

/** Restores the session from the HTTP-only refresh cookie on first load. */
export default function App() {
  const dispatch = useDispatch();
  const store = useStore();
  const status = useSelector((s) => s.auth.status);
  useApplyTheme();

  useEffect(() => {
    if (status !== 'idle') return;
    dispatch(setChecking());
    refreshSession({ dispatch, getState: store.getState });
  }, [status, dispatch, store]);

  if (status === 'idle' || status === 'checking') return <div className="min-h-dvh"><PageLoader /></div>;
  return <AppRoutes />;
}
