import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './components/AuthProvider';
import { ToastProvider } from './components/ui';
import './styles.css';

// Nằm trong khung của Trang quản trị (/hub/) thì ẩn menu, thanh trên, nút đăng xuất: Trang quản trị đã có sẵn.
if (window.self !== window.top) document.documentElement.classList.add('embedded');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
