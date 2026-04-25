import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Inject Authorization header on all /api/* requests automatically
const _fetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url ?? '';
  if (url.includes('/api/')) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      init = { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } };
    }
  }
  return _fetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
