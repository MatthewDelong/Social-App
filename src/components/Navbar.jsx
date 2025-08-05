// src/components/Navbar.jsx
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function Navbar() {
  const { user, logout } = useAppContext();
  const location = useLocation();

  // Hide navbar on login/signup only if user is not logged in
  const hideOnRoutes = ['/login', '/signup'];
  const shouldHide = hideOnRoutes.includes(location.pathname) && !user;

  if (shouldHide) return null;

  return (
    <nav className="bg-white shadow p-4 mb-6 flex justify-between items-center">
      <div className="font-bold text-xl text-gray-800">
        <Link to="/">🔥 Social App</Link>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <Link to="/profile" className="text-sm text-gray-700 hover:underline">
            Profile
          </Link>
          <Link to="/new" className="text-sm text-gray-700 hover:underline">
            New Post
          </Link>
          <Link to="/settings" className="text-sm text-gray-700 hover:underline">
            Settings
          </Link>
          <span className="text-sm text-gray-600 hidden sm:inline">
            {user.displayName || user.email}
          </span>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
