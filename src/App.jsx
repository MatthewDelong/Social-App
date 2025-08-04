import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Profile from './pages/Profile';
import NewPost from './pages/NewPost';
import { Button } from './components/ui/button';

const Auth = ({ children }) => {
  const { currentUser } = useApp();
  return currentUser ? children : <Navigate to="/login" />;
};

const Nav = () => {
  const { logout, currentUser } = useApp();
  return (
    <nav className="flex justify-between p-4 border-b">
      <div className="flex gap-4">
        <Link to="/">Home</Link>
        <Link to="/new">New Post</Link>
        <Link to="/profile">Profile</Link>
      </div>
      {currentUser && <Button onClick={logout}>Logout</Button>}
    </nav>
  );
};

export default () => (
  <AppProvider>
    <Router>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Auth><Home /></Auth>} />
        <Route path="/new" element={<Auth><NewPost /></Auth>} />
        <Route path="/profile" element={<Auth><Profile /></Auth>} />
      </Routes>
    </Router>
  </AppProvider>
);