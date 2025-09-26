import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UserMenu = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const userName = user?.name || 'Admin';

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="bg-gray-800 text-white px-3 py-1 rounded flex items-center gap-2"
      >
        👤 {userName} ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white border shadow rounded z-50">
          <button className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm" disabled>
            Profile
          </button>
          <button onClick={logout} className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-100 text-sm">
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
