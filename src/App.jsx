// src/App.jsx
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom';

import { AppProvider, useAppContext } from './context/AppContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Profile from './pages/Profile';
import NewPost from './pages/NewPost';
import Navbar from './components/Navbar';
import ProfileSettings from './pages/ProfileSettings';
import AdminDashboard from './pages/AdminDashboard';

/**
 * AppRoutes component
 *
 * Important behavior:
 *  - We **do not** render any redirects until `loading` is false.
 *    This prevents the navbar / UI flashing when auth/theme are still initializing.
 *  - We render a single "Loading..." screen while loading.
 *  - We use <Navigate replace /> for redirects to avoid polluting history.
 */
function AppRoutes() {
  const { user, loading, theme } = useAppContext();
  const location = useLocation();

  // Block rendering/redirects until app finished loading user + theme
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-lg font-medium">Loading...</div>
      </div>
    );
  }

  // Minimal navbar shown on auth pages
  const AuthNavbar = () => (
    <div
      className="w-full p-4 flex justify-center items-center shadow"
      style={{ backgroundColor: theme?.navbarColor }}
    >
      <img src="/logo.png" alt="Logo" className="h-8" />
    </div>
  );

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme?.backgroundColor }}
    >
      {isAuthPage ? <AuthNavbar /> : <Navbar />}

      <Routes>
        <Route
          path="/"
          element={user ? <Home /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" replace />}
        />

        <Route
          path="/signup"
          element={!user ? <Signup /> : <Navigate to="/" replace />}
        />

        <Route
          path="/profile"
          element={user ? <Profile /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/new"
          element={user ? <NewPost /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/settings"
          element={user ? <ProfileSettings /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/admin"
          element={(user?.isAdmin || user?.isModerator) ? <AdminDashboard /> : <Navigate to="/" replace />}
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
}