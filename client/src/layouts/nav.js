import { LayoutDashboard, CheckSquare, ListTodo, KanbanSquare, FolderKanban, Users2, CalendarClock, CalendarDays, FileText, BarChart3, Megaphone, Bell, Settings } from 'lucide-react';

/** `perm`: any of these permissions shows the item. */
export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks/my', label: 'My Tasks', icon: CheckSquare },
  { to: '/tasks', label: 'All Tasks', icon: ListTodo, end: true },
  { to: '/kanban', label: 'Kanban Board', icon: KanbanSquare },
  { to: '/projects', label: 'Projects', icon: FolderKanban, perm: ['project:read'] },
  { to: '/committees', label: 'Committees', icon: Users2, perm: ['committee:read'] },
  { to: '/meetings', label: 'Meetings', icon: CalendarClock, perm: ['meeting:read'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/documents', label: 'Documents', icon: FileText, perm: ['document:read'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, perm: ['report:department', 'report:faculty', 'report:self'] },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, perm: ['announcement:read'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
  { to: '/settings', label: 'Settings', icon: Settings },
];
