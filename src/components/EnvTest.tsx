// 🧪 Environment Test Component
import React from 'react';

const EnvTest: React.FC = () => {
  const demoMode = import.meta.env.VITE_DEMO_MODE;
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const mode = import.meta.env.MODE;
  const dev = import.meta.env.DEV;
  const prod = import.meta.env.PROD;
  
  const isVercel = window.location.hostname.includes('vercel.app');
  const isLocalhost = window.location.hostname === 'localhost';
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: '#000', 
      color: '#0f0', 
      padding: '10px', 
      fontSize: '12px',
      fontFamily: 'monospace',
      borderRadius: '5px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div>🔧 Environment Debug</div>
      <div>VITE_DEMO_MODE: {demoMode || 'undefined'}</div>
      <div>API_URL: {apiUrl || 'undefined'}</div>
      <div>MODE: {mode}</div>
      <div>DEV: {dev ? 'true' : 'false'}</div>
      <div>PROD: {prod ? 'true' : 'false'}</div>
      <div>---</div>
      <div>Hostname: {window.location.hostname}</div>
      <div>Is Vercel: {isVercel ? 'YES' : 'NO'}</div>
      <div>Is Localhost: {isLocalhost ? 'YES' : 'NO'}</div>
      <div>---</div>
      <div>Demo Logic: {(demoMode !== 'false' && isVercel) ? 'ENABLED' : 'DISABLED'}</div>
    </div>
  );
};

export default EnvTest;