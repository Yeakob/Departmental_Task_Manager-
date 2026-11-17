import { createSlice } from '@reduxjs/toolkit';

const read = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarCollapsed: read('dwmt-sidebar', false),
    mobileNavOpen: false,
    theme: (() => { try { return localStorage.getItem('dwmt-theme') || 'system'; } catch { return 'system'; } })(),
    searchOpen: false,
    taskFormOpen: false,
    taskFormDefaults: null,
  },
  reducers: {
    toggleSidebar(s) {
      s.sidebarCollapsed = !s.sidebarCollapsed;
      try { localStorage.setItem('dwmt-sidebar', JSON.stringify(s.sidebarCollapsed)); } catch { /* ignore */ }
    },
    setMobileNav(s, { payload }) { s.mobileNavOpen = payload; },
    setTheme(s, { payload }) {
      s.theme = payload;
      try { localStorage.setItem('dwmt-theme', payload); } catch { /* ignore */ }
    },
    setSearchOpen(s, { payload }) { s.searchOpen = payload; },
    openTaskForm(s, { payload }) { s.taskFormOpen = true; s.taskFormDefaults = payload || null; },
    closeTaskForm(s) { s.taskFormOpen = false; s.taskFormDefaults = null; },
  },
});

export const { toggleSidebar, setMobileNav, setTheme, setSearchOpen, openTaskForm, closeTaskForm } = uiSlice.actions;
export default uiSlice.reducer;
