import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import GlobalSearch from './GlobalSearch';
import Footer from '@/components/common/Footer';
import TaskFormDialog from '@/features/tasks/TaskFormDialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { setMobileNav } from '@/store/uiSlice';
import { useRealtime } from '@/hooks/useRealtime';
import { Link } from 'react-router-dom';

export default function AppLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const mobileOpen = useSelector((s) => s.ui.mobileNavOpen);
  const user = useSelector((s) => s.auth.user);
  useRealtime();

  useEffect(() => {
    const go = (e) => navigate(e.detail);
    window.addEventListener('dwmt:navigate', go);
    return () => window.removeEventListener('dwmt:navigate', go);
  }, [navigate]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">
        <Sidebar />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={(v) => dispatch(setMobileNav(v))}>
        <DialogContent side="left" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <Sidebar mobile />
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {user?.mustChangePassword && (
          <div className="border-b border-highlight/40 bg-highlight-soft px-4 py-2 text-center text-sm">
            You’re using a temporary password. <Link to="/settings/security" className="font-medium underline underline-offset-2">Set your own password</Link> to secure your account.
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-6">
          <Outlet />
        </main>
        <Footer />
      </div>
      <GlobalSearch />
      <TaskFormDialog />
    </div>
  );
}
