import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV } from './nav';
import { usePermissions } from '@/hooks';
import { toggleSidebar, setMobileNav } from '@/store/uiSlice';
import { useUnreadCountQuery } from '@/services/endpoints';
import { Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/app/siteConfig';

export function BrandMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1F6B52" />
      <path d="M18 20h16a14 14 0 0 1 0 28H18z" fill="none" stroke="#F3F1E8" strokeWidth="5" strokeLinejoin="round" />
      <path d="M26 34l5 5 10-11" fill="none" stroke="#E5A93A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar({ mobile = false }) {
  const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed) && !mobile;
  const { can, user } = usePermissions();
  const { data: unread = 0 } = useUnreadCountQuery(undefined, { pollingInterval: 120000 });
  const items = NAV.filter((n) => !n.perm || can(...n.perm));

  return (
    <div className={cn('flex h-full flex-col bg-sidebar text-sidebar-foreground', collapsed ? 'w-[64px]' : 'w-[244px]')}>
      <div className={cn('flex h-14 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <BrandMark />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="text-md font-semibold">{siteConfig.appName}</p>
            <p className="truncate text-xs text-sidebar-muted">{user?.department?.code ? `${user.department.code} department` : 'All departments'}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" aria-label="Main">
        {items.map((n) => {
          const badge = n.badge === 'notifications' && unread > 0 ? unread : null;
          const link = (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => mobile && dispatch(setMobileNav(false))}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground',
                  isActive && 'bg-sidebar-active font-medium text-sidebar-foreground before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r before:bg-[#E5A93A]',
                  collapsed && 'justify-center px-0'
                )
              }
            >
              <n.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
              {badge && (
                <span className={cn('rounded-full bg-[#E5A93A] px-1.5 text-[11px] font-semibold leading-5 text-[#1b1a14] tabular', collapsed && 'absolute right-1 top-0.5 px-1 text-[10px] leading-4')}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip key={n.to} content={n.label} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
      {!mobile && (
        <button onClick={() => dispatch(toggleSidebar())} className={cn('m-2 flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground', collapsed && 'justify-center px-0')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {!collapsed && 'Collapse'}
        </button>
      )}
    </div>
  );
}
