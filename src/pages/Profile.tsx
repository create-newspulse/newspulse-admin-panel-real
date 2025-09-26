// 📁 src/pages/Profile.tsx

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [message, setMessage] = useState('');

  const handleSave = () => {
    // Simulate update
    setMessage('✅ Profile saved! (simulated)');
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">👤 Profile</h2>
      <label className="block mb-2 font-medium">Name</label>
      <input
        className="border w-full mb-4 px-3 py-2 rounded"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="block mb-2 font-medium">Bio</label>
      <textarea
        className="border w-full mb-4 px-3 py-2 rounded"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />

      <label className="block mb-2 font-medium">Avatar URL</label>
      <input
        className="border w-full mb-4 px-3 py-2 rounded"
        value={avatar}
        onChange={(e) => setAvatar(e.target.value)}
      />

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
        onClick={handleSave}
      >
        Save Changes
      </button>

      {message && <p className="mt-4 text-green-600">{message}</p>}
    </div>
  );
}
