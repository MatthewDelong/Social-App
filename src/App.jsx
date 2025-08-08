import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
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

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme.backgroundColor }}
    >
      {user && <Navbar />}
      <Routes>
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/new" element={user ? <NewPost /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <ProfileSettings /> : <Navigate to="/login" />} />
        <Route
          path="/admin"
          element={(user?.isAdmin || user?.isModerator) ? <AdminDashboard /> : <Navigate to="/" />}
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