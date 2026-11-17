import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { Profile, Security, Preferences } from '@/features/settings/Account';
import { Users, Roles, Departments, Categories, Sessions } from '@/features/settings/Admin';
import { Recurring, Audit, RecycleBin, DataExport } from '@/features/settings/Ops';
import { usePermissions } from '@/hooks';
import { cn } from '@/lib/utils';

const SECTIONS = [
  ['Your account', [
    ['profile', 'Profile', Profile],
    ['security', 'Password', Security],
    ['preferences', 'Notifications and appearance', Preferences],
  ]],
  ['Department', [
    ['users', 'Users', Users, ['user:manage']],
    ['roles', 'Roles and permissions', Roles, ['role:manage', 'user:manage']],
    ['departments', 'Departments', Departments, ['department:manage', 'user:manage']],
    ['categories', 'Task categories', Categories, ['category:manage']],
    ['sessions', 'Academic sessions', Sessions, ['system:manage', 'user:manage']],
    ['recurring', 'Recurring tasks', Recurring, ['task:bulk']],
  ]],
  ['Records', [
    ['audit', 'Audit trail', Audit, ['audit:read']],
    ['recycle-bin', 'Recycle bin', RecycleBin, ['task:delete']],
    ['export', 'Data export', DataExport, ['system:manage', 'report:department']],
  ]],
];

export default function Settings() {
  const { can } = usePermissions();
  const groups = SECTIONS.map(([g, items]) => [g, items.filter(([, , , perm]) => !perm || can(...perm))]).filter(([, items]) => items.length);
  const all = groups.flatMap(([, items]) => items);
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings" className="flex gap-4 overflow-x-auto lg:block lg:space-y-5">
          {groups.map(([g, items]) => (
            <div key={g} className="shrink-0">
              <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">{g}</p>
              <ul className="flex gap-1 lg:block lg:space-y-0.5">
                {items.map(([path, label]) => (
                  <li key={path}>
                    <NavLink to={`/settings/${path}`} className={({ isActive }) => cn('block whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm', isActive ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground')}>{label}</NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          <Routes>
            <Route index element={<Navigate to="profile" replace />} />
            {all.map(([path, , Component]) => <Route key={path} path={path} element={<Component />} />)}
            <Route path="*" element={<Navigate to="profile" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
