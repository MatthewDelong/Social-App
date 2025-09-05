// src/pages/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';

const FUNCTIONS_REGION = 'europe-west2';

export default function AdminDashboard() {
  const { theme, saveTheme } = useAppContext();

  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState({});

  const defaultAvatar =
    'https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc';

  const [navbarColor, setNavbarColor] = useState(theme?.navbarColor || '#ffffff');
  const [backgroundColor, setBackgroundColor] = useState(theme?.backgroundColor || '#f9fafb');

  const safeFormatDate = (value) => {
    if (!value) return '';
    try {
      let d;
      if (typeof value.toDate === 'function') {
        d = value.toDate();
      } else if (value?.seconds) {
        d = new Date(value.seconds * 1000);
      } else if (typeof value === 'string') {
        d = new Date(value);
      } else if (value instanceof Date) {
        d = value;
      } else {
        d = new Date(value);
      }
      if (isNaN(d.getTime())) return '';
      return formatDistanceToNow(d, { addSuffix: true });
    } catch (err) {
      console.error('safeFormatDate error', err);
      return '';
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      const [postSnapshot, userSnapshot] = await Promise.all([
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'users')),
      ]);
      const fetchedPosts = postSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const fetchedUsers = userSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(fetchedPosts);
      setUsers(fetchedUsers);
      const map = {};
      fetchedUsers.forEach((u) => {
        const key = u.id || u.uid;
        map[key] = u;
      });
      setUsersMap(map);
    } catch (err) {
      console.error('Error refreshing admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const postSnapshot = await getDocs(collection(db, 'posts'));
        const fetchedPosts = postSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        const userSnapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers = userSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!mounted) return;

        setPosts(fetchedPosts);
        setUsers(fetchedUsers);

        const map = {};
        fetchedUsers.forEach((u) => {
          const key = u.id || u.uid;
          map[key] = u;
        });
        setUsersMap(map);
      } catch (err) {
        console.error('Error fetching admin data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  const deletePost = async (postId) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const deleteUser = async (userId) => {
    const ok = window.confirm('Delete this user and all their posts/memberships? This cannot be undone.');
    if (!ok) return;
    setDeleting((prev) => ({ ...prev, [userId]: true }));
    try {
      const functions = getFunctions(undefined, FUNCTIONS_REGION);
      const adminDeleteUser = httpsCallable(functions, 'adminDeleteUser');
      const res = await adminDeleteUser({ uid: userId });

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setUsersMap((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      setPosts((prev) => prev.filter(
        (p) => p.uid !== userId && p.authorUid !== userId && p.authorId !== userId && p.userId !== userId
      ));

      await refreshData();

      if (res?.data) {
        console.log('Delete counts:', res.data);
      }
    } catch (err) {
      console.error('Error deleting user via function:', err);
      alert(err?.message || 'Failed to delete user');
    } finally {
      setDeleting((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
    }
  };

  const toggleAdmin = async (userId, currentStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isAdmin: !currentStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isAdmin: !currentStatus } : u))
      );
      setUsersMap((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || {}), isAdmin: !currentStatus }
      }));
    } catch (err) {
      console.error('Error toggling admin:', err);
    }
  };

  const toggleModerator = async (userId, currentStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isModerator: !currentStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isModerator: !currentStatus } : u))
      );
      setUsersMap((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || {}), isModerator: !currentStatus }
      }));
    } catch (err) {
      console.error('Error toggling moderator:', err);
    }
  };

  const handleThemeSave = async () => {
    try {
      await saveTheme({ navbarColor, backgroundColor });
    } catch (err) {
      console.error('Error saving theme:', err);
    }
  };

  const authorDisplayForPost = (post) => {
    const uidKey = post.uid || post.authorUid || post.authorId || null;
    if (uidKey && usersMap[uidKey]?.displayName) return usersMap[uidKey].displayName;
    if (post.authorName) return post.authorName;
    if (post.author) return post.author;
    if (post.authorEmail) return post.authorEmail;
    return 'Unknown';
  };

  const sortUsers = (usersList) => {
    return [...usersList].sort((a, b) => {
      const aName = (a.displayName || a.email || 'Unknown').toLowerCase();
      const bName = (b.displayName || b.email || 'Unknown').toLowerCase();
      const getPriority = (user) => {
        if (user.isAdmin) return 0;
        if (user.isModerator) return 1;
        return 2;
      };
      const aPriority = getPriority(a);
      const bPriority = getPriority(b);
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return aName.localeCompare(bName);
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-center text-lg">Loading admin dashboard…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>

      {/* THEME SETTINGS */}
      <section className="mb-10 border p-4 rounded bg-white">
        <h3 className="text-lg font-semibold mb-4">Theme Settings</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div>
            <label className="block text-sm font-medium">Navbar Color</label>
            <input
              type="color"
              value={navbarColor}
              onChange={(e) => setNavbarColor(e.target.value)}
              className="w-16 h-10 p-0 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Background Color</label>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="w-16 h-10 p-0 border rounded"
            />
          </div>
          <button
            onClick={handleThemeSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save Theme
          </button>
        </div>
      </section>

      {/* POSTS SECTION */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold mb-2">Posts</h3>
        {posts.length === 0 && <p className="text-gray-500">No posts found.</p>}
        {posts.map((post) => {
          const user = usersMap[post.uid] || {};
          return (
            <div key={post.id} className="border p-3 mb-3 rounded bg-gray-50">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={user.photoURL || defaultAvatar}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <p className="font-medium text-gray-800 flex items-center gap-2">
                  {authorDisplayForPost(post)}
                  {user.isAdmin && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  {user.isModerator && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                      Moderator
                    </span>
                  )}
                </p>
              </div>
              <p className="font-semibold">{post.title || post.content || post.text || 'Untitled'}</p>
              <p className="text-xs text-gray-500 mt-1">
                {post.createdAt ? safeFormatDate(post.createdAt) : ''}
              </p>
              <div className="mt-2 flex gap-3 items-center">
                <button
                  onClick={() => deletePost(post.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete Post
                </button>
                <div className="text-xs text-gray-500">Likes: {post.likes?.length || 0}</div>
                <div className="text-xs text-gray-500">Comments: {post.comments?.length || 0}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* USERS SECTION */}
      <section>
        <h3 className="text-xl font-semibold mb-2">Users</h3>
        {users.length === 0 && <p className="text-gray-500">No users found.</p>}
        {sortUsers(users).map((u) => (
          <div key={u.id} className="border p-3 mb-3 rounded bg-white flex items-center gap-4">
            <Link to={`/profile/${u.id}`}>
              <img
                src={u.photoURL || defaultAvatar}
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover"
              />
            </Link>
            <div className="flex-1">
              <p className="font-medium flex items-center gap-2">
                <Link to={`/profile/${u.id}`} className="hover:underline">
                  {u.displayName || u.email || 'Unknown'}
                </Link>
                {u.isAdmin && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                    Admin
                  </span>
                )}
                {u.isModerator && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                    Moderator
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500 mb-1">{u.email}</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => toggleAdmin(u.id, !!u.isAdmin)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                </button>
                <button
                  onClick={() => toggleModerator(u.id, !!u.isModerator)}
                  className="text-sm text-green-600 hover:underline"
                >
                  {u.isModerator ? 'Revoke Moderator' : 'Make Moderator'}
                </button>
                {!u.isAdmin && (
                  <button
                    onClick={() => deleteUser(u.id)}
                    disabled={!!deleting[u.id]}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting[u.id] ? 'Deleting…' : 'Delete User'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}