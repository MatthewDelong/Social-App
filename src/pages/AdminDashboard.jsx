// src/pages/AdminDashboard.jsx
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
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Local form state for theme colors
  const [navbarColor, setNavbarColor] = useState(theme?.navbarColor || '#ffffff');
  const [backgroundColor, setBackgroundColor] = useState(theme?.backgroundColor || '#f9fafb');

  // Safe date formatting helper that accepts:
  // - Firestore Timestamp (has toDate() or seconds)
  // - ISO string
  // - JS Date
  // returns '' on failure
  const safeFormatDate = (value) => {
    if (!value) return '';
    try {
      let d;
      // Firestore Timestamp has toDate()
      if (typeof value.toDate === 'function') {
        d = value.toDate();
      } else if (value?.seconds) {
        // Some Firestore shapes expose seconds
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
      // don't crash the UI if a weird value shows up
      console.error('safeFormatDate error', err);
      return '';
    }
  };

  // Fetch posts + users on mount
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        // fetch posts
        const postSnapshot = await getDocs(collection(db, 'posts'));
        const fetchedPosts = postSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // fetch users
        const userSnapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers = userSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!mounted) return;

        setPosts(fetchedPosts);
        setUsers(fetchedUsers);

        // build usersMap for quick lookup by UID/id
        const map = {};
        fetchedUsers.forEach((u) => {
          // try to support both id==uid and a separate uid field if present
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
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      // also remove from usersMap
      setUsersMap((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const toggleAdmin = async (userId, currentStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isAdmin: !currentStatus });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isAdmin: !currentStatus } : u)));
      setUsersMap((prev) => ({ ...prev, [userId]: { ...(prev[userId] || {}), isAdmin: !currentStatus } }));
    } catch (err) {
      console.error('Error toggling admin:', err);
    }
  };

  const toggleModerator = async (userId, currentStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isModerator: !currentStatus });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isModerator: !currentStatus } : u)));
      setUsersMap((prev) => ({ ...prev, [userId]: { ...(prev[userId] || {}), isModerator: !currentStatus } }));
    } catch (err) {
      console.error('Error toggling moderator:', err);
    }
  };

  const handleThemeSave = async () => {
    try {
      // call central saveTheme (which will write to Firestore)
      await saveTheme({ navbarColor, backgroundColor });
      // update local state too (AppContext probably does this already)
    } catch (err) {
      console.error('Error saving theme:', err);
    }
  };

  // Render helpers
  const authorDisplayForPost = (post) => {
    // Priority:
    // 1) usersMap[post.uid]?.displayName
    // 2) post.authorName
    // 3) post.author (legacy)
    // 4) post.authorEmail
    // 5) 'Unknown'
    const uidKey = post.uid || post.authorUid || post.authorId || null;
    if (uidKey && usersMap[uidKey]?.displayName) return usersMap[uidKey].displayName;
    if (post.authorName) return post.authorName;
    if (post.author) return post.author;
    if (post.authorEmail) return post.authorEmail;
    return 'Unknown';
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
        {posts.map((post) => (
          <div key={post.id} className="border p-3 mb-3 rounded bg-gray-50">
            {/* post content may have different keys depending on how posts were created; try common ones */}
            <p className="font-medium text-gray-800">{post.title || post.content || post.text || 'Untitled'}</p>

            <p className="text-sm text-gray-600 mt-1">
              By:&nbsp;
              <strong>{authorDisplayForPost(post)}</strong>
            </p>

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

              {/* show post metadata */}
              <div className="text-xs text-gray-500">Likes: {post.likes?.length || 0}</div>
              <div className="text-xs text-gray-500">Comments: {post.comments?.length || 0}</div>
            </div>
          </div>
        ))}
      </section>

      {/* USERS SECTION */}
      <section>
        <h3 className="text-xl font-semibold mb-2">Users</h3>
        {users.length === 0 && <p className="text-gray-500">No users found.</p>}
        {users.map((u) => (
          <div key={u.id} className="border p-3 mb-3 rounded bg-white">
            <p className="font-medium">{u.displayName || u.email || 'Unknown'}</p>
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
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete User
                </button>
              )}
            </div>

            <div className="mt-2">
              {u.isAdmin && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">
                  Admin
                </span>
              )}
              {u.isModerator && (
                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  Moderator
                </span>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}