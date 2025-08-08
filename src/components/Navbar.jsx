import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

// Helper to determine if text should be light or dark
function getContrastYIQ(hexcolor) {
  hexcolor = hexcolor.replace('#', '');
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? 'text-gray-900' : 'text-white';
}

export default function Navbar() {
  const { user, logout, theme } = useAppContext();
  const location = useLocation();
  const hideContentRoutes = ['/login', '/signup'];
  const isLoginOrSignup = hideContentRoutes.includes(location.pathname) && !user;

  const [menuOpen, setMenuOpen] = useState(false);
  const textColorClass = getContrastYIQ(theme.navbarColor);

  return (
    <nav
      className="shadow py-2 px-4 mb-6"
      style={{ backgroundColor: theme.navbarColor }}
    >
      <div className="flex justify-between items-center max-w-6xl mx-auto">
        {/* Logo */}
        <Link to="/">
          <img src="/images/logo.png" alt="Logo" className="h-8 w-auto" />
        </Link>

        {/* Right side */}
        {!isLoginOrSignup && user && (
          <>
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`sm:hidden focus:outline-none ${textColorClass}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop links */}
            <div className={`hidden sm:flex items-center gap-4 ${textColorClass}`}>
              <Link to="/profile" className="text-sm hover:underline">Profile</Link>
              <Link to="/new" className="text-sm hover:underline">New Post</Link>
              <Link to="/settings" className="text-sm hover:underline">Settings</Link>
              {user.isAdmin && (
                <Link to="/admin" className="text-sm hover:underline">Admin Dashboard</Link>
              )}
              <span className="text-sm hidden sm:inline">{user.displayName || user.email}</span>
              <button onClick={logout} className="text-sm hover:underline">Logout</button>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {menuOpen && !isLoginOrSignup && user && (
        <div className={`sm:hidden mt-4 flex flex-col gap-2 ${textColorClass}`}>
          <Link to="/profile" className="text-sm hover:underline" onClick={() => setMenuOpen(false)}>Profile</Link>
          <Link to="/new" className="text-sm hover:underline" onClick={() => setMenuOpen(false)}>New Post</Link>
          <Link to="/settings" className="text-sm hover:underline" onClick={() => setMenuOpen(false)}>Settings</Link>
          {user.isAdmin && (
            <Link to="/admin" className="text-sm hover:underline" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>
          )}
          <span className="text-sm">{user.displayName || user.email}</span>
          <button
            onClick={() => { logout(); setMenuOpen(false); }}
            className="text-sm hover:underline"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}