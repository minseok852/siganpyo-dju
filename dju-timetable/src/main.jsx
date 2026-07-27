// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {/* 방문자 집계 — Vercel 대시보드 Analytics 탭에서도 켜야 데이터가 쌓입니다 */}
    <Analytics />
  </React.StrictMode>
);
