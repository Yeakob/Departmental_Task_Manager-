import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, accessToken: null, status: 'idle' }, // idle | checking | authenticated | anonymous
  reducers: {
    setCredentials(state, { payload }) {
      if (payload.user) state.user = payload.user;
      if (payload.accessToken) state.accessToken = payload.accessToken;
      state.status = 'authenticated';
    },
    setUser(state, { payload }) {
      state.user = { ...state.user, ...payload };
    },
    setChecking(state) {
      state.status = 'checking';
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
    },
  },
});

export const { setCredentials, setUser, setChecking, loggedOut } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (s) => s.auth.user;
export const selectPermissions = (s) => s.auth.user?.permissions || [];
