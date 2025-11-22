import React from 'react';
import { useAuth } from '@context/AuthContext';

export default function AuthDebugPanel(){
  const { user, token, isReady, isRestoring, isAuthenticated } = useAuth();
  if (!import.meta.env.DEV) return null;
  return (
    <div style={{position:'fixed', bottom:8, right:8, fontSize:12, background:'#0f172a', color:'white', padding:'8px 10px', borderRadius:6, border:'1px solid #334155', maxWidth:280}}>
      <div style={{fontWeight:600, marginBottom:4}}>Auth Debug</div>
      <div>ready: {String(isReady)}</div>
      <div>restoring: {String(isRestoring)}</div>
      <div>auth: {String(isAuthenticated)}</div>
      <div>user.email: {user?.email || '—'}</div>
      <div>user.role: {user?.role || '—'}</div>
      <div>token: {token ? token.slice(0,16)+'…' : 'null'}</div>
    </div>
  );
}
