import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import auth from './authSlice';
import ui from './uiSlice';
import { api } from '@/services/api';

export const store = configureStore({
  reducer: { auth, ui, [api.reducerPath]: api.reducer },
  middleware: (gDM) => gDM({ serializableCheck: false }).concat(api.middleware),
});

setupListeners(store.dispatch);
