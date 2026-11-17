import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppLayout from '@/layouts/AppLayout';
import { PageLoader } from '@/components/common/States';
import { usePermissions } from '@/hooks';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const TaskDetail = lazy(() => import('@/pages/TaskDetail'));
const Kanban = lazy(() => import('@/pages/Kanban'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Committees = lazy(() => import('@/pages/Committees'));
const CommitteeDetail = lazy(() => import('@/pages/CommitteeDetail'));
const Meetings = lazy(() => import('@/pages/Meetings'));
const MeetingDetail = lazy(() => import('@/pages/MeetingDetail'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const Documents = lazy(() => import('@/pages/Documents'));
const Reports = lazy(() => import('@/pages/Reports'));
const Announcements = lazy(() => import('@/pages/Announcements'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Settings = lazy(() => import('@/pages/Settings'));
const Help = lazy(() => import('@/pages/Help'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function RequireAuth({ children }) {
  const status = useSelector((s) => s.auth.status);
  const location = useLocation();
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function RequirePerm({ perm, children }) {
  const { can } = usePermissions();
  if (!can(...perm)) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  const status = useSelector((s) => s.auth.status);
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={status === 'authenticated' ? <Navigate to="/" replace /> : <Login />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<TasksPage scope="all" />} />
            <Route path="tasks/my" element={<TasksPage scope="mine" />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="projects" element={<RequirePerm perm={['project:read']}><Projects /></RequirePerm>} />
            <Route path="projects/:id" element={<RequirePerm perm={['project:read']}><ProjectDetail /></RequirePerm>} />
            <Route path="committees" element={<RequirePerm perm={['committee:read']}><Committees /></RequirePerm>} />
            <Route path="committees/:id" element={<RequirePerm perm={['committee:read']}><CommitteeDetail /></RequirePerm>} />
            <Route path="meetings" element={<RequirePerm perm={['meeting:read']}><Meetings /></RequirePerm>} />
            <Route path="meetings/:id" element={<RequirePerm perm={['meeting:read']}><MeetingDetail /></RequirePerm>} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="documents" element={<RequirePerm perm={['document:read']}><Documents /></RequirePerm>} />
            <Route path="reports" element={<RequirePerm perm={['report:department', 'report:faculty', 'report:self']}><Reports /></RequirePerm>} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings/*" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
