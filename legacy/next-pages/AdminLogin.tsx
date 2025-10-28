// pages/AdminLogin.tsx
import React from 'react';
const AdminLogin = () => (
  <div className="p-10 max-w-md mx-auto mt-20 bg-white shadow-md rounded">
    <h2 className="text-2xl font-bold mb-4">Admin Login</h2>
    <input className="w-full mb-3 border px-3 py-2" type="email" placeholder="Email" />
    <input className="w-full mb-4 border px-3 py-2" type="password" placeholder="Password" />
    <button className="bg-blue-700 text-white px-4 py-2 rounded w-full">Login</button>
  </div>
);
export default AdminLogin;
