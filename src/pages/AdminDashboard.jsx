import { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../context/AppContext';

export default function AdminDashboard() {
  const { theme, saveTheme } = useAppContext();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);

  const [navbarColor, setNavbarColor] = useState(theme.navbarColor);
  const [backgroundColor, setBackgroundColor] = useState(theme.backgroundColor);

  useEffect(() => {
    const fetchData = async () => {
      const postSnapshot = await getDocs(collection(db, 'posts'));
      setPosts(postSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const userSnapshot = await getDocs(collection(db, 'users'));
      setUsers(userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchData();
  }, []);

  const deletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
    setPosts(posts.filter(p => p.id !== postId));
  };

  const deleteUser = async (userId) => {
    await deleteDoc(doc(db, 'users', userId));
    setUsers(users.filter(u => u.id !== userId));
  };

  const toggleAdmin = async (userId, currentStatus) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isAdmin: !currentStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, isAdmin: !currentStatus } : u));
  };

  const toggleModerator = async (userId, currentStatus) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isModerator: !currentStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, isModerator: !currentStatus } : u));
  };

  const handleThemeSave = () => {
    saveTheme({ navbarColor, backgroundColor });
  };

  const presetNavbarColors = ['#ffffff', '#1E3A8A', '#4B5563', '#2563EB', '#DC2626'];
  const presetBackgroundColors = ['#f9fafb', '#F3F4F6', '#E5E7EB', '#FEF3C7', '#D1FAE5'];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>

      {/* THEME SETTINGS */}
      <section className="mb-10 border p-4 rounded bg-white">
        <h3 className="text-lg font-semibold mb-4">Theme Settings</h3>

        <div
          className="p-3 rounded mb-4 shadow flex justify-between items-center"
          style={{ backgroundColor: navbarColor }}
        >
          <span className="text-white font-medium">Navbar Preview</span>
        </div>
        <div
          className="p-4 rounded mb-6"
          style={{ backgroundColor: backgroundColor }}
        >
          <span className="text-gray-800">Page Background Preview</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <div>
            <label className="block text-sm font-medium mb-1">Navbar Color</label>
            <input
              type="color"
              value={navbarColor}
              onChange={(e) => setNavbarColor(e.target.value)}
              className="w-16 h-10 p-0 border rounded"
            />
            <div className="flex gap-1 mt-2">
              {presetNavbarColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setNavbarColor(color)}
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Background Color</label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="w-16 h-10 p-0 border rounded"
            />
            <div className="flex gap-1 mt-2">
              {presetBackgroundColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setBackgroundColor(color)}
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleThemeSave}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save Theme
        </button>
      </section>

      {/* POSTS SECTION */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Posts</h3>
        {posts.length === 0 && <p className="text-gray-500">No posts found.</p>}

        {posts.map(post => (
          <div key={post.id} className="border p-3 mb-3 rounded bg-gray-50">
            <p className="font-medium text-gray-800">{post.content}</p>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
              By: <strong>{post.author || post.authorEmail || 'Unknown'}</strong>
              {post.isAdmin && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Admin</span>
              )}
              {post.isModerator && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Moderator</span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {post.createdAt
                ? formatDistanceToNow(
                    typeof post.createdAt === 'string'
                      ? new Date(post.createdAt)
                      : post.createdAt.toDate(),
                    { addSuffix: true }
                  )
                : ''}
            </p>
            <button
              onClick={() => deletePost(post.id)}
              className="text-sm text-red-600 hover:underline mt-2"
            >
              Delete Post
            </button>
          </div>
        ))}
      </section>

      {/* USERS SECTION */}
      <section>
        <h3 className="text-xl font-semibold mb-2">Users</h3>
        {users.map(user => (
          <div key={user.id} className="border p-3 mb-3 rounded bg-white">
            <p className="font-medium flex items-center gap-2">
              {user.displayName || user.email}
              {user.isAdmin && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Admin</span>
              )}
              {user.isModerator && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Moderator</span>
              )}
            </p>
            <p className="text-sm text-gray-500 mb-1">{user.email}</p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => toggleAdmin(user.id, user.isAdmin)}
                className="text-sm text-blue-600 hover:underline"
              >
                {user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
              </button>

              <button
                onClick={() => toggleModerator(user.id, user.isModerator)}
                className="text-sm text-green-600 hover:underline"
              >
                {user.isModerator ? 'Revoke Moderator' : 'Make Moderator'}
              </button>

              {!user.isAdmin && (
                <button
                  onClick={() => deleteUser(user.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete User
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}