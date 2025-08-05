import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Profile from './pages/Profile';
import NewPost from './pages/NewPost';
import Navbar from './components/Navbar'; // ✅ import the Navbar

export default function App() {
  const { user } = useAppContext();

  return (
    <Router>
      {/* ✅ Show Navbar only if the user is logged in */}
      {user && <Navbar />}

      <Routes>
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/new" element={user ? <NewPost /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}
