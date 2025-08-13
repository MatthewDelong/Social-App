// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";

import { AppProvider, useAppContext } from "./context/AppContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import NewPost from "./pages/NewPost";
import Navbar from "./components/Navbar";
import ProfileSettings from "./pages/ProfileSettings";
import AdminDashboard from "./pages/AdminDashboard";
import UserProfile from "./pages/UserProfile";

// ✅ Group-related pages
import GroupsList from "./pages/GroupsList";
import CreateGroup from "./pages/CreateGroup";
import GroupPage from "./pages/GroupPage";
import GroupPostPage from "./pages/GroupPostPage";

function AppRoutes() {
  const { user, loading, theme } = useAppContext();
  const location = useLocation();

  // Show loading until both `user` and `theme` are ready
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-lg font-medium">Loading...</div>
      </div>
    );
  }

  const AuthNavbar = () => (
    <div
      className="w-full p-4 flex justify-center items-center shadow"
      style={{ backgroundColor: theme?.navbarColor || "#fff" }}
    >
      <img src="/images/logo.png" alt="Logo" className="h-8" />
    </div>
  );

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme?.backgroundColor || "#f9f9f9" }}
    >
      {isAuthPage ? <AuthNavbar /> : user && <Navbar />}

      <Routes>
        {/* Main App Routes */}
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
        <Route path="/profile/:uid" element={<UserProfile />} />
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
          element={
            user?.isAdmin || user?.isModerator ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* ✅ Group Routes */}
        <Route
          path="/groups"
          element={user ? <GroupsList /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/groups/new"
          element={user ? <CreateGroup /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/groups/:groupId"
          element={user ? <GroupPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/groups/:groupId/post/:postId"
          element={user ? <GroupPostPage /> : <Navigate to="/login" replace />}
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