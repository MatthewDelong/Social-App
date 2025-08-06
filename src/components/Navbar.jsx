// src/components/Navbar.jsx
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function Navbar() {
  const { user, logout } = useAppContext();
  const location = useLocation();

  // Define routes where navbar content (not logo) should be hidden if user is not logged in
  const hideContentRoutes = ['/login', '/signup'];
  const shouldHideContent = hideContentRoutes.includes(location.pathname) && !user;

  return (
    <nav className="bg-white shadow p-4 mb-6 flex justify-between items-center">
      {/* Logo - always visible */}
      <div className="flex items-center">
        <Link to="/">
          <img src="/images/logo.png" alt="Logo" className="h-16 w-auto" />
        </Link>
      </div>

      {/* Right-side content - only visible if user is logged in or not on login/signup */}
      {!shouldHideContent && user && (
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
