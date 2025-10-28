import React, { useState } from 'react';

const AddTeamMember = () => {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'editor'
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    const res = await fetch('http://localhost:5000/api/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(form)
    });

    const data = await res.json();
    alert(data.message);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">➕ Add Team Member</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" placeholder="Full Name" onChange={handleChange} required className="border p-2 w-full" />
        <input name="email" placeholder="Email" onChange={handleChange} required className="border p-2 w-full" />
        <input name="password" placeholder="Password" type="password" onChange={handleChange} required className="border p-2 w-full" />
        <select name="role" onChange={handleChange} className="border p-2 w-full">
          <option value="editor">Editor</option>
          <option value="intern">Intern</option>
        </select>
        <button className="bg-green-600 text-white px-4 py-2 rounded">Create User</button>
      </form>
    </div>
  );
};

export default AddTeamMember;
