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

function AppRoutes() {
  const { user, loading, theme } = useAppContext();
  const location = useLocation();

  // ✅ Prevent redirect until loading is done
  if (loading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  const AuthNavbar = () => (
    <div
      className="w-full p-4 flex justify-center items-center shadow"
      style={{ backgroundColor: theme.navbarColor }}
    >
      <img src="/logo.png" alt="Logo" className="h-8" />
    </div>
  );

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme.backgroundColor }}
    >
      {isAuthPage ? <AuthNavbar /> : <Navbar />}
      <Routes>
        <Route
          path="/"
          element={
            user
              ? <Home />
              : loading
                ? <div className="text-center mt-10">Loading...</div>
                : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/login"
          element={
            !user
              ? <Login />
              : loading
                ? <div className="text-center mt-10">Loading...</div>
                : <Navigate to="/" replace />
          }
        />
        <Route
          path="/signup"
          element={
            !user
              ? <Signup />
              : loading
                ? <div className="text-center mt-10">Loading...</div>
                : <Navigate to="/" replace />
          }
        />
        <Route
          path="/profile"
          element={
            user
              ? <Profile />
              : loading
                ? <div className="text-center mt-10">Loading...</div>
                : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/new"
          element={
            user
              ? <NewPost />
              : loading
                ? <div className="text-center mt-10">Loading...</div>
                : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/settings"
          element={
            user
              ? <ProfileSettings />
              : loading
                ? <div className="text-center mt-10">Loading...</div>
                : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/admin"
          element={
            (user?.isAdmin || user?.isModerator)
              ? <AdminDashboard />
              : loading
                ? <div className="text-center mt-10">Loading...</div>
                : <Navigate to="/" replace />
          }
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