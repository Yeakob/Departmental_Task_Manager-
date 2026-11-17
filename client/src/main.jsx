import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { store } from '@/store';
import { TooltipProvider } from '@/components/ui/misc';
import App from '@/app/App';
import '@/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <TooltipProvider>
          <App />
          <Toaster position="bottom-right" closeButton richColors toastOptions={{ className: 'font-sans' }} />
        </TooltipProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
