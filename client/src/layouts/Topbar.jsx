import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Menu, Search, Plus, HelpCircle, Sun, Moon, Monitor, LogOut, UserCog, ListTodo, FolderKanban, CalendarClock, Megaphone, FileText, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { UserAvatar, Tooltip } from '@/components/ui/misc';
import NotificationBell from './NotificationBell';
import { setMobileNav, setSearchOpen, setTheme, openTaskForm } from '@/store/uiSlice';
import { useLogoutMutation, useUpdatePreferencesMutation } from '@/services/endpoints';
import { usePermissions } from '@/hooks';

export default function Topbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useSelector((s) => s.ui.theme);
  const { user, can } = usePermissions();
  const [logout] = useLogoutMutation();
  const [savePrefs] = useUpdatePreferencesMutation();
  const changeTheme = (t) => {
    dispatch(setTheme(t));
    savePrefs({ theme: t });
  };
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-surface/95 px-3 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => dispatch(setMobileNav(true))} aria-label="Open navigation">
        <Menu />
      </Button>

      <button onClick={() => dispatch(setSearchOpen(true))} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-accent sm:max-w-md">
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search tasks, projects, people…</span>
        <kbd className="ml-auto hidden rounded border bg-surface px-1.5 font-sans text-[11px] sm:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9" aria-label="Create">
              <Plus /> <span className="hidden sm:inline">Create</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => dispatch(openTaskForm())}><ListTodo /> Task</DropdownMenuItem>
            {can('project:create') && <DropdownMenuItem onSelect={() => navigate('/projects?new=1')}><FolderKanban /> Project</DropdownMenuItem>}
            {can('committee:create') && <DropdownMenuItem onSelect={() => navigate('/committees?new=1')}><Users2 /> Committee</DropdownMenuItem>}
            {can('meeting:create') && <DropdownMenuItem onSelect={() => navigate('/meetings?new=1')}><CalendarClock /> Meeting</DropdownMenuItem>}
            {can('document:upload') && <DropdownMenuItem onSelect={() => navigate('/documents?new=1')}><FileText /> Document</DropdownMenuItem>}
            {can('announcement:create') && <DropdownMenuItem onSelect={() => navigate('/announcements?new=1')}><Megaphone /> Announcement</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationBell />

        <Tooltip content="Help center">
          <Button variant="ghost" size="icon" asChild aria-label="Help center">
            <Link to="/help"><HelpCircle /></Link>
          </Button>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme"><ThemeIcon /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => changeTheme('light')}><Sun /> Light</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => changeTheme('dark')}><Moon /> Dark</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => changeTheme('system')}><Monitor /> System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full" aria-label="Account menu">
              <UserAvatar user={user} size={32} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
              <p className="truncate text-xs">{user?.email}</p>
              <p className="mt-1 truncate text-xs">{user?.roles?.map((r) => r.name).join(', ')}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}><UserCog /> Profile and settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/reports?tab=me')}><ListTodo /> My performance</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={async () => { await logout(); navigate('/login'); }}><LogOut /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
